package models

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// AudioFile represents metadata for an uploaded audio file in the database.
type AudioFile struct {
	ID               uuid.UUID `db:"id" json:"id"`
	UserID           uuid.UUID `db:"user_id" json:"user_id"`
	S3Key            string    `db:"s3_key" json:"s3_key"`
	OriginalFilename string    `db:"original_filename" json:"original_filename"`
	ContentType      string    `db:"content_type" json:"content_type,omitempty"`
	SizeBytes        int64     `db:"size_bytes" json:"size_bytes,omitempty"`
	UploadedAt       time.Time `db:"uploaded_at" json:"uploaded_at"`
}

// UploadAudioResponse defines the structure for a successful audio upload response.
type UploadAudioResponse struct {
	ID      uuid.UUID `json:"id"`
	S3Key   string    `json:"s3_key"`
	Message string    `json:"message"`
	FileURL string    `json:"file_url,omitempty"` // Optional: URL to access the file
}

// AudioRepository defines the interface for audio file data operations.
type AudioRepository interface {
	SaveAudioFile(ctx context.Context, audioFile *AudioFile) error
	GetAudioFileByID(ctx context.Context, id uuid.UUID) (*AudioFile, error)
	// ListAudioFilesByUserID(ctx context.Context, userID uuid.UUID) ([]AudioFile, error) // Optional
}
