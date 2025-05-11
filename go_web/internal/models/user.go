package models

import "time"

// User represents a user in the system
type User struct {
	ID        string    `db:"id" json:"id"`
	Username  string    `db:"username" json:"username"`
	Email     string    `db:"email" json:"email"`
	Password  string    `db:"password_hash" json:"-"` // Never return password hash in JSON
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

// RegistrationRequest defines the structure for user registration
type RegistrationRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=72"`
}

// LoginRequest defines the structure for user login
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse defines the structure for a successful login response
type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"` // Optionally return some user details
}

// UserRepository defines the interface for user data operations.
// This interface will be implemented by the database package.
type UserRepository interface {
	CreateUser(user *User) error
	GetUserByEmail(email string) (*User, error)
	GetUserByID(id string) (*User, error) // Added GetUserByID for completeness
}
