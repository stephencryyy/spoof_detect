package config

import (
	"fmt"
	"os"
	"strconv"
	// "github.com/joho/godotenv"
	// "your_project_module_path/internal/database" // If DBConfig is defined there
)

// Config holds all configuration for the application.
// Values are loaded from environment variables.
type Config struct {
	AppPort   string
	Database  DatabaseConfig // Renamed from internal/database.DBConfig to avoid import cycle if that was moved here
	JWT       JWTConfig
	LogLevel  string   // e.g., "debug", "info", "warn", "error"
	LogFormat string   // e.g., "json", "console"
	S3        S3Config // New S3 config section
}

// DatabaseConfig holds database connection parameters.
// Duplicates internal/database.DBConfig if you keep it there.
// Choose one place to define this struct (either here or in internal/database).
// If defined here, internal/database would import this config package.
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// JWTConfig holds JWT related configuration.
type JWTConfig struct {
	SecretKey       string
	ExpirationHours int
}

// S3Config holds S3/MinIO client configuration.
type S3Config struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	Region          string
	UsePathStyle    bool // For MinIO, this is often true
}

// Load loads configuration from environment variables.
// It loads .env file first if present.
func Load() (*Config, error) {
	// Attempt to load .env file. Errors are not fatal here, as env vars might be set directly.
	// if err := godotenv.Load(); err != nil {
	// 	fmt.Println("No .env file found or error loading it, relying on OS environment variables.")
	// }

	appPort := getEnv("GO_APP_PORT", "8080")

	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "password")
	dbName := getEnv("DB_NAME", "auth_db")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")

	jwtSecret := getEnv("JWT_SECRET_KEY", "a-very-secret-key-that-should-be-long-and-random")
	jwtExpStr := getEnv("JWT_EXPIRATION_HOURS", "24")
	jwtExp, err := strconv.Atoi(jwtExpStr)
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRATION_HOURS: %w", err)
	}

	logLevel := getEnv("LOG_LEVEL", "info")
	logFormat := getEnv("LOG_FORMAT", "console") // "json" or "console"

	// S3/MinIO Config
	s3Endpoint := getEnv("S3_ENDPOINT", "http://localhost:9000")
	s3AccessKeyID := getEnv("S3_ACCESS_KEY_ID", "")
	s3SecretAccessKey := getEnv("S3_SECRET_ACCESS_KEY", "")
	s3BucketName := getEnv("S3_BUCKET_NAME", "default-bucket")
	s3Region := getEnv("S3_REGION", "us-east-1")
	s3UsePathStyleStr := getEnv("S3_USE_PATH_STYLE", "false")
	s3UsePathStyle, err := strconv.ParseBool(s3UsePathStyleStr)
	if err != nil {
		return nil, fmt.Errorf("invalid S3_USE_PATH_STYLE value: %s, error: %w", s3UsePathStyleStr, err)
	}

	return &Config{
		AppPort: appPort,
		Database: DatabaseConfig{
			Host:     dbHost,
			Port:     dbPort,
			User:     dbUser,
			Password: dbPassword,
			DBName:   dbName,
			SSLMode:  dbSSLMode,
		},
		JWT: JWTConfig{
			SecretKey:       jwtSecret,
			ExpirationHours: jwtExp,
		},
		LogLevel:  logLevel,
		LogFormat: logFormat,
		S3: S3Config{
			Endpoint:        s3Endpoint,
			AccessKeyID:     s3AccessKeyID,
			SecretAccessKey: s3SecretAccessKey,
			BucketName:      s3BucketName,
			Region:          s3Region,
			UsePathStyle:    s3UsePathStyle,
		},
	}, nil
}

// getEnv retrieves an environment variable or returns a default value.
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
