# inference_server.py
import torch
import torchaudio
from torch import nn
from transformers import AutoModel
import os
import numpy as np
import io # Для работы с байтами
import logging # Для логирования

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Константы ---
MODEL_CHECKPOINT = "microsoft/wavlm-base"
SAMPLE_RATE = 16000
NUM_SAMPLES = 4 * SAMPLE_RATE # 64000 samples (4 seconds)
CHECKPOINT_FILE = "chk2.pth" # Ожидается в той же директории

# --- Класс модели (без изменений) ---
class CustomWavLMForClassification(nn.Module):
    def __init__(self, checkpoint=MODEL_CHECKPOINT):
        super(CustomWavLMForClassification, self).__init__()
        if "base" not in checkpoint.lower():
             actual_checkpoint = "microsoft/wavlm-base"
             logging.info(f"Checkpoint '{checkpoint}' не содержит 'base'. Используется '{actual_checkpoint}'.")
        else:
            actual_checkpoint = checkpoint

        self.wavlm = AutoModel.from_pretrained(actual_checkpoint)
        self.hidden_size = self.wavlm.config.hidden_size
        self.pool_output_size = 128
        self.pool = nn.AdaptiveAvgPool1d(self.pool_output_size)
        self.linear = nn.Linear(self.hidden_size * self.pool_output_size, 1)

    def forward(self, waveforms):
        target_device = next(self.parameters()).device
        waveforms = waveforms.to(target_device)
        outputs = self.wavlm(input_values=waveforms)
        features = outputs.last_hidden_state
        x = features.transpose(1, 2)
        x = self.pool(x)
        x = x.reshape(x.shape[0], -1)
        x = self.linear(x)
        return x.squeeze(-1)

# --- Функция предобработки аудио (принимает байты) ---
def preprocess_audio_bytes(audio_bytes: bytes, target_sr: int = SAMPLE_RATE, num_samples: int = NUM_SAMPLES):
    """Загружает из байтов, ресемплирует, конвертирует в моно и обрезает/дополняет аудио."""
    try:
        # Используем io.BytesIO для чтения байтов как файла
        audio_stream = io.BytesIO(audio_bytes)
        # Указываем формат явно, т.к. читаем из байтов
        signal, sr = torchaudio.load(audio_stream)

        # 1. Ресемплинг
        if sr != target_sr:
            resampler = torchaudio.transforms.Resample(sr, target_sr)
            signal = resampler(signal)

        # 2. Моно
        if signal.shape[0] > 1:
            signal = torch.mean(signal, dim=0, keepdim=True)

        # 3. Обрезка / Паддинг
        length = signal.shape[1]
        if length > num_samples:
            # БЫЛО: signal = signal[:, :num_samples] # Обрезка с начала
            # СТАЛО (Центральная обрезка):
            start_idx = (length - num_samples) // 2
            signal = signal[:, start_idx : start_idx + num_samples]
        elif length < num_samples:
            pad_last_dim = (0, num_samples - length)
            signal = torch.nn.functional.pad(signal, pad_last_dim)

        # Убираем размерность канала -> [num_samples]
        return signal.squeeze(0)

    except Exception as e:
        logging.error(f"Ошибка обработки аудио байтов: {e}", exc_info=True) # Логируем traceback
        return None

# --- Функция загрузки модели (без изменений, кроме print -> logging) ---
def load_model_from_checkpoint(checkpoint_path: str, device: torch.device):
    """Инициализирует модель и загружает веса из файла чекпоинта."""
    if not os.path.exists(checkpoint_path):
        logging.error(f"Файл чекпоинта не найден: {checkpoint_path}")
        return None

    model = CustomWavLMForClassification(checkpoint=MODEL_CHECKPOINT)
    try:
        logging.info(f"Загрузка чекпоинта из: {checkpoint_path}...")
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)

        if 'model_state_dict' in checkpoint:
            model_state_dict = checkpoint['model_state_dict']
            logging.info("Найден 'model_state_dict' в чекпоинте.")
        elif isinstance(checkpoint, dict):
            model_state_dict = checkpoint
            logging.warning("Используется весь словарь чекпоинта как state_dict.")
        else:
             logging.error("Не удалось определить state_dict в чекпоинте.")
             return None

        model.load_state_dict(model_state_dict)
        logging.info("Веса модели успешно загружены.")
        model.to(device)
        model.eval()
        logging.info(f"Модель готова на устройстве: {device}")
        return model

    except Exception as e:
        logging.error(f"Ошибка при загрузке модели из {checkpoint_path}: {e}", exc_info=True)
        return None

