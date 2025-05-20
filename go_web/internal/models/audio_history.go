package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AudioHistoryEntry represents an entry in the audio_history table.
type AudioHistoryEntry struct {
	ID              uuid.UUID       `json:"id"`
	UserID          uuid.UUID       `json:"user_id"`
	Filename        string          `json:"filename"`
	FileSize        string          `json:"file_size,omitempty"`
	Probability     float64         `json:"probability"`
	S3Key           *string         `json:"s3_key,omitempty"`
	OriginalFileID  *uuid.UUID      `json:"original_file_id,omitempty"`
	AnalysisDetails json.RawMessage `json:"analysis_details,omitempty"`
	AnalysisDate    time.Time       `json:"analysis_date"`
}

// AudioHistoryRepository defines methods for audio history data access.
type AudioHistoryRepository interface {
	CreateAudioHistoryEntry(entry *AudioHistoryEntry) error
	GetAudioHistoryByUserID(userID uuid.UUID) ([]*AudioHistoryEntry, error)
	DeleteAudioHistoryEntry(entryID uuid.UUID, userID uuid.UUID) error
	ClearAudioHistoryByUserID(userID uuid.UUID) error
}
