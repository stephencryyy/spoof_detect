# test_client.py
import grpc
import audio_spoof_pb2  # Убедитесь, что этот файл доступен
import audio_spoof_pb2_grpc  # Убедитесь, что этот файл доступен
import uuid
import os # Для извлечения имени файла из ключа

# --- Настройки клиента ---
SERVER_ADDRESS = 'localhost:50052'
# ЗАМЕНИТЕ ЭТО на реальный ключ объекта (путь к файлу) в вашем MinIO бакете,
# который вы будете использовать для теста.
# Например, если файл в бакете называется "test_samples/sample1.wav"
TEST_MINIO_OBJECT_KEY = "test_audio_files/eng.mp3" # <--- ИЗМЕНЕНО: теперь это ключ в MinIO

def run_client(minio_key: str):
    """Отправляет запрос с ключом объекта MinIO на gRPC сервер и печатает ответ."""
    # Убрано чтение файла с диска, т.к. файл должен быть в MinIO
    
    try:
        with grpc.insecure_channel(SERVER_ADDRESS) as channel:
            stub = audio_spoof_pb2_grpc.AudioDetectionStub(channel)

            request_id = str(uuid.uuid4())
            # В качестве original_filename можно использовать имя файла из ключа MinIO
            original_filename = os.path.basename(minio_key) 

            print(f"Отправка запроса ProcessAudio...")
            print(f"  request_id: {request_id}")
            print(f"  original_filename: {original_filename}")
            print(f"  minio_object_key: {minio_key}") # <--- ИЗМЕНЕНО: передаем ключ MinIO

            # Формируем запрос согласно AudioDataRequest из .proto
            grpc_request = audio_spoof_pb2.AudioDataRequest(
                request_id=request_id,
                minio_object_key=minio_key, # <--- ИЗМЕНЕНО: используем minio_object_key
                original_filename=original_filename
            )

            # Вызываем удаленный метод ProcessAudio
            response = stub.ProcessAudio(grpc_request, timeout=300) # Таймаут 5 минут

            print("\n--- Ответ от сервера ---")
            print(f"Request ID: {response.request_id}")
            if response.error_message:
                print(f"Сообщение об ошибке: {response.error_message}")
            
            if response.chunk_predictions:
                print("Предсказания по чанкам:")
                for chunk_id, prediction in sorted(response.chunk_predictions.items()):
                    print(f"  {chunk_id}: score = {prediction.score:.4f}")
            else:
                print("Предсказания по чанкам отсутствуют.")

    except grpc.RpcError as e:
        print(f"gRPC ошибка во время вызова: {e.code()} ({e.code().name}) - {e.details()}")
    except Exception as e:
        print(f"Произошла неожиданная ошибка: {e}")

if __name__ == '__main__':
    if TEST_MINIO_OBJECT_KEY == "ЗАМЕНИТЕ_НА_ВАШ_КЛЮЧ_В_MINIO/test_audio.wav": # Пример условия
        print("Пожалуйста, отредактируйте TEST_MINIO_OBJECT_KEY в скрипте test_client.py, "
              "указав реальный ключ объекта (путь к файлу) в вашем MinIO бакете.")
    else:
        print(f"Клиент будет использовать ключ объекта MinIO: {TEST_MINIO_OBJECT_KEY}")
        print("Убедитесь, что файл по этому ключу существует в вашем MinIO бакете "
              "и что gRPC сервер настроен для доступа к этому MinIO.")
        run_client(TEST_MINIO_OBJECT_KEY)