# --- Функция для предсказания (принимает байты) ---
def predict_audio_bytes(audio_bytes: bytes, model: nn.Module, device: torch.device):
    """Выполняет предобработку (из байтов) и предсказание."""
    if not model:
        logging.error("Модель не передана в функцию predict_audio_bytes.")
        return None

    # 1. Предобработка из байтов
    processed_signal = preprocess_audio_bytes(audio_bytes)
    if processed_signal is None:
        # Ошибка уже залогирована в preprocess_audio_bytes
        return None

    # 2. Подготовка тензора [batch_size=1, num_samples]
    input_tensor = processed_signal.unsqueeze(0).to(device)

    # 3. Предсказание
    try:
        with torch.no_grad(): # Отключаем расчет градиентов
            # УБИРАЕМ Sigmoid, модель должна возвращать логиты
            logit = model(input_tensor)
        return torch.sigmoid(logit).item() # Возвращаем скалярное значение логита
    except Exception as e:
        logging.error(f"Ошибка во время инференса для файла: {e}", exc_info=True)
        return None

# --- Глобальные переменные для модели и устройства (загружаются один раз) ---
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL = None

def initialize_model():
    """Инициализирует и загружает модель глобально."""
    global MODEL, DEVICE
    logging.info(f"Используемое устройство: {DEVICE}")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    checkpoint_full_path = os.path.join(current_dir, CHECKPOINT_FILE)
    MODEL = load_model_from_checkpoint(checkpoint_full_path, DEVICE)
    if MODEL is None:
        logging.error("Инициализация модели не удалась!")
        # В реальном gRPC сервере здесь можно вызвать sys.exit(1) или обработать иначе
    else:
        logging.info("Модель успешно инициализирована.")

# --- Точка входа для тестирования (если нужно запустить отдельно) ---
if __name__ == "__main__":
    initialize_model() # Загружаем модель

    if MODEL:
        # --- УКАЖИТЕ ЗДЕСЬ ПУТЬ К ВАШЕМУ АУДИОФАЙЛУ ДЛЯ ТЕСТА ---
        test_audio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eng.mp3")
        # --------------------------------------------------------

        if not os.path.exists(test_audio_path):
             logging.error("-" * 30)
             logging.error("!!! ТЕСТОВЫЙ ФАЙЛ НЕ НАЙДЕН !!!")
             logging.error(f"Укажите реальный путь к аудиофайлу или поместите '{os.path.basename(test_audio_path)}' рядом со скриптом.")
             logging.error(f"Ожидаемый путь: {test_audio_path}")
             logging.error("-" * 30)
        else:
            logging.info(f"Тестирование модели на файле: {test_audio_path}")
            try:
                # Читаем файл в байты для теста функции predict_audio_bytes
                with open(test_audio_path, 'rb') as f:
                    audio_content_bytes = f.read()

                # Получаем логит
                logit_result = predict_audio_bytes(audio_content_bytes, MODEL, DEVICE)

                if logit_result is not None:
                    logging.info(f"  > Полученный логит: {logit_result:.4f}")
                    # Интерпретация логита (порог 0.0)
                    if logit_result > 0.4999:
                        # Логит > 0.0 -> Spoof (метка 1 в обучении)
                        logging.info("  > Предсказание: Spoof (вероятно, дипфейк)")
                    else:
                        # Логит <= 0.0 -> Bona fide (метка 0 в обучении)
                        logging.info("  > Предсказание: Bona fide (вероятно, настоящий)")
                else:
                    logging.warning("  > Не удалось получить предсказание для файла.")
            except Exception as e:
                logging.error(f"Ошибка при чтении или обработке тестового файла {test_audio_path}: {e}", exc_info=True)

    else:
        logging.error("Модель не была загружена. Тестирование невозможно.")

# --- Дальше здесь будет код для запуска gRPC сервера ---
# (Пример будет ниже)