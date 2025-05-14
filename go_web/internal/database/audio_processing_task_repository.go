package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"example.com/auth_service/internal/models"
	"example.com/auth_service/pkg/logger" // Assuming you have a logger package
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// Ensure audioProcessingTaskRepositoryImpl implements models.AudioProcessingTaskRepository.
var _ models.AudioProcessingTaskRepository = (*audioProcessingTaskRepositoryImpl)(nil)

type audioProcessingTaskRepositoryImpl struct {
	db     *sqlx.DB
	logger *logger.Logger // Or use *zap.Logger directly if preferred
}

// NewAudioProcessingTaskRepository creates a new instance of AudioProcessingTaskRepository.
func NewAudioProcessingTaskRepository(db *sqlx.DB, appLogger *logger.Logger) models.AudioProcessingTaskRepository {
	return &audioProcessingTaskRepositoryImpl{
		db:     db,
		logger: appLogger,
	}
}

func (r *audioProcessingTaskRepositoryImpl) CreateTask(ctx context.Context, task *models.AudioProcessingTask) error {
	task.CreatedAt = time.Now().UTC()
	task.UpdatedAt = task.CreatedAt

	// Handle nullable fields for SQL insertion
	var predictionsJSON []byte
	var err error
	if task.Predictions != nil && len(task.Predictions) > 0 {
		predictionsJSON, err = json.Marshal(task.Predictions)
		if err != nil {
			r.logger.Error("Failed to marshal predictions to JSON", zap.Error(err), zap.String("task_id", task.TaskID.String()))
			return fmt.Errorf("CreateTask: failed to marshal predictions: %w", err)
		}
	} else {
		// Store as SQL NULL if empty or nil, or as JSON 'null' if your DB/driver prefers
		// predictionsJSON = []byte("null") // Option 1: JSON null
		predictionsJSON = nil // Option 2: Let SQL handle nil for JSONB as proper NULL
	}

	// Use sql.NullString for nullable string fields
	originalFilenameSQL := sql.NullString{String: "", Valid: false}
	if task.OriginalFilename != nil {
		originalFilenameSQL.String = *task.OriginalFilename
		originalFilenameSQL.Valid = true
	}

	errorMessageSQL := sql.NullString{String: "", Valid: false}
	if task.ErrorMessage != nil {
		errorMessageSQL.String = *task.ErrorMessage
		errorMessageSQL.Valid = true
	}

	query := `INSERT INTO audio_processing_tasks 
			  (task_id, minio_bucket_name, minio_object_key, original_filename, status, predictions, error_message, created_at, updated_at)
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err = r.db.ExecContext(ctx, query,
		task.TaskID,
		task.MinioBucketName,
		task.MinioObjectKey,
		originalFilenameSQL,
		task.Status,
		predictionsJSON, // Pass marshaled JSON or nil for predictions
		errorMessageSQL,
		task.CreatedAt,
		task.UpdatedAt,
	)

	if err != nil {
		r.logger.Error("Error creating audio processing task in DB", zap.Error(err), zap.String("task_id", task.TaskID.String()))
		return fmt.Errorf("CreateTask: failed to insert task: %w", err)
	}
	r.logger.Info("Audio processing task created in DB", zap.String("task_id", task.TaskID.String()))
	return nil
}

func (r *audioProcessingTaskRepositoryImpl) GetTaskByID(ctx context.Context, taskID uuid.UUID) (*models.AudioProcessingTask, error) {
	var task models.AudioProcessingTask
	// Need to handle nullable JSON and string fields when scanning
	var predictionsJSON sql.NullString // Use sql.NullString for JSONB that might be NULL
	var originalFilenameSQL sql.NullString
	var errorMessageSQL sql.NullString

	query := `SELECT task_id, minio_bucket_name, minio_object_key, original_filename, status, predictions, error_message, created_at, updated_at
			  FROM audio_processing_tasks WHERE task_id = $1`

	err := r.db.QueryRowxContext(ctx, query, taskID).Scan(
		&task.TaskID,
		&task.MinioBucketName,
		&task.MinioObjectKey,
		&originalFilenameSQL,
		&task.Status,
		&predictionsJSON,
		&errorMessageSQL,
		&task.CreatedAt,
		&task.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			r.logger.Debug("Audio processing task not found by ID", zap.String("task_id", taskID.String()))
			return nil, err // Return sql.ErrNoRows directly
		}
		r.logger.Error("Error fetching audio processing task by ID from DB", zap.Error(err), zap.String("task_id", taskID.String()))
		return nil, fmt.Errorf("GetTaskByID: query error: %w", err)
	}

	// Assign scanned nullable fields
	if originalFilenameSQL.Valid {
		task.OriginalFilename = &originalFilenameSQL.String
	}
	if errorMessageSQL.Valid {
		task.ErrorMessage = &errorMessageSQL.String
	}

	// Unmarshal predictions if not NULL
	if predictionsJSON.Valid && predictionsJSON.String != "" {
		if err := json.Unmarshal([]byte(predictionsJSON.String), &task.Predictions); err != nil {
			r.logger.Error("Failed to unmarshal predictions from JSONB", zap.Error(err), zap.String("task_id", taskID.String()))
			// Decide if this is a fatal error for GetTaskByID or if you return the task with nil predictions
			return nil, fmt.Errorf("GetTaskByID: failed to unmarshal predictions: %w", err)
		}
	} else {
		task.Predictions = nil // Ensure it's explicitly nil if DB value was NULL or empty
	}

	r.logger.Debug("Audio processing task found by ID", zap.String("task_id", taskID.String()))
	return &task, nil
}

func (r *audioProcessingTaskRepositoryImpl) UpdateTaskStatusAndResults(ctx context.Context, taskID uuid.UUID, status models.AudioProcessingStatus, predictions map[string]float32, errorMessage string) error {
	updatedAt := time.Now().UTC()

	var predictionsJSON []byte
	var err error
	if predictions != nil && len(predictions) > 0 {
		predictionsJSON, err = json.Marshal(predictions)
		if err != nil {
			r.logger.Error("Failed to marshal predictions for update", zap.Error(err), zap.String("task_id", taskID.String()))
			return fmt.Errorf("UpdateTaskStatusAndResults: failed to marshal predictions: %w", err)
		}
	} else {
		// Store as SQL NULL or JSON 'null'
		// predictionsJSON = []byte("null") // If you want JSON null
		predictionsJSON = nil // If you want SQL NULL for JSONB
	}

	// Use sql.NullString for nullable errorMessage
	errorMessageSQL := sql.NullString{String: errorMessage, Valid: errorMessage != ""}

	query := `UPDATE audio_processing_tasks
			  SET status = $1, predictions = $2, error_message = $3, updated_at = $4
			  WHERE task_id = $5`

	result, err := r.db.ExecContext(ctx, query, status, predictionsJSON, errorMessageSQL, updatedAt, taskID)
	if err != nil {
		r.logger.Error("Error updating audio processing task in DB", zap.Error(err), zap.String("task_id", taskID.String()))
		return fmt.Errorf("UpdateTaskStatusAndResults: failed to update task: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		r.logger.Warn("Could not determine rows affected by update", zap.Error(err), zap.String("task_id", taskID.String()))
		// Not a fatal error for the update itself, but good to log
	}
	if rowsAffected == 0 {
		r.logger.Warn("UpdateTaskStatusAndResults: no task found with ID to update", zap.String("task_id", taskID.String()))
		return sql.ErrNoRows // Or a custom not found error
	}

	r.logger.Info("Audio processing task updated in DB", zap.String("task_id", taskID.String()), zap.String("new_status", string(status)))
	return nil
}
