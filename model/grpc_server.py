import grpc
from concurrent import futures
import time
import numpy as np
import torch
import os

# Импорт сгенерированного кода
import audio_spoof_pb2
import audio_spoof_pb2_grpc

# Импорт компонентов из inference.py
from inference import (
    load_model_from_checkpoint,
    CustomWavLMForClassification, # Нужен для type hinting и понимания
    CHECKPOINT_FILE,
    SAMPLE_RATE,
    NUM_SAMPLES,
    MODEL_CHECKPOINT # Добавим, чтобы он был доступен
)

# Константы для сервера
_ONE_DAY_IN_SECONDS = 60 * 60 * 24
_SERVER_ADDRESS = '[::]:50052' # ИЗМЕНЕНО: Слушать на порту 50052

class AudioSpoofDetectorService(audio_spoof_pb2_grpc.AudioSpoofDetectorServicer):
    """Реализация gRPC сервиса для детекции дипфейков."""

    def __init__(self):
        super().__init__()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Используемое устройство для инференса: {self.device}")

        # Определяем путь к чекпоинту относительно этого файла
        current_dir = os.path.dirname(os.path.abspath(__file__))
        checkpoint_full_path = os.path.join(current_dir, CHECKPOINT_FILE)

        print("Загрузка модели...")
        self.model = load_model_from_checkpoint(checkpoint_full_path, self.device)
        if self.model is None:
            raise RuntimeError("Не удалось загрузить модель. Сервер не может стартовать.")
        self.model.eval() # Убедимся, что модель в режиме инференса
        print("Модель успешно загружена и готова к работе.")

    def PredictChunk(self, request, context):
        """Обрабатывает запрос на предсказание для одного чанка."""
        print(f"Получен запрос PredictChunk. Размер данных: {len(request.audio_chunk_data)} байт.")
        try:
            # 1. Декодирование байтов в тензор NumPy/PyTorch
            # Предполагаем, что байты - это массив float32
            audio_data = np.frombuffer(request.audio_chunk_data, dtype=np.float32)

            # 2. Проверка размера (количество сэмплов)
            if audio_data.shape[0] != NUM_SAMPLES:
                error_msg = f"Ошибка: Ожидалось {NUM_SAMPLES} сэмплов, получено {audio_data.shape[0]}."
                print(error_msg)
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_details(error_msg)
                return audio_spoof_pb2.PredictResponse() # Пустой ответ

            # 3. Преобразование в тензор PyTorch и перемещение на устройство
            input_tensor = torch.from_numpy(audio_data).unsqueeze(0).to(self.device) # Добавляем batch dim

            # 4. Предсказание
            with torch.no_grad():
                logit = self.model(input_tensor) # Модель ожидает [batch, num_samples]

            logit_value = logit.item()
            print(f"Предсказание успешно выполнено. Логит: {logit_value:.4f}")

            # 5. Возвращение результата
            return audio_spoof_pb2.PredictResponse(logit=logit_value)

        except Exception as e:
            error_msg = f"Внутренняя ошибка сервера при обработке запроса: {e}"
            print(error_msg)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(error_msg)
            # В случае ошибки также возвращаем пустой ответ или можно определить
            # специальное значение/флаг в PredictResponse, если нужно
            return audio_spoof_pb2.PredictResponse()


def serve():
    """Запускает gRPC сервер."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # Создаем экземпляр нашего сервиса (модель загрузится в __init__)
    try:
        servicer = AudioSpoofDetectorService()
    except RuntimeError as e:
        print(f"Критическая ошибка при инициализации сервиса: {e}")
        return # Не запускаем сервер, если модель не загрузилась

    audio_spoof_pb2_grpc.add_AudioSpoofDetectorServicer_to_server(servicer, server)

    print(f"Запуск gRPC сервера на {_SERVER_ADDRESS}...")
    server.add_insecure_port(_SERVER_ADDRESS)
    server.start()
    print("Сервер запущен. Нажмите Ctrl+C для остановки.")
    try:
        while True:
            time.sleep(_ONE_DAY_IN_SECONDS)
    except KeyboardInterrupt:
        print("Остановка сервера...")
        server.stop(0)
        print("Сервер остановлен.")

if __name__ == '__main__':
    serve() 