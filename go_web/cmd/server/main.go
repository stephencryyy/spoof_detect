package main

import (
	"context" // Added context for gRPC client creation
	"log"
	"net/http" // Required for http.StatusOK if used in protected route example

	"example.com/auth_service/internal/auth"
	"example.com/auth_service/internal/config"
	"example.com/auth_service/internal/database"
	"example.com/auth_service/internal/grpc_clients" // Added gRPC client package
	"example.com/auth_service/internal/handlers"
	"example.com/auth_service/internal/middleware"
	"example.com/auth_service/internal/s3service"
	"example.com/auth_service/pkg/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// Load configuration (from .env and OS)
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	appLogger, err := logger.New(cfg.LogLevel, cfg.LogFormat)
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer func() {
		if syncErr := appLogger.Sync(); syncErr != nil {
			log.Printf("Warning: failed to sync logger: %v\n", syncErr)
		}
	}()
	appLogger.Info("Logger initialized", zap.String("level", cfg.LogLevel), zap.String("format", cfg.LogFormat))

	// Initialize database connection
	db, err := database.Connect(cfg.Database)
	if err != nil {
		appLogger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer db.Close()
	appLogger.Info("Database connection successful")

	// Initialize S3 Service
	s3Svc, err := s3service.NewS3Service(cfg.S3, appLogger)
	if err != nil {
		appLogger.Fatal("Failed to initialize S3 service", zap.Error(err))
	}
	// Ensure S3 bucket exists or create it
	if bucketErr := s3Svc.EnsureBucketExists(context.Background()); bucketErr != nil { // Using context.Background() for initialization
		appLogger.Fatal("Failed to ensure S3 bucket exists", zap.String("bucket", cfg.S3.BucketName), zap.Error(err))
	}

	// Initialize Python Audio Analyzer gRPC Client
	// Using context.Background() for client creation, as it's part of app startup.
	// Consider a more specific context if long-running initial connection attempts are an issue.
	pyAnalyzerClient, err := grpc_clients.NewPythonAudioAnalyzerClient(context.Background(), cfg.PythonGrpcServiceAddr, appLogger)
	if err != nil {
		appLogger.Fatal("Failed to initialize Python Audio Analyzer gRPC client", zap.Error(err), zap.String("address", cfg.PythonGrpcServiceAddr))
	}
	defer func() {
		if clientCloseErr := pyAnalyzerClient.Close(); clientCloseErr != nil {
			appLogger.Error("Failed to close Python Audio Analyzer gRPC client", zap.Error(clientCloseErr))
		}
	}()
	appLogger.Info("Python Audio Analyzer gRPC client initialized", zap.String("target_address", cfg.PythonGrpcServiceAddr))

	// Initialize Gin router
	router := gin.Default()

	// Setup CORS middleware
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:3000"} // URL вашего фронтенда
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	router.Use(cors.New(corsConfig))

	// Setup dependencies
	userRepo := database.NewUserRepository(db, appLogger)
	audioRepo := database.NewAudioRepository(db, appLogger)
	audioTaskRepo := database.NewAudioProcessingTaskRepository(db, appLogger) // Initialize AudioProcessingTaskRepository
	audioHistoryRepo := database.NewAudioHistoryRepository(db, appLogger)     // Initialize AudioHistoryRepository

	authSvc := auth.NewAuthService(cfg.JWT.SecretKey, cfg.JWT.ExpirationHours, userRepo)

	userHandler := handlers.NewUserHandler(authSvc, userRepo, appLogger)
	// Pass pyAnalyzerClient, audioTaskRepo and audioHistoryRepo to NewAudioHandler
	audioHandler := handlers.NewAudioHandler(
		s3Svc,
		audioRepo,
		audioTaskRepo,
		pyAnalyzerClient,
		cfg,
		appLogger,
		audioHistoryRepo, // без амперсанда, если это интерфейс
		userRepo)         // добавлен userRepo

	audioHistoryHandler := handlers.NewAudioHistoryHandler(audioHistoryRepo, appLogger) // Initialize AudioHistoryHandler

	// Setup routes
	apiV1 := router.Group("/api/v1")
	{
		userRoutes := apiV1.Group("/users")
		{
			userRoutes.POST("/register", userHandler.RegisterUser)
			userRoutes.POST("/login", userHandler.LoginUser)
		}

		authMW := middleware.AuthMiddleware(authSvc, appLogger)
		audioRoutes := apiV1.Group("/audio")
		audioRoutes.Use(authMW)
		{
			audioRoutes.POST("/upload", audioHandler.UploadAudioFile)
		}

		historyRoutes := apiV1.Group("/history")
		historyRoutes.Use(authMW)
		{
			historyRoutes.GET("", audioHistoryHandler.GetHistory)                     // GET /api/v1/history
			historyRoutes.DELETE("", audioHistoryHandler.ClearHistory)                // DELETE /api/v1/history
			historyRoutes.DELETE("/:entryId", audioHistoryHandler.DeleteHistoryEntry) // DELETE /api/v1/history/:entryId
		}
	}

	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	appLogger.Info("Server starting", zap.String("port", cfg.AppPort))
	if err := router.Run(":" + cfg.AppPort); err != nil {
		appLogger.Fatal("Failed to start server", zap.Error(err))
	}
}
