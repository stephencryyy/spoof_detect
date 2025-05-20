package models

import "errors"

// Predefined errors
var (
	ErrNotFound     = errors.New("requested item not found")
	ErrUnauthorized = errors.New("user is not authorized to perform this action")
	ErrInvalidInput = errors.New("invalid input provided")
	// Add other common errors here
)

// ErrorResponse is a generic structure for JSON error responses.
// Ensure this is consistent with how you want to send errors to the client.
type ErrorResponse struct {
	Error string `json:"error"`
}

// SuccessResponse is a generic structure for JSON success responses
// where only a message is needed.
type SuccessResponse struct {
	Message string `json:"message"`
}
