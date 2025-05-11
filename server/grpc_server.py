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
from typing import Dict, Tuple # Для type hinting

# Импорт сгенерированного кода
import audio_spoof_pb2
import audio_spoof_pb2_grpc

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
MINIO_BUCKET_NAME = os.getenv('MINIO_BUCKET_NAME', 'audio-files') # Пример
MINIO_SECURE = os.getenv('MINIO_SECURE', 'False').lower() == 'true'


# Используем имя сервиса и сообщения из README.md
# Если ваши сгенерированные файлы используют другие имена, их нужно будет поправить
# Например, AudioDetectionServicer вместо AudioSpoofDetectorServicer
class AudioDetectionServicer(audio_spoof_pb2_grpc.AudioDetectionServicer): # ИЗМЕНЕНО: базовый класс
    """Реализация gRPC сервиса для детекции дипфейков."""

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
            self.redis_client.ping() # Проверка соединения
            print("Успешно подключено к Redis.")
        except redis.exceptions.ConnectionError as e:
            print(f"Ошибка подключения к Redis: {e}")
            # В зависимости от политики, сервер может не стартовать или работать в деградированном режиме
            # Для данного примера, сервер продолжит работу, но ProcessAudio будет возвращать ошибку
            self.redis_client = None # Явно указываем, что клиент не доступен

        # Инициализация клиента MinIO
        print(f"Подключение к MinIO: {MINIO_ENDPOINT}, bucket: {MINIO_BUCKET_NAME}, secure: {MINIO_SECURE}")
        try:
            self.minio_client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE
            )
            # Проверка существования бакета (опционально, но полезно)
            found = self.minio_client.bucket_exists(MINIO_BUCKET_NAME)
            if not found:
                print(f"Ошибка: Бакет MinIO '{MINIO_BUCKET_NAME}' не найден!")
                # В зависимости от политики, сервер может не стартовать
                # или ProcessAudio будет всегда возвращать ошибку, если бакет не найден.
                # Здесь мы просто выводим сообщение, но не прерываем запуск.
                # self.minio_client = None # Можно раскомментировать, если это критично для старта
            else:
                print(f"Успешно подключено к MinIO и бакет '{MINIO_BUCKET_NAME}' найден.")
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

    def _process_chunk_from_redis(self, request_id: str, chunk_idx: int) -> Tuple[str, audio_spoof_pb2.ChunkPrediction | None, str | None]:
        """
        Загружает чанк из Redis, выполняет предсказание и возвращает результат.
        Возвращает (chunk_id_str, ChunkPrediction, error_message)
        """
        chunk_key = f"{request_id}:chunk_{chunk_idx}"
        chunk_id_str = f"chunk_{chunk_idx}"
        try:
            chunk_data_bytes = self.redis_client.get(chunk_key)
            if chunk_data_bytes is None:
                print(f"Ошибка: Чанк {chunk_key} не найден в Redis.")
                return chunk_id_str, None, f"Chunk {chunk_key} not found in Redis"

            # Преобразование байтов обратно в тензор NumPy/PyTorch
            audio_data_np = np.frombuffer(chunk_data_bytes, dtype=np.float32)
            
            if audio_data_np.shape[0] != NUM_SAMPLES:
                error_msg = f"Ошибка: Чанк {chunk_key} имеет неверный размер. Ожидалось {NUM_SAMPLES}, получено {audio_data_np.shape[0]}."
                print(error_msg)
                return chunk_id_str, None, error_msg

            input_tensor = torch.from_numpy(audio_data_np).unsqueeze(0) # Добавляем batch dim [1, NUM_SAMPLES]
            
            score = self._predict_score_for_chunk_tensor(input_tensor)
            # print(f"Предсказание для {chunk_key}: score={score:.4f}")
            return chunk_id_str, audio_spoof_pb2.ChunkPrediction(score=score), None

        except Exception as e:
            error_msg = f"Ошибка обработки чанка {chunk_key}: {e}"
            print(error_msg)
            return chunk_id_str, None, error_msg


    # Это новый основной метод согласно README.md
    def ProcessAudio(self, request: audio_spoof_pb2.AudioDataRequest, context) -> audio_spoof_pb2.AudioDetectionResponse:
        """
        Обрабатывает полный аудиофайл: скачивает из MinIO, нарезает на чанки, 
        сохраняет в Redis, параллельно обрабатывает чанки и возвращает агрегированный результат.
        """
        # Изменено: получаем minio_object_key вместо audio_content
        print(f"Получен запрос ProcessAudio. request_id: {request.request_id}, filename: {request.original_filename}, minio_key: {request.minio_object_key}")

        if self.redis_client is None:
            error_msg = "Ошибка сервера: Redis недоступен."
            print(error_msg)
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details(error_msg)
            return audio_spoof_pb2.AudioDetectionResponse(request_id=request.request_id, error_message=error_msg)

        request_id = request.request_id
        chunk_predictions_map: Dict[str, audio_spoof_pb2.ChunkPrediction] = {}
        overall_error_message = [] # Собираем все ошибки обработки чанков

        try:
            # 1. Скачивание аудиофайла из MinIO
            audio_content_bytes = None
            if not request.minio_object_key:
                error_msg = "Ошибка запроса: minio_object_key не указан."
                print(error_msg)
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(error_msg)
                return audio_spoof_pb2.AudioDetectionResponse(request_id=request.request_id, error_message=error_msg)
            
            try:
                print(f"Загрузка файла из MinIO: bucket='{MINIO_BUCKET_NAME}', key='{request.minio_object_key}'")
                response_minio = self.minio_client.get_object(MINIO_BUCKET_NAME, request.minio_object_key)
                audio_content_bytes = response_minio.read()
            except S3Error as s3_err:
                error_msg = f"Ошибка MinIO при скачивании файла '{request.minio_object_key}': {s3_err}"
                print(error_msg)
                context.set_code(grpc.StatusCode.NOT_FOUND) # Или другой подходящий код
                context.set_details(error_msg)
                return audio_spoof_pb2.AudioDetectionResponse(request_id=request.request_id, error_message=error_msg)
            except Exception as e:
                error_msg = f"Неожиданная ошибка при скачивании файла из MinIO '{request.minio_object_key}': {e}"
                print(error_msg)
                context.set_code(grpc.StatusCode.INTERNAL)
                context.set_details(error_msg)
                return audio_spoof_pb2.AudioDetectionResponse(request_id=request.request_id, error_message=error_msg)
            finally:
                if 'response_minio' in locals() and response_minio:
                    response_minio.close()
                    response_minio.release_conn()
            
            if not audio_content_bytes:
                error_msg = f"Файл '{request.minio_object_key}' из MinIO пуст или не удалось прочитать."
                print(error_msg)
                context.set_code(grpc.StatusCode.INTERNAL) # Или NOT_FOUND
                context.set_details(error_msg)
                return audio_spoof_pb2.AudioDetectionResponse(request_id=request.request_id, error_message=error_msg)

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
                return audio_spoof_pb2.AudioDetectionResponse(request_id=request_id, error_message=error_msg)

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
            num_chunks = (total_samples + NUM_SAMPLES - 1) // NUM_SAMPLES # Округление вверх

            if num_chunks == 0 and total_samples > 0: # если аудио короче одного чанка, но не пустое
                num_chunks = 1
            elif total_samples == 0:
                error_msg = "Аудиофайл пуст или не содержит аудиоданных после предобработки."
                print(error_msg)
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(error_msg)
                return audio_spoof_pb2.AudioDetectionResponse(request_id=request_id, error_message=error_msg)


            print(f"Аудиофайл предобработан. Всего семплов: {total_samples}, будет чанков: {num_chunks}")

            chunk_indices_to_process = []

            # 2. Нарезка на чанки и сохранение в Redis
            for i in range(num_chunks):
                start_idx = i * NUM_SAMPLES
                end_idx = start_idx + NUM_SAMPLES
                current_chunk_tensor = signal[start_idx:end_idx]

                # Паддинг для последнего чанка, если он короче
                if current_chunk_tensor.shape[0] < NUM_SAMPLES:
                    pad_size = NUM_SAMPLES - current_chunk_tensor.shape[0]
                    current_chunk_tensor = torch.nn.functional.pad(current_chunk_tensor, (0, pad_size))
                
                # Конвертация тензора чанка в байты (float32)
                chunk_bytes_for_redis = current_chunk_tensor.numpy().astype(np.float32).tobytes()
                chunk_key = f"{request_id}:chunk_{i}"
                
                try:
                    self.redis_client.set(chunk_key, chunk_bytes_for_redis, ex=REDIS_CHUNK_EXPIRY_SECONDS)
                    chunk_indices_to_process.append(i)
                except redis.exceptions.RedisError as e:
                    err_msg = f"Ошибка сохранения чанка {chunk_key} в Redis: {e}"
                    print(err_msg)
                    overall_error_message.append(err_msg)
                    # Если не удалось сохранить чанк, его не нужно добавлять в обработку
            
            if not chunk_indices_to_process and num_chunks > 0 : # Если были чанки, но ни один не сохранился
                 error_msg_final = "; ".join(overall_error_message) if overall_error_message else "Failed to store any chunks in Redis."
                 context.set_code(grpc.StatusCode.INTERNAL)
                 context.set_details(error_msg_final)
                 return audio_spoof_pb2.AudioDetectionResponse(request_id=request_id, error_message=error_msg_final)


            # 3. Параллельная обработка чанков из Redis
            # Используем ThreadPoolExecutor, который уже есть в grpc.server
            # Для более гранулярного контроля можно создать свой
            # server = grpc.server(futures.ThreadPoolExecutor(max_workers=10)) - этот пул для обработки входящих gRPC запросов
            # Мы создадим новый для наших задач обработки чанков
            with futures.ThreadPoolExecutor(max_workers=min(10, num_chunks if num_chunks > 0 else 1)) as executor:
                # Future -> (request_id, chunk_idx)
                future_to_task_params = {
                    executor.submit(self._process_chunk_from_redis, request_id, idx): (request_id, idx)
                    for idx in chunk_indices_to_process
                }

                for future in futures.as_completed(future_to_task_params):
                    # req_id_done, chunk_idx_done = future_to_task_params[future]
                    try:
                        chunk_id_str, chunk_pred, error_msg_chunk = future.result()
                        if error_msg_chunk:
                            overall_error_message.append(f"Error for {chunk_id_str}: {error_msg_chunk}")
                        if chunk_pred:
                            chunk_predictions_map[chunk_id_str] = chunk_pred
                    except Exception as exc:
                        # req_id_err, chunk_idx_err = future_to_task_params[future]
                        # err_msg = f"Ошибка при обработке задачи для чанка {chunk_idx_err} запроса {req_id_err}: {exc}"
                        # Вместо этого, будем использовать информацию из _process_chunk_from_redis
                        # т.к. она более специфична. Если future.result() сам по себе вызвал исключение,
                        # это будет более общая ошибка.
                        params = future_to_task_params[future]
                        err_msg = f"Непредвиденная ошибка в потоке для чанка {params[1]} запроса {params[0]}: {exc}"
                        print(err_msg)
                        overall_error_message.append(err_msg)
            
            # 4. Опциональная очистка чанков из Redis
            # if chunk_indices_to_process: # Только если что-то было добавлено
            #     keys_to_delete = [f"{request_id}:chunk_{i}" for i in chunk_indices_to_process]
            #     try:
            #         self.redis_client.delete(*keys_to_delete)
            #     except redis.exceptions.RedisError as e:
            #         print(f"Ошибка удаления чанков из Redis для {request_id}: {e}")
            #         # Не критично для ответа клиенту, но стоит залогировать

            final_error_message_str = "; ".join(overall_error_message) if overall_error_message else ""
            
            if not chunk_predictions_map and num_chunks > 0 and not final_error_message_str:
                 final_error_message_str = "No chunk predictions could be made, though chunks were processed without explicit errors."
            elif not chunk_predictions_map and num_chunks > 0 and final_error_message_str:
                 # Ошибки уже есть, ничего не добавляем
                 pass


            print(f"Обработка ProcessAudio для {request_id} завершена. Предсказаний: {len(chunk_predictions_map)}. Ошибки: '{final_error_message_str}'")
            return audio_spoof_pb2.AudioDetectionResponse(
                request_id=request_id,
                chunk_predictions=chunk_predictions_map,
                error_message=final_error_message_str
            )

        except Exception as e:
            # Глобальный обработчик ошибок для ProcessAudio
            error_msg = f"Критическая ошибка в ProcessAudio для request_id {request.request_id}: {e}"
            print(error_msg)
            import traceback
            traceback.print_exc() # Для детального дебага в логах сервера
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(error_msg)
            return audio_spoof_pb2.AudioDetectionResponse(request_id=request.request_id, error_message=error_msg)

    # Старый метод PredictChunk больше не нужен в таком виде, так как его логика
    # инкапсулирована в _predict_score_for_chunk_tensor и _process_chunk_from_redis.
    # Если он определен в proto и ожидается, его нужно будет адаптировать или удалить из proto.
    # Пока что я его закомментирую, предполагая, что основным является ProcessAudio.
    # def PredictChunk(self, request, context):
    #     """Обрабатывает запрос на предсказание для одного чанка."""
    #     # ... старая реализация ...


def serve():
    """Запускает gRPC сервер."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10)) # Этот пул для gRPC вызовов

    # Создаем экземпляр нашего сервиса (модель загрузится в __init__)
    try:
        servicer = AudioDetectionServicer() # Используем новое имя класса
    except RuntimeError as e:
        print(f"Критическая ошибка при инициализации сервиса: {e}")
        return 

    # Убедитесь, что эта функция соответствует вашему xxx_pb2_grpc.py
    # Например, add_AudioDetectionServicer_to_server
    audio_spoof_pb2_grpc.add_AudioDetectionServicer_to_server(servicer, server) # ИЗМЕНЕНО: функция добавления

    print(f"Запуск gRPC сервера на {_SERVER_ADDRESS}...")
    server.add_insecure_port(_SERVER_ADDRESS)
    server.start()
    print("Сервер запущен. Нажмите Ctrl+C для остановки.")
    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except KeyboardInterrupt:
        print("Остановка сервера...")
        server.stop(grace=None) # Даем время на завершение текущих запросов
        print("Сервер остановлен.")

if __name__ == '__main__':
    # Перед запуском сервера, убедитесь, что Redis доступен,
    # и модель с чекпоинтом находятся в ожидаемых местах.
    serve()