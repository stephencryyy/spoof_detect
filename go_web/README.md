# Project Title

This project consists of a Go REST API for user registration and authentication, and a Python gRPC stub for audio processing.

## Go REST API

Handles user registration and login, storing user data in a PostgreSQL database.

### Features

- User registration (`/api/v1/users/register`)
- User login (`/api/v1/users/login`)
- JWT-based authentication
- Password hashing with bcrypt
- PostgreSQL database integration using sqlx
- Gin HTTP framework

### Project Structure

- `cmd/server`: Main application
- `internal/auth`: Authentication logic
- `internal/config`: Configuration
- `internal/database`: Database interactions
- `internal/handlers`: HTTP handlers
- `internal/middleware`: Request middleware
- `internal/models`: Data models
- `pkg/logger`: Logging utilities
- `pkg/utils`: Common utility functions

## Python gRPC Service (Stub)

A stub service that accepts audio data and returns results in a predefined format.

(Details to be added)

## Setup and Running the Project (Local Development with Docker)

This guide explains how to set up and run the Go REST API, PostgreSQL database, and MinIO storage using Docker Compose.

### Prerequisites

*   **Docker Desktop**: Ensure Docker Desktop (or Docker Engine + Docker Compose) is installed and running on your system.
*   **Git**: For cloning the repository (if applicable).
*   **Code Editor**: Like VS Code, GoLand, etc.

### Steps

1.  **Clone the Repository (if needed):**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Configure Environment Variables:**
    *   Copy the example environment file: `cp .env.example .env` (or create `.env` manually).
    *   **Edit the `.env` file** and provide necessary values:
        *   `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Credentials for the PostgreSQL database.
        *   `JWT_SECRET_KEY`: A long, random, secret string for signing JWT tokens. **Generate a new secure key!**
        *   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: Credentials for MinIO access (e.g., `minioadmin`/`minioadmin` for default local setup).
        *   `S3_BUCKET_NAME`: The name of the bucket you want to use in MinIO (e.g., `your-audio-bucket`).
        *   `S3_ENDPOINT`: Should be `http://minio:9000` when running with the provided docker-compose setup.
        *   `S3_USE_PATH_STYLE`: Set to `true` for MinIO.
        *   (Optional) Adjust `GO_APP_PORT`, `DB_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` if needed.

3.  **Build and Start Services:**
    *   Open a terminal in the project's root directory.
    *   Run the following command. This will build the Go application image, download PostgreSQL and MinIO images (if not already present), and start all three containers in detached mode (`-d`).
        ```bash
        docker-compose up -d --build
        ```
    *   Wait for the containers to start. You can check their status with `docker ps`.

4.  **Create MinIO Bucket (One-time setup):**
    *   Open your web browser and navigate to the MinIO console URL (usually `http://localhost:9001` based on the default `MINIO_CONSOLE_PORT`).
    *   Log in using the `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` you set in the `.env` file.
    *   Navigate to the "Buckets" section.
    *   Create a new bucket with the exact name you specified for `S3_BUCKET_NAME` in your `.env` file.

5.  **Verify Services:**
    *   **Go API:** Should be accessible at `http://localhost:<GO_APP_PORT>` (e.g., `http://localhost:8080`). Try accessing the `/ping` endpoint:
        ```bash
        curl http://localhost:8080/ping 
        # Expected output: {"message":"pong"}
        ```
    *   **PostgreSQL:** The Go API should connect automatically. You can check logs (`docker-compose logs postgres_db_auth`) or connect using a DB client if needed.
    *   **MinIO:** Accessible via the console (`http://localhost:9001`) and the API endpoint (`http://localhost:9000`).

6.  **Testing the API:**
    *   Use `curl` or a tool like Postman to test the API endpoints:
        *   `POST /api/v1/users/register`
        *   `POST /api/v1/users/login` (to get a JWT token)
        *   `POST /api/v1/audio/upload` (requires a valid JWT token in the `Authorization: Bearer <token>` header and a file sent as multipart/form-data with the field name `audiofile`).

### Stopping the Services

*   To stop all running services defined in the `docker-compose.yml` file, run:
    ```bash
    docker-compose down
    ```
*   To stop and remove the data volumes (PostgreSQL data, MinIO data), run:
    ```bash
    docker-compose down -v 
    ```
    **Warning:** This will delete all data stored by PostgreSQL and MinIO.

### Useful Commands

*   **View Logs:**
    *   `docker-compose logs go_auth_service` (or `make docker-logs`)
    *   `docker-compose logs postgres_db_auth` (or `make docker-logs-db`)
    *   `docker-compose logs minio_storage`
    *   `docker-compose logs -f <service_name>` (to follow logs in real-time)
*   **Rebuild & Restart a Specific Service:**
    ```bash
    docker-compose up -d --build --force-recreate <service_name>
    # e.g., docker-compose up -d --build --force-recreate go_auth_service
    ```
*   **Execute Command in a Container:**
    ```bash
    docker exec -it <container_name> <command>
    # e.g., docker exec -it postgres_db_auth psql -U youruser -d yourdbname
    # e.g., docker exec -it go_auth_service /bin/sh
    ``` 