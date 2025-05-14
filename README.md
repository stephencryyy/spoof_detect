# RealTone: Обнаружение Подделок Аудио с Помощью ИИ

RealTone — это полностековое приложение, предназначенное для обнаружения подделок в аудиофайлах с использованием модели машинного обучения. Оно включает в себя REST API бэкенд на Go, Python gRPC сервис для анализа аудио и фронтенд на Next.js/React для взаимодействия с пользователем.

## Возможности

*   **Аутентификация Пользователей:** Безопасная регистрация и вход пользователей.
*   **Загрузка Аудиофайлов:** Пользователи могут загружать аудиофайлы (WAV, MP3, OGG) для анализа.
*   **Обнаружение Подделок с Помощью ИИ:** Аудио анализируется Python gRPC сервисом с использованием модели на базе PyTorch/WavLM для выявления потенциальных подделок.
*   **Посегментный Анализ:** Аудио делится на сегменты (чанки), и каждый сегмент анализируется индивидуально.
*   **Интерактивный Фронтенд:**
    *   Отображает форму волны аудио и результаты анализа.
    *   Позволяет воспроизводить полный аудиофайл и отдельные проанализированные сегменты.
    *   Визуализирует вероятность подделки для каждого сегмента.
    *   Динамическая визуализация прогресса во время воспроизведения сегмента.
    *   Эксклюзивное управление воспроизведением (одновременно воспроизводится только один источник аудио).
*   **Сохранность Данных:** Пользовательские данные и метаданные файлов хранятся в PostgreSQL. Аудиофайлы хранятся в MinIO.
*   **Кэширование:** Python gRPC сервис использует Redis для кэширования аудиосегментов во время обработки.

## Обзор Архитектуры

Приложение состоит из трех основных частей:

1.  **Фронтенд (директория `go_web/frontend/`):**
    *   Создан с использованием Next.js, React, TypeScript и Tailwind CSS.
    *   Использует WaveSurfer.js для визуализации и воспроизведения аудио.
    *   Взаимодействует с Go REST API.
    *   Подробная информация в `frontend.md`.

2.  **Бэкенд - Go REST API (директория `go_web/`):**
    *   Создан на Go с использованием фреймворка Gin Gonic.
    *   Обрабатывает аутентификацию пользователей, загрузку файлов и взаимодействие с Python gRPC сервисом.
    *   Подключается к PostgreSQL для хранения метаданных и к MinIO для хранения файлов.
    *   Подробная информация в `backend.md`.

3.  **Бэкенд - Python gRPC Сервис (директория `server/`):**
    *   Создан на Python с использованием gRPC.
    *   Выполняет анализ аудио с использованием предварительно обученной модели машинного обучения (`chk3.pth`).
    *   Получает аудиофайлы из MinIO и использует Redis для кэширования промежуточных данных (аудиосегментов).
    *   Подробная информация в `backend.md`.

**Хранилища Данных:**

*   **PostgreSQL:** Хранит информацию о пользователях и метаданные аудиофайлов.
*   **MinIO:** S3-совместимое объектное хранилище для загруженных аудиофайлов.
*   **Redis:** Кэш в памяти, используемый Python gRPC сервисом.

Эти компоненты (за исключением Python gRPC сервиса в настоящее время) оркеструются с помощью Docker Compose.

## Предварительные Требования

Перед началом убедитесь, что у вас установлено следующее:

