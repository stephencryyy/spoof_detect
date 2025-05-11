# Stage 1: Build the Go application
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum files to download dependencies
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=0 for static linking, GOOS=linux for Linux binary
# -ldflags "-s -w" to strip debug information and reduce binary size
RUN CGO_ENABLED=0 GOOS=linux go build -a -ldflags "-s -w" -o auth_service ./cmd/server/main.go

# Stage 2: Create the final lightweight image
FROM alpine:latest

WORKDIR /root/

# Copy the built binary from the builder stage
COPY --from=builder /app/auth_service .

# Copy .env file (optional, consider security implications for production)
# COPY .env .env

# Expose port (must match the port the app listens on)
EXPOSE 8080

# Command to run the application
CMD ["./auth_service"] 