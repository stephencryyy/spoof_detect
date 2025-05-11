package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"example.com/auth_service/internal/models"
	"example.com/auth_service/pkg/logger"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
	// "example.com/auth_service/pkg/logger"
)

// audioRepositoryImpl implements the models.AudioRepository interface.
type audioRepositoryImpl struct {
	db     *sqlx.DB
	logger *logger.Logger
}

// NewAudioRepository creates a new instance that implements models.AudioRepository.
func NewAudioRepository(db *sqlx.DB, appLogger *logger.Logger) models.AudioRepository {
	return &audioRepositoryImpl{
		db:     db,
		logger: appLogger,
	}
}

// SaveAudioFile saves audio file metadata to the database.
func (r *audioRepositoryImpl) SaveAudioFile(ctx context.Context, audioFile *models.AudioFile) error {
	query := `INSERT INTO audio_files (id, user_id, s3_key, original_filename, content_type, size_bytes, uploaded_at)
			  VALUES ($1, $2, $3, $4, $5, $6, $7)`

	_, err := r.db.ExecContext(ctx, query,
		audioFile.ID,
		audioFile.UserID,
		audioFile.S3Key,
		audioFile.OriginalFilename,
		audioFile.ContentType,
		audioFile.SizeBytes,
		audioFile.UploadedAt,
	)

	if err != nil {
		r.logger.Error("Error saving audio file metadata to DB", zap.Error(err), zap.String("s3_key", audioFile.S3Key))
		return fmt.Errorf("SaveAudioFile: failed to insert audio metadata: %w", err)
	}
	r.logger.Info("Audio file metadata saved to DB", zap.String("id", audioFile.ID.String()), zap.String("s3_key", audioFile.S3Key))
	return nil
}

// GetAudioFileByID retrieves audio file metadata from the database by its ID.
func (r *audioRepositoryImpl) GetAudioFileByID(ctx context.Context, id uuid.UUID) (*models.AudioFile, error) {
	var audioFile models.AudioFile
	query := `SELECT id, user_id, s3_key, original_filename, content_type, size_bytes, uploaded_at 
			  FROM audio_files WHERE id = $1`

	err := r.db.GetContext(ctx, &audioFile, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			r.logger.Debug("Audio file metadata not found by ID", zap.String("id", id.String()))
			return nil, err // Return sql.ErrNoRows directly
		}
		r.logger.Error("Error fetching audio file metadata by ID from DB", zap.Error(err), zap.String("id", id.String()))
		return nil, fmt.Errorf("GetAudioFileByID: query error: %w", err)
	}
	r.logger.Debug("Audio file metadata found by ID", zap.String("id", id.String()))
	return &audioFile, nil
}

// Optional: Implement ListAudioFilesByUserID if needed
// func (r *audioRepositoryImpl) ListAudioFilesByUserID(ctx context.Context, userID uuid.UUID) ([]models.AudioFile, error) {
// 	var files []models.AudioFile
// 	query := `SELECT id, user_id, s3_key, original_filename, content_type, size_bytes, uploaded_at
// 			  FROM audio_files WHERE user_id = $1 ORDER BY uploaded_at DESC`
// 	err := r.db.SelectContext(ctx, &files, query, userID)
// 	if err != nil {
// 		return nil, fmt.Errorf("ListAudioFilesByUserID: query error: %w", err)
// 	}
// 	return files, nil
// }
