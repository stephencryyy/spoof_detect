import grpc
from concurrent import futures
import time
import numpy as np
import torch
import os
import io # Для работы с байтами аудио
import torchaudio # Для обработки аудио
import redis # Для взаимодействия с Redis
from minio import Minio # <--- Добавлен импорт MinIO
from minio.error import S3Error # <--- Для обработки ошибок MinIO
from typing import List, Tuple, Optional # Изменено Dict на List
import uuid # Для генерации request_id, если он не приходит
import logging

# Получаем экземпляр логгера
logger = logging.getLogger(__name__)

# Импорт сгенерированного кода
import audio_analyzer_pb2
import audio_analyzer_pb2_grpc

# Импорт компонентов из inference.py
from inference import (
    load_model_from_checkpoint,
    # CustomWavLMForClassification, # Уже не нужен здесь напрямую, т.к. модель загружается
    CHECKPOINT_FILE,
    SAMPLE_RATE,
    NUM_SAMPLES,
    # MODEL_CHECKPOINT # Не используется напрямую в этом файле
)

# Константы для сервера
_ONE_DAY_IN_SECONDS = 60 * 60 * 24
_SERVER_ADDRESS = '[::]:50052'

# Константы для Redis
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_CHUNK_EXPIRY_SECONDS = 3600 # 1 час

# Константы для MinIO (из переменных окружения)
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'localhost:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin') # Пример
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin') # Пример
MINIO_SECURE = os.getenv('MINIO_SECURE', 'False').lower() == 'true'
MINIO_BUCKET_NAME = os.getenv('MINIO_BUCKET_NAME', 'your-audio-bucket')

# Рассчитываем длительность чанка в секундах
CHUNK_DURATION_SECONDS = NUM_SAMPLES / SAMPLE_RATE

