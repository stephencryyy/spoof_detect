package database

import (
	"database/sql" // Keep for potential direct sql.DB usage if any, though primary is sqlx

	"example.com/auth_service/internal/models"
	"example.com/auth_service/pkg/logger"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx" // Add sqlx import
	"go.uber.org/zap"
)

// AudioHistoryRepository handles database operations for audio history.
type AudioHistoryRepository struct {
	db     *sqlx.DB // Changed to use sqlx.DB
	logger *logger.Logger
}

// NewAudioHistoryRepository creates a new AudioHistoryRepository.
func NewAudioHistoryRepository(db *sqlx.DB, logger *logger.Logger) *AudioHistoryRepository { // Changed db type to *sqlx.DB
	return &AudioHistoryRepository{db: db, logger: logger}
}

// CreateAudioHistoryEntry creates a new audio history entry in the database.
func (r *AudioHistoryRepository) CreateAudioHistoryEntry(entry *models.AudioHistoryEntry) error {
	query := `
		INSERT INTO audio_history (id, user_id, filename, file_size, probability, s3_key, original_file_id, analysis_details, analysis_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.Exec(query, entry.ID, entry.UserID, entry.Filename, entry.FileSize, entry.Probability, entry.S3Key, entry.OriginalFileID, entry.AnalysisDetails, entry.AnalysisDate)
	if err != nil {
		r.logger.Error("Failed to create audio history entry", zap.Error(err), zap.Any("entry", entry))
		return err
	}
	r.logger.Info("Successfully created audio history entry", zap.String("entry_id", entry.ID.String()))
	return nil
}

// GetAudioHistoryByUserID retrieves all audio history entries for a given user ID, ordered by date descending.
func (r *AudioHistoryRepository) GetAudioHistoryByUserID(userID uuid.UUID) ([]*models.AudioHistoryEntry, error) {
	query := `
		SELECT id, user_id, filename, file_size, probability, s3_key, original_file_id, analysis_details, analysis_date
		FROM audio_history
		WHERE user_id = $1
		ORDER BY analysis_date DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		r.logger.Error("Failed to query audio history by user ID", zap.Error(err), zap.String("user_id", userID.String()))
		return nil, err
	}
	defer rows.Close()

	var historyEntries []*models.AudioHistoryEntry
	for rows.Next() {
		entry := &models.AudioHistoryEntry{}
		// Handling potential NULL for s3_key, original_file_id, analysis_details
		var s3Key sql.NullString
		var originalFileID sql.NullString  // Assuming UUID is stored as string or can be scanned into NullString
		var analysisDetails sql.NullString // Assuming JSONB can be scanned into NullString (or use json.RawMessage)

		if err := rows.Scan(
			&entry.ID,
			&entry.UserID,
			&entry.Filename,
			&entry.FileSize,
			&entry.Probability,
			&s3Key,
			&originalFileID,
			&analysisDetails,
			&entry.AnalysisDate,
		); err != nil {
			r.logger.Error("Failed to scan audio history entry", zap.Error(err))
			return nil, err
		}

		if s3Key.Valid {
			entry.S3Key = &s3Key.String
		}
		if originalFileID.Valid {
			parsedUUID, err := uuid.Parse(originalFileID.String)
			if err == nil { // only assign if parsing is successful
				entry.OriginalFileID = &parsedUUID
			}
		}
		if analysisDetails.Valid {
			// For JSONB, you might want to unmarshal it into a specific struct or map[string]interface{}
			// For simplicity, assigning as string here. Consider using json.RawMessage for entry.AnalysisDetails
			entry.AnalysisDetails = []byte(analysisDetails.String) // Assuming AnalysisDetails is []byte or json.RawMessage
		}

		historyEntries = append(historyEntries, entry)
	}

	if err = rows.Err(); err != nil {
		r.logger.Error("Error iterating over audio history rows", zap.Error(err))
		return nil, err
	}

	r.logger.Info("Successfully retrieved audio history for user", zap.String("user_id", userID.String()), zap.Int("count", len(historyEntries)))
	return historyEntries, nil
}

// DeleteAudioHistoryEntry deletes a specific audio history entry by its ID and user ID (for authorization).
func (r *AudioHistoryRepository) DeleteAudioHistoryEntry(entryID uuid.UUID, userID uuid.UUID) error {
	query := `DELETE FROM audio_history WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(query, entryID, userID)
	if err != nil {
		r.logger.Error("Failed to delete audio history entry", zap.Error(err), zap.String("entry_id", entryID.String()), zap.String("user_id", userID.String()))
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		r.logger.Error("Failed to get rows affected after deleting audio history entry", zap.Error(err))
		return err // Or handle as a non-fatal error if preferred
	}
	if rowsAffected == 0 {
		r.logger.Warn("No audio history entry found to delete or user not authorized", zap.String("entry_id", entryID.String()), zap.String("user_id", userID.String()))
		return models.ErrNotFound // Use the error defined in models package (or a general error package if you have one)

	}
	r.logger.Info("Successfully deleted audio history entry", zap.String("entry_id", entryID.String()), zap.String("user_id", userID.String()))
	return nil
}

// ClearAudioHistoryByUserID deletes all audio history entries for a given user ID.
func (r *AudioHistoryRepository) ClearAudioHistoryByUserID(userID uuid.UUID) error {
	query := `DELETE FROM audio_history WHERE user_id = $1`
	_, err := r.db.Exec(query, userID)
	if err != nil {
		r.logger.Error("Failed to clear audio history for user", zap.Error(err), zap.String("user_id", userID.String()))
		return err
	}
	r.logger.Info("Successfully cleared audio history for user", zap.String("user_id", userID.String()))
	return nil
}

var _ models.AudioHistoryRepository = (*AudioHistoryRepository)(nil)
