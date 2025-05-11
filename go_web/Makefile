.PHONY: run build clean test docker-build docker-run docker-stop docker-logs setup-db

# Go variables
BINARY_NAME=auth_service
CMD_PATH=./cmd/server

# Docker variables
DOCKER_COMPOSE_FILE=docker-compose.yml
GO_SERVICE_NAME=go_app
DB_SERVICE_NAME=postgres_db

# Default target
all: build

run:
	@echo "Starting Go application..."
	@go run $(CMD_PATH)/main.go

build:
	@echo "Building Go application..."
	@go build -o $(BINARY_NAME) $(CMD_PATH)/main.go

clean:
	@echo "Cleaning up..."
	@rm -f $(BINARY_NAME)
	@go clean

test:
	@echo "Running tests..."
	@go test ./...

# Docker targets
docker-build:
	@echo "Building Docker images..."
	@docker-compose -f $(DOCKER_COMPOSE_FILE) build

docker-run:
	@echo "Starting Docker containers..."
	@docker-compose -f $(DOCKER_COMPOSE_FILE) up -d

docker-stop:
	@echo "Stopping Docker containers..."
	@docker-compose -f $(DOCKER_COMPOSE_FILE) down

docker-logs:
	@echo "Showing logs for Go service..."
	@docker-compose -f $(DOCKER_COMPOSE_FILE) logs -f $(GO_SERVICE_NAME)

docker-logs-db:
	@echo "Showing logs for DB service..."
	@docker-compose -f $(DOCKER_COMPOSE_FILE) logs -f $(DB_SERVICE_NAME)

# Database migration (placeholder - integrate your migration tool here)
# setup-db:
# 	@echo "Setting up database (running migrations)..."
# 	# Add your database migration commands here
# 	# Example: goose -dir ./migrations postgres "user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) host=$(DB_HOST) port=$(DB_PORT) sslmode=$(DB_SSLMODE)" up

# To initialize go.mod if it doesn't exist
init-mod:
	@if [ ! -f go.mod ]; then \
		echo "Initializing Go module..."; \
		go mod init github.com/yourusername/yourprojectname; \
	else \
		echo "go.mod already exists."; \
	fi

# To get dependencies
get-deps:
	@echo "Getting dependencies..."
	@go get github.com/gin-gonic/gin
	@go get github.com/jmoiron/sqlx
	@go get github.com/lib/pq
	@go get golang.org/x/crypto/bcrypt
	@go get github.com/golang-jwt/jwt/v5
	@go get github.com/joho/godotenv
	@go get go.uber.org/zap
	@go get github.com/aws/aws-sdk-go-v2/config
	@go get github.com/aws/aws-sdk-go-v2/service/s3
	@go get github.com/aws/aws-sdk-go-v2/credentials
	@go get github.com/aws/aws-sdk-go-v2
	@echo "Tidying dependencies..."
	@go mod tidy 