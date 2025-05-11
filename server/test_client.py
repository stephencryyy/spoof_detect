# test_client.py
import grpc
import audio_analyzer_pb2
import audio_analyzer_pb2_grpc
import os # Для извлечения имени файла из ключа (если понадобится для original_filename)

# --- Настройки клиента ---
SERVER_ADDRESS = 'localhost:50052'

# ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ на реальные для вашего тестового MinIO
TEST_MINIO_BUCKET_NAME = "your-audio-bucket"  # <--- ИЗМЕНЕНО: Имя бакета
TEST_MINIO_OBJECT_KEY = '143559d7-cccb-4fbd-9d81-378ccb230225/1746978453204463837/байдену_сложно_сформулировать_свои_мысли.mp3' # <--- ИЗМЕНЕНО: Ключ объекта в MinIO
                                                # Убедитесь, что этот файл существует в указанном бакете

def run_client(bucket_name: str, object_key: str):
    """Отправляет запрос с информацией о файле в MinIO на gRPC сервер и печатает ответ."""
    
    try:
        with grpc.insecure_channel(SERVER_ADDRESS) as channel:
            # ИЗМЕНЕНО: используем AudioAnalysisStub
            stub = audio_analyzer_pb2_grpc.AudioAnalysisStub(channel)

            print(f"Отправка запроса AnalyzeAudio...")
            print(f"  minio_bucket_name: {bucket_name}")
            print(f"  minio_object_key: {object_key}")

            # Формируем запрос согласно AnalyzeAudioRequest из .proto
            # original_filename и request_id больше не являются частью запроса к Python-сервису
            # task_id был опциональным и пока закомментирован в .proto
            grpc_request = audio_analyzer_pb2.AnalyzeAudioRequest(
                minio_bucket_name=bucket_name,
                minio_object_key=object_key
            )

            # Вызываем удаленный метод AnalyzeAudio
            response = stub.AnalyzeAudio(grpc_request, timeout=300) # Таймаут 5 минут

            print("\n--- Ответ от сервера ---")
            # request_id больше не приходит в ответе
            if response.error_message:
                print(f"Сообщение об ошибке: {response.error_message}")
            
            # ИЗМЕНЕНО: поле predictions теперь map<string, float>
            if response.predictions:
                print("Предсказания по чанкам:")
                # Сортируем по ключу (chunk_id) для консистентного вывода
                for chunk_id, score_value in sorted(response.predictions.items()): 
                    print(f"  {chunk_id}: score = {score_value:.4f}")
            else:
                print("Предсказания по чанкам отсутствуют (или была ошибка).")

    except grpc.RpcError as e:
        print(f"gRPC ошибка во время вызова: {e.code()} ({e.code().name}) - {e.details()}")
    except Exception as e:
        print(f"Произошла неожиданная ошибка: {e}")

if __name__ == '__main__':
    # Простое условие для напоминания о настройке
    if TEST_MINIO_BUCKET_NAME == "your-audio-bucket" and TEST_MINIO_OBJECT_KEY == "test_samples/sample.wav":
        print(f"Клиент использует тестовые значения по умолчанию: ")
        print(f"  Бакет: {TEST_MINIO_BUCKET_NAME}")
        print(f"  Ключ объекта: {TEST_MINIO_OBJECT_KEY}")
        print("Пожалуйста, убедитесь, что эти значения корректны для вашего тестового MinIO, "
              "или измените их в скрипте test_client.py.")
        print("Файл по указанному ключу должен существовать в бакете.")
    
    print(f"Клиент будет использовать бакет: '{TEST_MINIO_BUCKET_NAME}' и ключ: '{TEST_MINIO_OBJECT_KEY}'")
    print("Убедитесь, что gRPC сервер (server/grpc_server.py) запущен и настроен для доступа к этому MinIO.")
    run_client(TEST_MINIO_BUCKET_NAME, TEST_MINIO_OBJECT_KEY)