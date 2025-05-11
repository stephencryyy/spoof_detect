package middleware

import (
	"net/http"
	"strings"

	"example.com/auth_service/internal/auth"
	"example.com/auth_service/pkg/logger" // Import logger
	"github.com/gin-gonic/gin"
	"go.uber.org/zap" // For structured logging fields
	// "example.com/auth_service/pkg/logger" // Assuming you have a logger package
)

const (
	authorizationHeaderKey  = "Authorization"
	authorizationTypeBearer = "bearer"
	userContextKey          = "currentUserClaims" // Key to store user claims in Gin context
)

// AuthMiddleware creates a Gin middleware for JWT authentication.
func AuthMiddleware(authService *auth.AuthService, appLogger *logger.Logger) gin.HandlerFunc { // Accept logger
	return func(c *gin.Context) {
		authHeader := c.GetHeader(authorizationHeaderKey)
		if authHeader == "" {
			appLogger.Warn("Authorization header missing") // Use logger
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != authorizationTypeBearer {
			appLogger.Warn("Invalid authorization header format", zap.String("header", authHeader)) // Use logger
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format. Use Bearer token."})
			return
		}

		tokenString := parts[1]
		claims, err := authService.ValidateJWT(tokenString)
		if err != nil {
			appLogger.Error("Invalid JWT token", zap.Error(err)) // Use logger
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		// Set user claims in context for downstream handlers
		c.Set(userContextKey, claims)
		appLogger.Info("User authenticated via JWT", zap.String("userID", claims.UserID), zap.String("email", claims.Email)) // Use logger

		c.Next()
	}
}

// GetCurrentUserClaims retrieves the authenticated user's claims from the Gin context.
// This is a helper function for handlers to easily access user information.
func GetCurrentUserClaims(c *gin.Context) (*auth.Claims, bool) {
	claims, exists := c.Get(userContextKey)
	if !exists {
		return nil, false
	}

	userClaims, ok := claims.(*auth.Claims)
	if !ok {
		// This should ideally not happen if middleware is correctly setting it.
		return nil, false
	}

	return userClaims, true
}
