package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"example.com/auth_service/internal/middleware"
	"example.com/auth_service/internal/models"
	"example.com/auth_service/internal/s3service" // Import the S3 service
	"example.com/auth_service/pkg/logger"         // Import logger
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap" // For structured logging fields
	// "example.com/auth_service/pkg/logger"
	// "go.uber.org/zap"
)

const (
	maxUploadSize = 10 * 1024 * 1024 // 10 MB
	fileFormField = "audiofile"      // Name of the form field for the file
)

// Allowed audio file extensions (case-insensitive)
var allowedAudioExtensions = map[string]bool{
	".wav": true,
	".mp3": true,
	".ogg": true,
}

// AudioHandler handles HTTP requests related to audio files.
type AudioHandler struct {
	s3Service *s3service.S3Service
	audioRepo models.AudioRepository
	logger    *logger.Logger // Use our logger type
}

// NewAudioHandler creates a new AudioHandler.
func NewAudioHandler(s3Svc *s3service.S3Service, audioRepo models.AudioRepository, appLogger *logger.Logger) *AudioHandler { // Accept logger
	return &AudioHandler{
		s3Service: s3Svc,
		audioRepo: audioRepo,
		logger:    appLogger, // Assign logger
	}
}

// UploadAudioFile handles new audio file uploads.
// POST /api/v1/audio/upload
func (h *AudioHandler) UploadAudioFile(c *gin.Context) {
	h.logger.Info("UploadAudioFile: Received request") // Use logger

	// 1. Authentication & User ID retrieval
	claims, exists := middleware.GetCurrentUserClaims(c)
	if !exists || claims == nil {
		h.logger.Warn("UploadAudioFile: User claims not found in context") // Use logger
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user claims not found"})
		return
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		h.logger.Error("UploadAudioFile: Invalid user ID in JWT claims", zap.String("user_id_str", claims.UserID), zap.Error(err)) // Use logger
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: invalid user ID in token"})
		return
	}

	// 2. File Processing (multipart/form-data)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)
	file, header, err := c.Request.FormFile(fileFormField)
	if err != nil {
		if err.Error() == "http: request body too large" {
			h.logger.Warn("UploadAudioFile: File size limit exceeded", zap.Error(err), zap.Int64("limit_bytes", maxUploadSize)) // Use logger
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("File size limit exceeded. Max size: %d MB", maxUploadSize/(1024*1024))})
			return
		}
		h.logger.Error("UploadAudioFile: Error retrieving file from form", zap.Error(err)) // Use logger
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file upload request: " + err.Error()})
		return
	}
	defer file.Close()

	originalFilename := filepath.Clean(header.Filename)
	// Basic sanitization or further validation of filename can be added here.
	if originalFilename == "." || originalFilename == "/" {
		originalFilename = "uploaded_file"
	}

	// ---> Start File Extension Validation <---
	ext := strings.ToLower(filepath.Ext(originalFilename))
	if !allowedAudioExtensions[ext] {
		h.logger.Warn("UploadAudioFile: Invalid file extension", zap.String("filename", header.Filename), zap.String("extension", ext))
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid file format. Allowed formats: %v", getAllowedExtensionsList())})
		return
	}
	// ---> End File Extension Validation <---

	// Determine content type (MIME type)
	// The header.Header.Get("Content-Type") might be provided by the client,
	// but it's better to detect it from the file content if possible, or validate it.
	// For simplicity, we'll use the one from the header or a default if not provided.
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream" // Default MIME type
	}

	// 3. Generate S3 Key
	// Example: user_id/timestamp_nanoseconds/sanitized_filename.extension
	baseFilename := strings.TrimSuffix(originalFilename, filepath.Ext(originalFilename)) // Use original extension for removing suffix
	safeBaseFilename := strings.ReplaceAll(strings.ToLower(baseFilename), " ", "_")      // Basic sanitization
	s3Key := fmt.Sprintf("%s/%d/%s%s", userID.String(), time.Now().UnixNano(), safeBaseFilename, ext)

	h.logger.Info("Attempting to upload to S3", zap.String("s3_key", s3Key), zap.String("content_type", contentType)) // Use logger

	// 4. Upload to S3/MinIO
	// The context from Gin (c.Request.Context()) should be used for S3 operations if they can be long-running.
	fileURL, err := h.s3Service.UploadFile(c.Request.Context(), s3Key, file, contentType)
	if err != nil {
		h.logger.Error("Failed to upload file to S3", zap.String("s3_key", s3Key), zap.Error(err))
		// Return standard error
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file to storage"})
		return
	}

	// 5. Save Metadata to PostgreSQL
	audioFileMetadata := &models.AudioFile{
		ID:               uuid.New(), // New ID for this audio file record
		UserID:           userID,
		S3Key:            s3Key,
		OriginalFilename: originalFilename,
		ContentType:      contentType,
		SizeBytes:        header.Size,
		UploadedAt:       time.Now(),
	}

	if err := h.audioRepo.SaveAudioFile(c.Request.Context(), audioFileMetadata); err != nil {
		h.logger.Error("Failed to save audio metadata to DB", zap.String("s3_key", s3Key), zap.Error(err)) // Use logger
		// Consider a cleanup strategy: if DB save fails, should we delete from S3?
		// For now, we just return an error. This might leave an orphaned file in S3.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save audio file metadata"})
		return
	}

	h.logger.Info("Audio file uploaded and metadata saved",
		zap.String("userID", userID.String()),
		zap.String("s3_key", s3Key),
		zap.String("audioFileID", audioFileMetadata.ID.String())) // Use logger

	c.JSON(http.StatusCreated, models.UploadAudioResponse{
		ID:      audioFileMetadata.ID,
		S3Key:   s3Key,
		Message: "Audio file uploaded successfully",
		FileURL: fileURL, // This URL might be empty if S3 endpoint resolution failed in s3service
	})
}

// Helper function to get list of allowed extensions for error message
func getAllowedExtensionsList() []string {
	extensions := make([]string, 0, len(allowedAudioExtensions))
	for ext := range allowedAudioExtensions {
		extensions = append(extensions, ext)
	}
	return extensions
}
