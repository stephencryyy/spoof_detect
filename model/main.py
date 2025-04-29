# Стандартные библиотеки
import torch
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from tqdm.notebook import tqdm # Используем tqdm.notebook для Kaggle/Colab
import json
from torch import nn, optim
import torchaudio
import os
import random
import gc
import pandas as pd # Для чтения метаданных 2021
from datetime import datetime
import time # Для замера времени

# Библиотеки для машинного обучения
from torch.utils.data import DataLoader, Dataset, random_split, WeightedRandomSampler
from transformers import AutoConfig, AutoModel, Wav2Vec2FeatureExtractor
from sklearn.model_selection import train_test_split # Для разделения данных 2021
from sklearn.metrics import (
    roc_auc_score, roc_curve, f1_score, classification_report,
    confusion_matrix, ConfusionMatrixDisplay, precision_score, recall_score
)
import seaborn as sns # Для Confusion Matrix 