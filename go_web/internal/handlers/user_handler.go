package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"example.com/auth_service/internal/auth"
	"example.com/auth_service/internal/models"
	"example.com/auth_service/pkg/logger" // Import logger
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap" // For structured logging fields
	// "example.com/auth_service/pkg/logger" // Assuming you have a logger package
)

// UserHandler handles HTTP requests related to users.
type UserHandler struct {
	authService    *auth.AuthService
	userRepository models.UserRepository
	logger         *logger.Logger // Use our logger type
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(authService *auth.AuthService, userRepo models.UserRepository, appLogger *logger.Logger) *UserHandler { // Accept logger
	return &UserHandler{
		authService:    authService,
		userRepository: userRepo,
		logger:         appLogger, // Assign logger
	}
}

// RegisterUser handles new user registration.
// POST /api/v1/users/register
func (h *UserHandler) RegisterUser(c *gin.Context) {
	var req models.RegistrationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("Invalid registration request format", zap.Error(err)) // Use logger
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	// Check if user already exists
	_, err := h.userRepository.GetUserByEmail(req.Email)
	if err == nil { // If err is nil, user found
		h.logger.Warn("Registration attempt for existing email", zap.String("email", req.Email)) // Use logger
		c.JSON(http.StatusConflict, gin.H{"error": "User with this email already exists"})
		return
	}
	// We expect an error (e.g., sql.ErrNoRows), so if it's a different error, it's a problem.
	if !errors.Is(err, sql.ErrNoRows) { // Check specific error
		h.logger.Error("Error checking user existence during registration", zap.Error(err)) // Use logger
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process registration"})
		return
	}

	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		h.logger.Error("Failed to hash password during registration", zap.Error(err)) // Use logger
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process registration"})
		return
	}

	newUser := &models.User{
		ID:        uuid.NewString(), // Generate a new UUID for the user
		Username:  req.Username,
		Email:     req.Email,
		Password:  hashedPassword,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := h.userRepository.CreateUser(newUser); err != nil {
		h.logger.Error("Failed to create user in DB during registration", zap.Error(err), zap.String("email", newUser.Email)) // Use logger
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register user"})
		return
	}

	h.logger.Info("User registered successfully", zap.String("email", newUser.Email), zap.String("userID", newUser.ID)) // Use logger

	// Return a simplified user object or just a success message
	// For security, newUser.Password is already omitted by json:"-" in the model
	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user_id": newUser.ID,
	})
}

// LoginUser handles user login and JWT generation.
// POST /api/v1/users/login
func (h *UserHandler) LoginUser(c *gin.Context) {
	var req models.LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error("Invalid login request format", zap.Error(err)) // Use logger
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	user, err := h.userRepository.GetUserByEmail(req.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) { // Check specific error
			h.logger.Warn("Login attempt for non-existent email", zap.String("email", req.Email)) // Use logger
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}
		h.logger.Error("Error retrieving user for login", zap.Error(err), zap.String("email", req.Email)) // Use logger
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})                      // Generic error for security
		return
	}

	if !auth.CheckPasswordHash(req.Password, user.Password) {
		h.logger.Warn("Incorrect password attempt", zap.String("email", req.Email)) // Use logger
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := h.authService.GenerateJWT(user.ID, user.Email)
	if err != nil {
		h.logger.Error("Failed to generate JWT during login", zap.Error(err), zap.String("user_id", user.ID)) // Use logger
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to login"})
		return
	}

	h.logger.Info("User logged in successfully", zap.String("email", user.Email), zap.String("userID", user.ID)) // Use logger
	c.JSON(http.StatusOK, models.LoginResponse{
		Token: token,
		User: models.User{ // Return a safe representation of the user
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			// Password field is omitted due to `json:"-"` tag
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
		},
	})
}
