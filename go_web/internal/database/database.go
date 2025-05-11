package database

import (
	"fmt"
	"log"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" // PostgreSQL driver

	"example.com/auth_service/internal/config" // Import the config package
	// "example.com/auth_service/internal/models"
)

// Connect establishes a connection to the PostgreSQL database.
// It now uses config.DatabaseConfig from the central configuration.
func Connect(cfg config.DatabaseConfig) (*sqlx.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode)

	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err = db.Ping(); err != nil {
		db.Close() // Close the connection if ping fails
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Successfully connected to the database!")
	return db, nil
}

// --- UserRepository (Example, to be expanded) ---
// This is where your user-specific database operations would go.

// type UserRepository struct {
// 	db *sqlx.DB
// }

// func NewUserRepository(db *sqlx.DB) *UserRepository {
// 	return &UserRepository{db: db}
// }

// func (r *UserRepository) CreateUser(user *models.User) error {
// 	query := `INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
// 			  VALUES ($1, $2, $3, $4, $5, $6)`
// 	_, err := r.db.Exec(query, user.ID, user.Username, user.Email, user.Password, user.CreatedAt, user.UpdatedAt)
// 	return err
// }

// func (r *UserRepository) GetUserByEmail(email string) (*models.User, error) {
// 	var user models.User
// 	query := `SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE email = $1`
// 	err := r.db.Get(&user, query, email)
// 	if err != nil {
// 		return nil, err // Could be sql.ErrNoRows, handle appropriately in service layer
// 	}
// 	return &user, nil
// }

// func (r *UserRepository) GetUserByID(id string) (*models.User, error) {
// 	var user models.User
// 	query := `SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE id = $1`
// 	err := r.db.Get(&user, query, id)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return &user, nil
// }
