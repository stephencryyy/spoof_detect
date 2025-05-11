package auth

import (
	"time"

	"example.com/auth_service/internal/models" // Import models for UserRepository
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	// "your_project_module_path/internal/models"
)

// AuthService provides authentication related functionalities.
type AuthService struct {
	jwtSecretKey     string
	jwtExpirationHrs int
	userRepo         models.UserRepository // Use UserRepository from models package
	// userRepo       UserRepository // Define UserRepository interface later
}

// // UserRepository defines methods for user data access, to be implemented by database package.
// type UserRepository interface {
// 	CreateUser(user *models.User) error
// 	GetUserByEmail(email string) (*models.User, error)
// 	GetUserByID(id string) (*models.User, error)
// }

// NewAuthService creates a new AuthService.
func NewAuthService(jwtSecret string, jwtExpHrs int, userRepo models.UserRepository) *AuthService {
	return &AuthService{
		jwtSecretKey:     jwtSecret,
		jwtExpirationHrs: jwtExpHrs,
		userRepo:         userRepo, // Assign the repository
		// userRepo:      userRepo,
	}
}

// HashPassword generates a bcrypt hash of the password.
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

// CheckPasswordHash compares a bcrypt hashed password with its possible plaintext equivalent.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Claims defines the JWT claims structure.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// GenerateJWT generates a new JWT for a given user.
func (s *AuthService) GenerateJWT(userID, email string) (string, error) {
	expirationTime := time.Now().Add(time.Duration(s.jwtExpirationHrs) * time.Hour)
	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "auth_service", // Optional: an identifier for the issuer
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtSecretKey))
	if err != nil {
		return "", err
	}
	return tokenString, nil
}

// ValidateJWT validates a JWT string.
func (s *AuthService) ValidateJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Check the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(s.jwtSecretKey), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, jwt.ErrTokenUnverifiable // Or a more specific error
	}

	return claims, nil
}
