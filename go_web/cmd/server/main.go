package main

import (
	"log"
	"net/http" // Required for http.StatusOK if used in protected route example

	"example.com/auth_service/internal/auth"
	"example.com/auth_service/internal/config"
	"example.com/auth_service/internal/database"
	"example.com/auth_service/internal/handlers"
	"example.com/auth_service/internal/middleware"
	"example.com/auth_service/internal/s3service" // Add S3 service import
	"example.com/auth_service/pkg/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap" // For logger error handling
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
			// Это может быть проблемой, если stderr также не доступен
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

	// Initialize Gin router
	// gin.SetMode(gin.ReleaseMode) // Uncomment for production
	router := gin.Default()
	// router.Use(gin.Recovery()) // gin.Default() already includes Recovery and Logger middleware

	// Setup CORS middleware
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:3000"} // URL вашего фронтенда
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	// Если вы планируете использовать cookies или аутентификацию через заголовки, которые должны быть доступны JS
	// corsConfig.AllowCredentials = true
	router.Use(cors.New(corsConfig)) // Применение middleware

	// Setup dependencies
	userRepo := database.NewUserRepository(db, appLogger)
	audioRepo := database.NewAudioRepository(db, appLogger)

	// Pass userRepo to AuthService
	authSvc := auth.NewAuthService(cfg.JWT.SecretKey, cfg.JWT.ExpirationHours, userRepo)

	userHandler := handlers.NewUserHandler(authSvc, userRepo, appLogger)
	audioHandler := handlers.NewAudioHandler(s3Svc, audioRepo, appLogger)

	// Setup routes
	apiV1 := router.Group("/api/v1")
	{
		userRoutes := apiV1.Group("/users")
		{
			userRoutes.POST("/register", userHandler.RegisterUser)
			userRoutes.POST("/login", userHandler.LoginUser)
		}

		// Audio routes (protected)
		authMW := middleware.AuthMiddleware(authSvc, appLogger)
		audioRoutes := apiV1.Group("/audio")
		audioRoutes.Use(authMW) // Apply auth middleware to all /audio routes
		{
			audioRoutes.POST("/upload", audioHandler.UploadAudioFile)
		}

		// Example of a protected route (requires JWT)
		// protectedRoutes := apiV1.Group("/protected")
	}

	router.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	// Start server
	appLogger.Info("Server starting", zap.String("port", cfg.AppPort))
	if err := router.Run(":" + cfg.AppPort); err != nil {
		appLogger.Fatal("Failed to start server", zap.Error(err))
	}
}
