package models

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// AudioProcessingStatus defines the possible statuses for an audio processing task.
type AudioProcessingStatus string

const (
	StatusPending               AudioProcessingStatus = "PENDING"
	StatusProcessing            AudioProcessingStatus = "PROCESSING"
	StatusCompleted             AudioProcessingStatus = "COMPLETED"
	StatusErrorGrpcConnection   AudioProcessingStatus = "ERROR_GRPC_CONNECTION"
	StatusErrorPythonProcessing AudioProcessingStatus = "ERROR_PYTHON_PROCESSING"
	StatusErrorMinioDownload    AudioProcessingStatus = "ERROR_MINIO_DOWNLOAD"
	StatusErrorInternal         AudioProcessingStatus = "ERROR_INTERNAL"
)

// AudioProcessingTask represents a task for analyzing an audio file.
type AudioProcessingTask struct {
	TaskID           uuid.UUID             `json:"task_id" db:"task_id"`
	MinioBucketName  string                `json:"minio_bucket_name" db:"minio_bucket_name"`
	MinioObjectKey   string                `json:"minio_object_key" db:"minio_object_key"`
	OriginalFilename *string               `json:"original_filename,omitempty" db:"original_filename"` // Pointer for NULLABLE
	Status           AudioProcessingStatus `json:"status" db:"status"`
	Predictions      map[string]float32    `json:"predictions,omitempty" db:"predictions"`     // Stored as JSONB
	ErrorMessage     *string               `json:"error_message,omitempty" db:"error_message"` // Pointer for NULLABLE
	CreatedAt        time.Time             `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at" db:"updated_at"`
}

// AudioProcessingTaskRepository defines the interface for database operations on AudioProcessingTask.
type AudioProcessingTaskRepository interface {
	CreateTask(ctx context.Context, task *AudioProcessingTask) error
	GetTaskByID(ctx context.Context, taskID uuid.UUID) (*AudioProcessingTask, error)
	// UpdateTaskStatusAndResults updates the status, predictions, and error message of a task.
	// Predictions can be nil if there are no predictions (e.g., in case of an error before prediction).
	UpdateTaskStatusAndResults(ctx context.Context, taskID uuid.UUID, status AudioProcessingStatus, predictions map[string]float32, errorMessage string) error
}
