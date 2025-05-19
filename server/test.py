import torchaudio
import torch

print(f"Torchaudio version: {torchaudio.__version__}")
print(f"PyTorch version: {torch.__version__}")
print(f"Torchaudio backends: {torchaudio.list_audio_backends()}")

# Попытка загрузить тестовый WebM файл (если у вас есть такой)
# или просто проверить, что torchaudio.load не падает на этапе импорта
# и что бэкенд ffmpeg доступен.

# Если у вас есть ffmpeg в PATH, попробуйте вызвать его:
import subprocess
try:
    result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=True)
    print("FFmpeg version found by system:")
    print(result.stdout.splitlines()[0]) # Первая строка обычно содержит версию
except FileNotFoundError:
    print("FFmpeg command not found in system PATH.")
except subprocess.CalledProcessError as e:
    print(f"Error running ffmpeg -version: {e}")

# Проверка, может ли torchaudio использовать ffmpeg
# Это не прямой API, но если бэкенд 'ffmpeg' есть в list_audio_backends(), это хороший знак.
# Если его нет, torchaudio не сможет его использовать.