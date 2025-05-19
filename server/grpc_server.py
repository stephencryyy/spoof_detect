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
            signal = None 
            sr = None     
            # overall_error_message_parts уже определен в начале метода AnalyzeAudio.
            loading_attempt_errors = [] # Локальный список ошибок для этой сессии загрузки

            try:
                for format_to_try in ["wav", "mp3", "flac", "webm"]:
                    # Создаем НОВЫЙ поток для КАЖДОЙ попытки формата
                    audio_stream_for_format = io.BytesIO(audio_content_bytes)
                    try:
                        signal, sr = torchaudio.load(audio_stream_for_format, format=format_to_try)
                        print(f"Файл успешно загружен в формате: {format_to_try}") 
                        loading_attempt_errors.clear() # Успех, очищаем ошибки этой сессии
                        break # Выходим из цикла, так как аудио успешно загружено
                    except Exception as e:
                        error_msg_format = f"Ошибка при попытке загрузки файла в формате {format_to_try}: {e}"
                        print(error_msg_format)
                        loading_attempt_errors.append(error_msg_format)
                        signal, sr = None, None # Сбрасываем, так как этот формат не удался
                        # audio_stream_for_format закроется автоматически сборщиком мусора
                        continue # Переходим к следующему формату
                
                if signal is None or sr is None: # Если ни один формат не подошел
                    overall_error_message_parts.extend(loading_attempt_errors) 
                    error_details_str = "; ".join(filter(None, overall_error_message_parts)) # filter(None, ...) для удаления пустых строк, если они есть
                    final_error_msg = f"Не удалось загрузить аудиофайл ни в одном из поддерживаемых форматов (wav, mp3, flac, webm). Детали: {error_details_str if error_details_str else 'Конкретных ошибок при попытках загрузки не зарегистрировано.'}"
                    print(final_error_msg)
                    context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                    context.set_details(final_error_msg)
                    return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=final_error_msg)
            
            except Exception as e_outer: # Ловим другие неожиданные ошибки в этом блоке
                if loading_attempt_errors: # Добавляем ошибки попыток загрузки, если они были до этого исключения
                    overall_error_message_parts.extend(loading_attempt_errors)
                overall_error_message_parts.append(f"Неожиданная общая ошибка на этапе загрузки аудио: {e_outer}")
                final_error_msg_outer = f"Общая ошибка при обработке аудио для загрузки. Детали: {'; '.join(filter(None, overall_error_message_parts))}"
                print(final_error_msg_outer)
                context.set_code(grpc.StatusCode.INTERNAL) 
                context.set_details(final_error_msg_outer)
                return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=final_error_msg_outer)

            # Защитная проверка: если signal или sr все еще None, это указывает на проблему в логике выше.
            if signal is None or sr is None:
                 # Эта ситуация не должна возникать, если предыдущая логика возвращает ошибку корректно.
                 critical_fallback_msg = "Критическая ошибка: аудио не было загружено (signal или sr is None) после блока попыток загрузки, несмотря на проверки."
                 if overall_error_message_parts:
                     critical_fallback_msg += " Собранные ошибки: " + "; ".join(filter(None, overall_error_message_parts))
                 elif loading_attempt_errors: # Если overall_error_message_parts пуст, но были локальные ошибки
                     critical_fallback_msg += " Локальные ошибки загрузки: " + "; ".join(filter(None, loading_attempt_errors))
                 print(critical_fallback_msg)
                 context.set_code(grpc.StatusCode.INTERNAL)
                 context.set_details(critical_fallback_msg)
                 return audio_analyzer_pb2.AnalyzeAudioResponse(error_message=critical_fallback_msg)

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
            results = [] # Список из Tuple[Optional[AudioChunkPrediction], Optional[str]]

            # Используем ThreadPoolExecutor для параллельной обработки
            # Оптимальное число воркеров зависит от системы и характера нагрузки.
            # Если модель на GPU, то CPU-воркеров может быть немного.
            # Если модель на CPU, то число воркеров должно быть соизмеримо с CPU ядрами.
            # Учитываем, что gRPC сервер сам использует ThreadPoolExecutor.
            num_workers = min(8, (os.cpu_count() or 4)) # Ограничим 8 воркерами или числом ядер (минимум 4)
            # print(f"Используется ThreadPoolExecutor с {num_workers} воркерами для обработки чанков.") # Можно заменить на logger.debug
            logger.info(f"Using ThreadPoolExecutor with {num_workers} workers for chunk processing for request {internal_request_id_for_redis}")

            with futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                # Отправляем задачи на выполнение
                future_to_chunk_idx = {
                    executor.submit(self._process_chunk_from_redis, internal_request_id_for_redis, chunk_idx): chunk_idx 
                    for chunk_idx in chunk_indices_to_process
                }
                
                for future in futures.as_completed(future_to_chunk_idx):
                    chunk_idx_completed = future_to_chunk_idx[future]
                    try:
                        prediction_obj, error_str = future.result() # Получаем результат выполнения
                        results.append((prediction_obj, error_str))
                        if error_str:
                             logger.warning(f"Error processing chunk {chunk_idx_completed} for request {internal_request_id_for_redis}: {error_str}")
                        # Опционально: удаляем чанк из Redis после успешной обработки или всегда
                        # chunk_key_to_delete = f"{internal_request_id_for_redis}:chunk_{chunk_idx_completed}"
                        # try:
                        #    self.redis_client.delete(chunk_key_to_delete)
                        # except redis.exceptions.RedisError as e_del:
                        #    logger.warning(f"Error deleting chunk {chunk_key_to_delete} from Redis: {e_del}")
                    except Exception as exc:
                        error_msg_future = f"Исключение при обработке чанка {chunk_idx_completed} в потоке: {exc}"
                        print(error_msg_future) # Оставляем print для быстрой отладки, но также логируем
                        logger.error(f"Exception while processing chunk {chunk_idx_completed} in thread for request {internal_request_id_for_redis}", exc_info=True)
                        results.append((None, error_msg_future)) # Добавляем ошибку в результаты
            
            # Сбор результатов
            for pred_obj, err_str in results:
                if pred_obj:
                    predictions_list.append(pred_obj)
                if err_str:
                    if err_str not in overall_error_message_parts: # Избегаем дублирования, если ошибка уже была добавлена
                         overall_error_message_parts.append(err_str)
            
            # Опционально: Сортируем predictions_list по времени начала, если это требуется клиентом
            # Это важно, если порядок чанков имеет значение для клиента.
            if predictions_list:
                predictions_list.sort(key=lambda p: p.start_time_seconds)
            
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
    # Инициализация сервисера для проверки загрузки модели и других зависимостей.
    # Логгер уже должен быть настроен к этому моменту (в if __name__ == '__main__').
    try:
        logger.info("Попытка инициализации AudioAnalysisServicer...")
        servicer_instance = AudioAnalysisServicer() 
        logger.info("AudioAnalysisServicer успешно инициализирован.")
    except RuntimeError as e:
        print(f"КРИТИЧЕСКАЯ ОШИБКА при инициализации AudioAnalysisServicer (RuntimeError): {e}")
        logger.critical(f"КРИТИЧЕСКАЯ ОШИБКА при инициализации AudioAnalysisServicer (RuntimeError): {e}", exc_info=True)
        print("Сервер НЕ БУДЕТ ЗАПУЩЕН.")
        return 
    except Exception as e: 
        print(f"НЕОЖИДАННАЯ КРИТИЧЕСКАЯ ОШИБКА при инициализации AudioAnalysisServicer: {e}")
        logger.critical(f"НЕОЖИДАННАЯ КРИТИЧЕСКАЯ ОШИБКА при инициализации AudioAnalysisServicer: {e}", exc_info=True)
        print("Сервер НЕ БУДЕТ ЗАПУЩЕН.")
        return

    grpc_server_workers = int(os.getenv('GRPC_SERVER_WORKERS', '10'))
    logger.info(f"Запуск gRPC сервера с {grpc_server_workers} воркерами для обработки запросов.")
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=grpc_server_workers))
    
    audio_analyzer_pb2_grpc.add_AudioAnalysisServicer_to_server(
        servicer_instance, server # Используем уже созданный и проверенный экземпляр
    )
    
    server.add_insecure_port(_SERVER_ADDRESS) # Используем константу _SERVER_ADDRESS
    print(f"Сервер gRPC слушает на {_SERVER_ADDRESS}")
    logger.info(f"Сервер gRPC слушает на {_SERVER_ADDRESS}")
    
    server.start()
    print("Сервер gRPC успешно запущен.")
    logger.info("Сервер gRPC успешно запущен.")
    
    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except KeyboardInterrupt:
        print("Получен сигнал KeyboardInterrupt. Остановка сервера...")
        logger.info("Получен сигнал KeyboardInterrupt. Остановка сервера...")
    finally:
        shutdown_event = server.stop(grace=5) # Даем 5 секунд на graceful shutdown
        print("Ожидание завершения работы сервера...")
        logger.info("Ожидание завершения работы сервера...")
        shutdown_event.wait() # Блокируемся до полной остановки
        print("Сервер gRPC полностью остановлен.")
        logger.info("Сервер gRPC полностью остановлен.")

if __name__ == '__main__':
    # Настройка логирования должна быть в самом начале.
    log_level_str = os.getenv('LOG_LEVEL', 'INFO').upper()
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(process)d - %(threadName)s - %(message)s'
    
    # Убедимся, что уровень логирования корректен
    numeric_level = getattr(logging, log_level_str, None)
    if not isinstance(numeric_level, int):
        print(f"Неверный уровень логирования: {log_level_str}. Используется INFO.")
        numeric_level = logging.INFO

    logging.basicConfig(
        level=numeric_level, 
        format=log_format,
        handlers=[
            logging.StreamHandler() # Вывод в stderr по умолчанию
        ]
    )
    # logger = logging.getLogger(__name__) # Получаем логгер для текущего модуля, если нужно специфичное имя

    # Пример установки уровня для других логгеров, если они слишком "шумные"
    # logging.getLogger('minio').setLevel(logging.WARNING)
    # logging.getLogger('urllib3').setLevel(logging.WARNING) # MinIO использует urllib3
    # logging.getLogger('redis').setLevel(logging.WARNING)

    logger.info(f"Запуск gRPC сервера из __main__ с уровнем логирования {log_level_str}...")
    serve()