# Используем имя сервиса и сообщения из README.md
# Если ваши сгенерированные файлы используют другие имена, их нужно будет поправить
# Например, AudioDetectionServicer вместо AudioSpoofDetectorServicer
class AudioAnalysisServicer(audio_analyzer_pb2_grpc.AudioAnalysisServicer): # ИЗМЕНЕНО: базовый класс
    """Реализация gRPC сервиса для анализа аудио дипфейков."""

    def __init__(self):
        super().__init__()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Используемое устройство для инференса: {self.device}")
        current_dir = os.path.dirname(os.path.abspath(__file__))
        checkpoint_full_path = os.path.join(current_dir, CHECKPOINT_FILE)

        print("Загрузка модели...")
        self.model = load_model_from_checkpoint(checkpoint_full_path, self.device)
        if self.model is None:
            # Эта ошибка должна быть обработана выше, чтобы сервер не стартовал
            # Но на всякий случай, добавим явный вызов исключения
            raise RuntimeError("Не удалось загрузить модель. Сервер не может стартовать.")
        self.model.eval()
        print("Модель успешно загружена и готова к работе.")

        print(f"Подключение к Redis: {REDIS_HOST}:{REDIS_PORT}")
        try:
            self.redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)
            self.redis_client.ping()
            print("Успешно подключено к Redis.")
        except redis.exceptions.ConnectionError as e:
            print(f"Ошибка подключения к Redis: {e}")
            self.redis_client = None # Сервис может продолжить работу, но AnalyzeAudio вернет ошибку

        # Инициализация клиента MinIO (без проверки бакета по умолчанию здесь)
        print(f"Инициализация клиента MinIO для эндпоинта: {MINIO_ENDPOINT}, secure: {MINIO_SECURE}")
        try:
            self.minio_client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE
            )
        except Exception as e:
            print(f"Критическая ошибка при инициализации клиента MinIO: {e}")
            # Это критично, без MinIO сервис не сможет работать по новой схеме
            raise RuntimeError(f"Не удалось инициализировать клиент MinIO: {e}")


    def _predict_score_for_chunk_tensor(self, chunk_tensor: torch.Tensor) -> float:
        """
        Выполняет предсказание для одного чанка (тензора) и возвращает score (0-1).
        chunk_tensor должен быть формы [1, NUM_SAMPLES].
        """
        with torch.no_grad():
            logit = self.model(chunk_tensor.to(self.device))
        score = torch.sigmoid(logit).item()
        return score

    def _process_chunk_from_redis(self, request_id_for_redis: str, chunk_idx: int) -> Tuple[Optional[audio_analyzer_pb2.AudioChunkPrediction], Optional[str]]:
        """
        Загружает чанк из Redis, выполняет предсказание и возвращает объект AudioChunkPrediction или ошибку.
        Возвращает (AudioChunkPrediction, None) или (None, error_message)
        """
        chunk_key = f"{request_id_for_redis}:chunk_{chunk_idx}"
        chunk_id_str = f"chunk_{chunk_idx}"
        
        start_time = chunk_idx * CHUNK_DURATION_SECONDS
        end_time = (chunk_idx + 1) * CHUNK_DURATION_SECONDS

        try:
            chunk_data_bytes = self.redis_client.get(chunk_key)
            if chunk_data_bytes is None:
                error_msg = f"Chunk {chunk_key} not found in Redis"
                print(f"Ошибка: {error_msg}")
                return None, error_msg

            audio_data_np = np.frombuffer(chunk_data_bytes, dtype=np.float32)
            
            if audio_data_np.shape[0] != NUM_SAMPLES:
                error_msg = f"Chunk {chunk_key} has incorrect size. Expected {NUM_SAMPLES}, got {audio_data_np.shape[0]}."
                print(error_msg)
                return None, error_msg

            input_tensor = torch.from_numpy(audio_data_np).unsqueeze(0) # Добавляем batch dim [1, NUM_SAMPLES]
            
            score_value = self._predict_score_for_chunk_tensor(input_tensor)
            print(f"LOG_SCORE: Chunk {chunk_key} (ID: {chunk_id_str}), Raw Score from model: {score_value}, Type: {type(score_value)}")
            
            # Округляем значение score до 4 знаков после запятой
            score_value_rounded = round(score_value, 4)

            prediction = audio_analyzer_pb2.AudioChunkPrediction(
                chunk_id=chunk_id_str,
                score=score_value_rounded, # Используем округленное значение
                start_time_seconds=start_time,
                end_time_seconds=end_time
            )
            return prediction, None

        except Exception as e:
            error_msg = f"Error processing chunk {chunk_key}: {e}"
            print(error_msg)
            return None, error_msg


    # Это новый основной метод согласно README.md
    def AnalyzeAudio(self, request: audio_analyzer_pb2.AnalyzeAudioRequest, context) -> audio_analyzer_pb2.AnalyzeAudioResponse:
        """
        Обрабатывает полный аудиофайл: скачивает из MinIO, нарезает на чанки, 
        сохраняет в Redis, параллельно обрабатывает чанки и возвращает агрегированный результат.
        """
        # Генерируем внутренний ID для использования с Redis, т.к. request_id не приходит
        # В будущем здесь можно использовать request.task_id, если он будет добавлен
        internal_request_id_for_redis = str(uuid.uuid4())

        print(f"Получен запрос AnalyzeAudio. Bucket: '{request.minio_bucket_name}', Key: '{request.minio_object_key}'. Internal Redis ID: {internal_request_id_for_redis}")

        if self.redis_client is None:
            error_msg = "Ошибка сервера: Redis недоступен."
            print(error_msg)
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details(error_msg)
            # ИЗМЕНЕНО: возвращаем AnalyzeAudioResponse
            return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)

        if not self.minio_client: # Проверка на случай, если minio_client не был инициализирован
            error_msg = "Ошибка сервера: MinIO клиент не инициализирован."
            print(error_msg)
            context.set_code(grpc.StatusCode.FAILED_PRECONDITION)
            context.set_details(error_msg)
            return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)

        predictions_list: List[audio_analyzer_pb2.AudioChunkPrediction] = []
        overall_error_message_parts = []

        try:
            # 1. Скачивание аудиофайла из MinIO
            audio_content_bytes = None
            if not request.minio_bucket_name or not request.minio_object_key:
                error_msg = "Ошибка запроса: minio_bucket_name или minio_object_key не указаны."
                print(error_msg)
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(error_msg)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)
            
            try:
                print(f"Загрузка файла из MinIO: bucket='{request.minio_bucket_name}', key='{request.minio_object_key}'")
                # Проверка существования бакета перед чтением объекта
                if not self.minio_client.bucket_exists(request.minio_bucket_name):
                    error_msg = f"Ошибка MinIO: Бакет '{request.minio_bucket_name}' не найден."
                    print(error_msg)
                    context.set_code(grpc.StatusCode.NOT_FOUND)
                    context.set_details(error_msg)
                    return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)
                
                response_minio = self.minio_client.get_object(request.minio_bucket_name, request.minio_object_key)
                audio_content_bytes = response_minio.read()
            except S3Error as s3_err:
                error_msg = f"Ошибка MinIO при скачивании файла '{request.minio_object_key}' из бакета '{request.minio_bucket_name}': {s3_err}"
                print(error_msg)
                # Определяем более конкретный gRPC код ошибки на основе S3 ошибки
                if s3_err.code == "NoSuchKey" or s3_err.code == "NoSuchBucket":
                    context.set_code(grpc.StatusCode.NOT_FOUND)
                else:
                    context.set_code(grpc.StatusCode.INTERNAL) # Общая ошибка MinIO
                context.set_details(error_msg)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)
            except Exception as e:
                error_msg = f"Неожиданная ошибка при скачивании файла из MinIO '{request.minio_object_key}': {e}"
                print(error_msg)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(error_msg)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)
            finally:
                if 'response_minio' in locals() and response_minio:
                    response_minio.close()
                    response_minio.release_conn()
            
            if not audio_content_bytes:
                error_msg = f"Файл '{request.minio_object_key}' из MinIO (бакет '{request.minio_bucket_name}') пуст или не удалось прочитать."
                print(error_msg)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(error_msg)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)

            print(f"Файл из MinIO успешно загружен, размер: {len(audio_content_bytes)} байт.")

            # 2. Загрузка и предобработка аудио (теперь из audio_content_bytes)
            audio_stream = io.BytesIO(audio_content_bytes)
            try:
                signal, sr = torchaudio.load(audio_stream) # формат будет определен автоматически
            except Exception as e:
                error_msg = f"Ошибка загрузки аудио: {e}"
                print(error_msg)
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(error_msg)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)

            # 1.1 Ресемплинг
            if sr != SAMPLE_RATE:
                resampler = torchaudio.transforms.Resample(sr, SAMPLE_RATE)
                signal = resampler(signal)
            
            # 1.2 Моно
            if signal.shape[0] > 1:
                signal = torch.mean(signal, dim=0, keepdim=True)
            
            # Убираем размерность канала -> [num_samples_total]
            signal = signal.squeeze(0) 
            total_samples = signal.shape[0]
            num_chunks_calculated = (total_samples + NUM_SAMPLES - 1) // NUM_SAMPLES # Округление вверх

            if num_chunks_calculated == 0 and total_samples > 0: # если аудио короче одного чанка, но не пустое
                num_chunks_calculated = 1
            elif total_samples == 0:
                error_msg = "Аудиофайл пуст или не содержит аудиоданных после предобработки."
                print(error_msg)
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(error_msg)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=error_msg)


            print(f"Аудиофайл предобработан. Всего семплов: {total_samples}, будет чанков: {num_chunks_calculated}")

            # 3. Нарезка на чанки, сохранение в Redis и планирование обработки
            # Используем ThreadPoolExecutor для параллельной обработки чанков из Redis
            # Это может быть не самым лучшим решением для IO-bound операций с Redis, 
            # но для CPU-bound инференса это может дать выигрыш.
            # Альтернатива - asyncio с подходящим Redis клиентом, если весь стек асинхронный.

            # Сохраняем чанки в Redis
            chunk_indices_to_process = []
            for i in range(num_chunks_calculated):
                start_sample = i * NUM_SAMPLES
                end_sample = start_sample + NUM_SAMPLES

                # Паддинг для последнего чанка, если он короче
                if end_sample > total_samples:
                    chunk_signal_np = signal[start_sample:].numpy()
                    padding_needed = NUM_SAMPLES - len(chunk_signal_np)
                    if padding_needed > 0: # Только если действительно нужен паддинг
                         chunk_signal_np = np.pad(chunk_signal_np, (0, padding_needed), 'constant')
                else:
                    chunk_signal_np = signal[start_sample:end_sample].numpy()

                if chunk_signal_np.shape[0] != NUM_SAMPLES:
                     # Этого не должно произойти с правильным паддингом/нарезкой, но на всякий случай
                    print(f"Предупреждение: Чанк {i} после нарезки/паддинга имеет размер {chunk_signal_np.shape[0]}, ожидалось {NUM_SAMPLES}")
                    # Можно пропустить этот чанк или вернуть ошибку
                    overall_error_message_parts.append(f"Chunk {i} has wrong size after slicing/padding.")
                    continue

                chunk_key = f"{internal_request_id_for_redis}:chunk_{i}"
                try:
                    self.redis_client.set(chunk_key, chunk_signal_np.astype(np.float32).tobytes(), ex=REDIS_CHUNK_EXPIRY_SECONDS)
                    chunk_indices_to_process.append(i)
                except redis.exceptions.RedisError as e:
                    error_msg_redis = f"Ошибка сохранения чанка {i} в Redis: {e}"
                    print(error_msg_redis)
                    overall_error_message_parts.append(error_msg_redis)
                    # Если не удалось сохранить чанк, нет смысла его обрабатывать
            
            if not chunk_indices_to_process: # Если не удалось сохранить ни одного чанка
                 if not overall_error_message_parts: # Если и ошибок не было (например, пустой файл дал 0 чанков)
                      overall_error_message_parts.append("No chunks were processed or saved to Redis.")
                 final_error_msg = " | ".join(overall_error_message_parts)
                 context.set_code(grpc.StatusCode.INTERNAL)
                 context.set_details(final_error_msg)
                 return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=final_error_msg)


            # 4. Параллельная обработка чанков из Redis
            # Результаты (предсказание, ошибка_сообщения)
            results = [] # Список из Tuple[Optional[AudioChunkPrediction], Optional[str]]

            # Простой последовательный вызов для начала, чтобы избежать сложностей с ThreadPoolExecutor
            # и его влиянием на gRPC context/threads, если таковые имеются.
            # Для реальной параллелизации, ThreadPoolExecutor или asyncio будут нужны.
            for chunk_idx in chunk_indices_to_process:
                prediction_obj, error_str = self._process_chunk_from_redis(internal_request_id_for_redis, chunk_idx)
                results.append((prediction_obj, error_str))
                # Опционально: удаляем чанк из Redis после обработки
                # self.redis_client.delete(f"{internal_request_id_for_redis}:chunk_{chunk_idx}")


            # Сбор результатов
            for pred_obj, err_str in results:
                if pred_obj:
                    predictions_list.append(pred_obj)
                if err_str:
                    overall_error_message_parts.append(err_str)
            
            # Финальное сообщение об ошибке
            final_error_msg = ""
            if overall_error_message_parts:
                final_error_msg = " | ".join(overall_error_message_parts)
                print(f"Обнаружены ошибки при обработке: {final_error_msg}")
                # Не устанавливаем код ошибки здесь, если есть хотя бы частичные предсказания,
                # но передаем error_message. Клиент должен будет это учесть.
                # Если predictions_list пуст и есть ошибки, то это явная проблема.
                if not predictions_list:
                    context.set_code(grpc.StatusCode.INTERNAL) # или другой подходящий код
                    context.set_details(final_error_msg)
                    # Возвращаем ответ с ошибкой, но без predictions, если они пусты
                    return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=final_error_msg)


            print(f"Анализ завершен для {internal_request_id_for_redis}. Предсказаний: {len(predictions_list)}. Ошибки: '{final_error_msg if final_error_msg else 'Нет'}'")
            return audio_analyzer_pb2.AnalyzeAudioResponse(predictions=predictions_list, error_message=final_error_msg)

        except Exception as e:
            # Глобальный обработчик ошибок для метода AnalyzeAudio
            critical_error_msg = f"Критическая ошибка в AnalyzeAudio: {e}"
            print(critical_error_msg)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(critical_error_msg)
            # Убедимся, что возвращаем список предсказаний, даже если он пуст
            return audio_analyzer_pb2.AnalyzeAudioResponse(predictions=predictions_list, error_message=critical_error_msg)

    # Старый метод PredictChunk больше не нужен в таком виде, так как его логика
    # инкапсулирована в _predict_score_for_chunk_tensor и _process_chunk_from_redis.
    # Если он определен в proto и ожидается, его нужно будет адаптировать или удалить из proto.
    # Пока что я его закомментирую, предполагая, что основным является ProcessAudio.
    # def PredictChunk(self, request, context):
    #     """Обрабатывает запрос на предсказание для одного чанка."""
    #     # ... старая реализация ...