*   **Docker и Docker Compose:** Для запуска сервисов приложения. ([Установить Docker](https://docs.docker.com/get-docker/), [Установить Docker Compose](https://docs.docker.com/compose/install/))
*   **Go:** Версия 1.20 или выше (для Go REST API). ([Установить Go](https://golang.org/doc/install))
*   **Python:** Версия 3.9 или выше (для Python gRPC сервиса). ([Установить Python](https://www.python.org/downloads/))
*   **pip:** Установщик пакетов Python.
*   **Node.js и npm (или yarn):** Версия 18.x или выше (для фронтенда Next.js). ([Установить Node.js](https://nodejs.org/))
*   **protoc:** Компилятор Protocol Buffer. ([Установить protoc](https://grpc.io/docs/protoc-installation/))
    *   Убедитесь, что `protoc-gen-go` и `protoc-gen-go-grpc` установлены для Go:
        ```bash
        go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28
        go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.2
        # Убедитесь, что $GOPATH/bin добавлен в ваш PATH
        export PATH="$PATH:$(go env GOPATH)/bin"
        ```
*   **Git:** Для клонирования репозитория.

## Настройка Проекта и Локальный Запуск

### 1. Клонирование Репозитория

```bash
git clone <URL_репозитория>
cd <директория_репозитория>
```
Замените `<URL_репозитория>` и `<директория_репозитория>` на фактический URL и подходящее имя директории.

### 2. Настройка Бэкенда

#### 2.1. Конфигурация Окружения (`go_web/.env`)

Перейдите в директорию `go_web` и создайте файл `.env`, скопировав `env.example` (если он существует) или создав новый.
Этот файл настраивает Go приложение, базу данных, MinIO и Redis.

Пример содержимого `go_web/.env`:

```env
# Конфигурация Go приложения
GO_APP_PORT=8080
GIN_MODE=debug # или release
LOG_LEVEL=debug # debug, info, warn, error
JWT_SECRET=ваш_надежный_jwt_секретный_ключ # Измените это!
JWT_EXPIRATION_HOURS=72

# Конфигурация PostgreSQL
DB_HOST=postgres_db # Должно совпадать с именем сервиса в docker-compose.yml
DB_PORT=5432
DB_USER=ваш_пользователь_бд
DB_PASSWORD=ваш_пароль_бд
DB_NAME=имя_вашей_бд
DB_SSL_MODE=disable

# Конфигурация MinIO (S3)
S3_ENDPOINT=minio:9000 # Должно совпадать с именем сервиса и портом в docker-compose.yml
S3_ACCESS_KEY_ID=ваш_ключ_доступа_minio # например, minioadmin
S3_SECRET_ACCESS_KEY=ваш_секретный_ключ_minio # например, minioadmin
S3_USE_SSL=false
S3_BUCKET_NAME=realtone-audio-bucket # Выберите имя бакета

# Конфигурация Redis (в основном для Python gRPC сервиса, но Go может использовать его позже)
REDIS_HOST=redis_cache # Должно совпадать с именем сервиса в docker-compose.yml
REDIS_PORT=6379
REDIS_PASSWORD= # Опционально, если ваш Redis требует пароль

# Конфигурация Python gRPC сервиса (чтобы Go приложение могло к нему подключиться)
# Если Python gRPC запущен локально (не в Docker), а Go приложение в Docker:
PYTHON_GRPC_SERVICE_ADDR=host.docker.internal:50052
# Если Python gRPC также запущен в Docker в той же сети:
# PYTHON_GRPC_SERVICE_ADDR=python_grpc_service:50052 # (при необходимости измените имя сервиса)
# Если оба запущены локально без Docker:
# PYTHON_GRPC_SERVICE_ADDR=localhost:50052
```

**Важно:**
*   Обновите `JWT_SECRET`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY` на ваши собственные безопасные значения.
*   `DB_HOST`, `S3_ENDPOINT` и `REDIS_HOST` установлены в имена сервисов, определенные в `go_web/docker-compose.yml`. Это для связи *внутри* сети Docker.
*   `PYTHON_GRPC_SERVICE_ADDR` требует внимательной настройки в зависимости от того, как вы запускаете Python gRPC сервис относительно Docker-контейнера с Go сервисом. `host.docker.internal:50052` — распространенный выбор для Docker Desktop (Windows/Mac), когда Python сервис запущен непосредственно на хост-машине.

#### 2.2. Docker Сервисы (PostgreSQL, MinIO, Redis, Go App)

Файл `go_web/docker-compose.yml` определяет сервисы Go приложения, PostgreSQL, MinIO и Redis.

Для запуска этих сервисов:

```bash
cd go_web
docker-compose up -d --build
```

*   Эта команда соберет образ `go_app` (если он еще не собран или если `Dockerfile` изменился) и запустит все сервисы в фоновом режиме (`-d`).
*   Данные PostgreSQL будут храниться в Docker-томе с именем `postgres_data`.
*   Данные MinIO будут храниться в Docker-томе с именем `minio_data`.
*   Данные Redis будут храниться в Docker-томе с именем `redis_data`.

**Проверка Docker Сервисов:**

*   **Go App:** Должен быть доступен по адресу `http://localhost:ВАШ_GO_APP_PORT` (например, `http://localhost:8080`).
*   **PostgreSQL:** Go приложение будет подключаться к нему внутренне. Вы можете подключиться с помощью клиента БД к `localhost:ВАШ_DB_PORT` (например, `localhost:5432`) с учетными данными из `.env`.
*   **MinIO Console:** Доступна по адресу `http://localhost:9001` (порт консоли MinIO по умолчанию согласно `docker-compose.yml`). Войдите с `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY`. Возможно, вам потребуется вручную создать бакет, указанный в `S3_BUCKET_NAME` (например, `realtone-audio-bucket`) через консоль MinIO или убедиться, что Go приложение создает его при запуске.
*   **Redis:** Python сервис будет подключаться к нему.

#### 2.3. Генерация Protobuf Стабов

Определения Protobuf находятся в директории `proto/`.

**Для Go (`go_web/`):**

```bash
# Убедитесь, что вы находитесь в корневой директории проекта
cd /c/tmoz/tmozProjects/spoof_detect # Или корневая директория вашего проекта
protoc --go_out=./go_web/gen/proto --go_opt=paths=source_relative \
       --go-grpc_out=./go_web/gen/proto --go-grpc_opt=paths=source_relative \
       proto/audio_analyzer.proto
```
Это сгенерирует Go стабы в `go_web/gen/proto/`. Убедитесь, что опция `go_package` в вашем `.proto` файле установлена правильно (например, `option go_package = "example.com/auth_service/gen/proto";`). Путь в `go_out` и `go-grpc_out` должен соответствовать этому или местоположению, из которого ваш Go проект может его импортировать.

**Для Python (`server/`):**

Сначала установите инструменты gRPC для Python, если вы еще этого не сделали:
```bash
pip install grpcio grpcio-tools
```

Затем сгенерируйте Python стабы (запускать из корневой директории проекта):
```bash
# Убедитесь, что вы находитесь в корневой директории проекта
cd /c/tmoz/tmozProjects/spoof_detect # Или корневая директория вашего проекта
python -m grpc_tools.protoc -I./proto --python_out=./server --grpc_python_out=./server ./proto/audio_analyzer.proto
```
Это сгенерирует `audio_analyzer_pb2.py` и `audio_analyzer_pb2_grpc.py` в директории `server/`.

#### 2.4. Python gRPC Сервис (`server/`)

Этот сервис в настоящее время **не** является частью `docker-compose.yml` и должен запускаться отдельно, обычно на вашей хост-машине.

**1. Перейдите в директорию Python сервера:**
```bash
cd server
```

**2. Создайте виртуальное окружение Python (рекомендуется):**
```bash
python -m venv venv
source venv/bin/activate  # В Windows: venv\Scripts\activate
```

**3. Установите зависимости Python:**
Убедитесь, что у вас есть файл `requirements.txt` в директории `server/`.
Пример `server/requirements.txt`:
```txt
grpcio
grpcio-tools
torch
torchaudio
numpy
librosa # Для ресемплинга, если не обрабатывается torchaudio напрямую, или другой обработки аудио
redis
minio
python-dotenv # Если вы используете .env для конфигурации python
# Добавьте любые другие специфичные версии или зависимости, требуемые вашей моделью
# например, transformers, fairseq (если WavLM загружается через fairseq)
```

Установите их:
```bash
pip install -r requirements.txt
```
*Примечание: Установка `torch` и `torchaudio` иногда может быть сложной. Обратитесь к официальному сайту PyTorch за конкретными командами установки для вашей ОС и версии CUDA, если вы планируете использовать GPU: [https://pytorch.org/get-started/locally/](https://pytorch.org/get-started/locally/)*

**4. Настройте переменные окружения для Python сервиса:**
Python gRPC серверу (`grpc_server.py`) потребуются переменные окружения для MinIO, Redis и путей к модели. Вы можете установить их непосредственно в вашей оболочке или использовать файл `.env` в директории `server/` и загрузить его с помощью `python-dotenv` в вашем скрипте.

Пример `server/.env`:
```env
MINIO_ENDPOINT=localhost:9000 # Если MinIO доступен хосту из Docker
MINIO_ACCESS_KEY=ваш_ключ_доступа_minio # Должен совпадать с go_web/.env
MINIO_SECRET_KEY=ваш_секретный_ключ_minio # Должен совпадать с go_web/.env
MINIO_USE_SSL=False
MINIO_BUCKET_NAME=realtone-audio-bucket # Должен совпадать с go_web/.env

REDIS_HOST=localhost # Если Redis доступен хосту из Docker
REDIS_PORT=6379
# REDIS_PASSWORD= # если вы установили пароль

MODEL_PATH=./chk3.pth # Путь к вашему файлу чекпоинта модели ML
# Другие специфичные настройки Python
PYTHON_GRPC_PORT=50052
```
**Важно:**
*   `MINIO_ENDPOINT`: Если MinIO запущен в Docker и порт 9000 доступен хосту, `localhost:9000` будет правильным значением для Python сервиса, запущенного на хосте.
*   `REDIS_HOST`: Аналогично, `localhost`, если Redis доступен из Docker.
*   Убедитесь, что `MODEL_PATH` указывает на ваш фактический файл модели (`chk3.pth`). Возможно, вам потребуется загрузить или разместить этот файл в директории `server/`.

**5. Запустите Python gRPC Сервер:**
```bash
python grpc_server.py
```
Сервер должен запуститься и слушать на настроенном порту (например, `0.0.0.0:50052`).

### 3. Настройка Фронтенда (`go_web/frontend/`)

**1. Перейдите в директорию фронтенд-приложения:**
```bash
cd go_web/frontend
```

**2. Установите зависимости Node.js:**
```bash
npm install
# или
# yarn install
```

**3. Настройте переменные окружения (Опционально, но рекомендуется):**
Создайте файл `.env.local` в корне вашего Next.js приложения (`go_web/frontend/`) для клиентских переменных окружения.
Пример `go_web/frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
# Это должно совпадать с портом, на котором запущен ваш Go API (из go_web/.env GO_APP_PORT)
```
Ваш фронтенд-код (например, `lib/api.ts`) затем будет использовать `process.env.NEXT_PUBLIC_API_BASE_URL` для вызовов API.

**4. Запустите сервер разработки Next.js:**
```bash
npm run dev
# или
# yarn dev
```
Фронтенд-приложение обычно должно быть доступно по адресу `http://localhost:3000`.

### 4. Запуск Всего Стека (Порядок операций из Корневой Директории Проекта)

Предположим, ваш корневой каталог проекта — `/c/tmoz/tmozProjects/spoof_detect`.

**1. Запустите Docker Сервисы (Go App, PostgreSQL, MinIO, Redis):**
```bash
cd /c/tmoz/tmozProjects/spoof_detect/go_web
docker-compose up -d --build
```

**2. Запустите Python gRPC Сервис:**
```bash
cd /c/tmoz/tmozProjects/spoof_detect/server
source venv/bin/activate # Или venv\Scripts\activate в Windows
python grpc_server.py
```
*(Оставьте это окно терминала открытым и работающим)*

**3. Запустите Фронтенд Next.js:**
```bash
cd /c/tmoz/tmozProjects/spoof_detect/go_web/frontend
npm run dev # или yarn dev
```
*(Оставьте это окно терминала открытым и работающим)*

**Доступ к Сервисам:**
*   **Фронтенд Приложение:** `http://localhost:3000`
*   **Go API (прямой доступ, в основном для тестирования):** `http://localhost:8080` (или ваш `GO_APP_PORT`)
*   **MinIO Console:** `http://localhost:9001` (или ваш `MINIO_CONSOLE_PORT`)

**Напоминание о Потоке Взаимодействия:**
*   Фронтенд (`localhost:3000`) вызывает Go API (`localhost:8080`).
*   Go API (в Docker) вызывает Python gRPC сервис (`host.docker.internal:50052` на хост-машине).
*   Python gRPC сервис (на хосте) вызывает MinIO (`localhost:9000`, доступный из Docker) и Redis (`localhost:6379`, доступный из Docker).

## Обзор Структуры Проекта

```
/c/tmoz/tmozProjects/spoof_detect/
│
├── go_web/                          # Go REST API Бэкенд и Фронтенд
│   ├── cmd/server/main.go           # Точка входа для Go API
│   ├── internal/                    # Внутренние пакеты Go API
│   ├── pkg/                         # Публичные пакеты Go API (если есть)
│   ├── gen/proto/                   # Сгенерированные Go protobuf стабы
│   ├── audiotests/                  # Тестовые аудиофайлы (если применимо)
│   ├── scripts/init.sql             # Скрипт инициализации PostgreSQL
│   ├── Dockerfile                   # Dockerfile для Go приложения (API)
│   ├── docker-compose.yml           # Docker Compose для Go, БД, MinIO, Redis
│   ├── go.mod
│   ├── go.sum
│   ├── Makefile
│   ├── README.md                    # README для go_web
│   ├── .env.example                 # Пример env для Go бэкенда (СОЗДАЙТЕ .env)
│   └── frontend/                    # Next.js Фронтенд Приложение
│       ├── app/                     # Директория Next.js App Router
│       ├── components/              # React компоненты
│       ├── lib/                     # Вспомогательные утилиты, API клиенты
│       ├── public/                  # Статические ассеты
│       ├── hooks
│       ├── package.json
│       ├── package-lock.json        # (генерируется npm/yarn)
│       └── styles
|
│
├── server/                          # Python gRPC Сервис
│   ├── grpc_server.py               # Реализация gRPC сервера
│   ├── inference.py                 # Логика инференса ML модели
│   ├── audio_analyzer_pb2.py        # Сгенерированные Python protobuf стабы
│   ├── audio_analyzer_pb2_grpc.py   # Сгенерированные Python gRPC стабы
│   ├── audio_analyzer_pb2.pyi       # Python тайпинги для protobuf
│   ├── chk3.pth                     # Чекпоинт ML модели (MODEL_PATH в .env должен указывать сюда)
│   └── .env.example                 # Пример env для Python сервера (СОЗДАЙТЕ .env)
│
├── model/                           # Исходный код/обучение ML Модели (если применимо)
│   ├── main.py
│   └── __init__.py
│
├── proto/                           # Protobuf определения
│   ├── audio_analyzer.proto
│   └── __init__.py
│
├── .gitattributes
├── .gitignore
├── backend.md                       # Подробная документация по бэкенду
├── frontend.md                      # Подробная документация по фронтенду
├── LICENSE                          # Лицензия проекта
├── README.md                        # Этот README файл
├── requirements.txt                 # Зависимости Python для проекта (например, для model/)
└── .vscode/                         # Конфигурация VSCode (опционально для включения в список)
```

## API Эндпоинты (Go REST API)

(Обратитесь к `go_web/internal/handlers/` и `go_web/cmd/server/main.go` для подробных маршрутов)

*   `POST /api/v1/users/register`: Регистрация пользователя.
*   `POST /api/v1/users/login`: Вход пользователя.
*   `POST /api/v1/audio/upload`: Загрузка аудиофайла для анализа (требует JWT аутентификации).

## Сводка Переменных Окружения

Убедитесь, что все необходимые `.env` файлы (`go_web/.env`, `server/.env`, `go_web/frontend/.env.local`) правильно настроены согласно примерам и вашей локальной конфигурации. Обратите особое внимание на:

*   Порты для каждого сервиса.
*   Учетные данные и имена хостов для базы данных, MinIO, Redis.
*   `PYTHON_GRPC_SERVICE_ADDR` в `go_web/.env` для обеспечения доступа Docker-контейнера с Go приложением к локально запущенному Python gRPC сервису.
*   `MINIO_ENDPOINT` и `REDIS_HOST` в `server/.env` для обеспечения доступа Python сервиса к Docker-контейнерам MinIO/Redis (обычно через `localhost:PORT`, так как порты проброшены).
*   `NEXT_PUBLIC_API_BASE_URL` в `go_web/frontend/.env.local` для указания фронтенду на Go API.

Создайте эти файлы `.env` из соответствующих файлов `.env.example` или `.env.local.example`, если они существуют, или создайте их с нуля на основе приведенных выше примеров.

## Устранение Распространенных Проблем

*   **`connection refused` для gRPC/БД/Redis:**
    *   Проверьте, что целевой сервис (Python gRPC, PostgreSQL, Redis, MinIO) запущен.
    *   Проверьте имена хостов и порты в переменных окружения.
        *   Сервисы внутри сети `docker-compose.yml` взаимодействуют, используя имена сервисов (например, `postgres_db`, `minio`, `redis_cache`).
        *   Сервисы, запущенные на хост-машине и доступные из Docker, используют `host.docker.internal` (Docker Desktop) или IP-адрес хоста.
        *   Сервисы в Docker, доступные с хоста, используют `localhost` и проброшенный порт.
*   **Python `ModuleNotFoundError`:** Убедитесь, что ваше виртуальное окружение активировано и команда `pip install -r requirements.txt` выполнена успешно.
*   **Ошибки генерации Protobuf:**
    *   Убедитесь, что `protoc`, `protoc-gen-go` и `protoc-gen-go-grpc` установлены и находятся в вашем `PATH`.
    *   Проверьте опцию `go_package` в `.proto` файле и пути вывода в командах генерации.
    *   Для Go убедитесь, что `$(go env GOPATH)/bin` добавлен в ваш `PATH`.
*   **Файл/Модель не найдена (`chk3.pth`):** Убедитесь, что файл модели находится в правильном месте (например, `server/chk3.pth`) или обновите `MODEL_PATH` в `server/.env`.
*   **Ошибки CORS на фронтенде:** Убедитесь, что Go Gin API имеет настроенное соответствующее CORS middleware (обычно разрешает запросы с `http://localhost:3000` в режиме разработки).
*   **Проблемы с бакетом MinIO:** Убедитесь, что бакет S3 (`realtone-audio-bucket` или ваше настроенное имя) существует в MinIO. Go приложение может пытаться создать его, но вы также можете создать его вручную через консоль MinIO (`http://localhost:9001`).
*   **Команды PowerShell vs. BASH:** Предоставленные команды BASH (например, `source venv/bin/activate`, `export PATH=...`) потребуют адаптации для PowerShell в Windows (например, `venv\Scripts\activate`, `$env:PATH += ";$(go env GOPATH)/bin"`). Рассмотрите возможность использования WSL (Windows Subsystem for Linux) для более согласованного опыта работы с BASH.

## Будущие Улучшения (из предыдущих обсуждений)

*   **Интеграция Python gRPC сервиса в Docker Compose:** Для полностью контейнеризированного развертывания.
*   **RabbitMQ для Асинхронной Обработки:** Разделение анализа аудио от цикла HTTP запрос/ответ для лучшей отказоустойчивости и масштабируемости.
*   **Надлежащая Аутентификация Пользователей на Фронтенде:** Замена мокового JWT на реальные вызовы входа и безопасную обработку токенов.
*   **Комплексное Тестирование:** Модульные, интеграционные и сквозные тесты.

## Лицензия

Укажите здесь лицензию вашего проекта (например, MIT, Apache 2.0). Если еще не определились, рассмотрите возможность добавления.

---

Этот README предоставляет исчерпывающее руководство по настройке и запуску проекта RealTone. Обратитесь к `backend.md` и `frontend.md` для более подробного архитектурного понимания соответствующих компонентов.