def serve():
    """Запускает gRPC сервер."""
    # Определяем максимальное количество воркеров для ThreadPoolExecutor
    # Это значение может потребовать тюнинга в зависимости от сервера и характера задач
    # Для CPU-bound задач (инференс модели) имеет смысл ставить близко к количеству CPU ядер
    # Для IO-bound (работа с Redis/MinIO) можно больше, но здесь инференс доминирует.
    num_workers = os.cpu_count() or 1 
    print(f"Запуск gRPC сервера с {num_workers} воркерами...")
    
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=num_workers))

    # Создаем экземпляр нашего сервиса (модель загрузится в __init__)
    try:
        servicer = AudioAnalysisServicer() # Используем новое имя класса
    except RuntimeError as e:
        print(f"Критическая ошибка при инициализации сервиса: {e}")
        return 

    # Убедитесь, что эта функция соответствует вашему xxx_pb2_grpc.py
    # Например, add_AudioDetectionServicer_to_server
    audio_analyzer_pb2_grpc.add_AudioAnalysisServicer_to_server(servicer, server) # ИЗМЕНЕНО: функция добавления

    # Изменяем здесь, чтобы слушать на всех IPv4 интерфейсах
    listen_addr = '0.0.0.0:50052'
    server.add_insecure_port(listen_addr)
    logger.info(f"Сервер слушает на {listen_addr}")
    server.start()
    logger.info("Сервер успешно запущен.")
    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except KeyboardInterrupt:
        logger.info("Остановка сервера...")
        server.stop(0)
        logger.info("Сервер остановлен.")

if __name__ == '__main__':
    # Конфигурация basicConfig должна быть вызвана до первого использования logger
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    serve()