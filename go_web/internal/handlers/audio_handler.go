package handlers

import (
	"context"
	"encoding/json" // Added for marshaling analysis results
	"fmt"
	"math" // Added for rounding probabilities
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"example.com/auth_service/internal/config"
	"example.com/auth_service/internal/grpc_clients"
	"example.com/auth_service/internal/middleware"
	"example.com/auth_service/internal/models"
	"example.com/auth_service/internal/s3service"
	"example.com/auth_service/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const (
	maxUploadSize = 10 * 1024 * 1024 // 10 MB
	fileFormField = "audiofile"      // Name of the form field for the file
)

// Allowed audio file extensions (case-insensitive)
var allowedAudioExtensions = map[string]bool{
	".wav":  true,
	".mp3":  true,
	".ogg":  true,
	".webm": true,
}

// AudioAnalysisResult represents a single chunk's analysis result for the API response.
// We define a new struct here to have control over JSON field names if needed,
// and to potentially add/omit fields compared to the gRPC pb.AudioChunkPrediction.
type AudioAnalysisResult struct {
	ChunkID        string  `json:"chunk_id"`
	Score          float32 `json:"score"`
	StartTimestamp float32 `json:"start_time_seconds"`
	EndTimestamp   float32 `json:"end_time_seconds"`
}

// UploadAndAnalyzeAudioResponse defines the structure for a successful audio upload and analysis response.
type UploadAndAnalyzeAudioResponse struct {
	FileID          uuid.UUID             `json:"file_id"`
	S3Key           string                `json:"s3_key"`
	Message         string                `json:"message"`
	FileURL         string                `json:"file_url,omitempty"`
	AnalysisError   string                `json:"analysis_error,omitempty"` // Error message from Python service, if any
	AnalysisResults []AudioAnalysisResult `json:"analysis_results,omitempty"`
}

// AudioHandler handles HTTP requests related to audio files.
type AudioHandler struct {
	s3Service        *s3service.S3Service
	audioRepo        models.AudioRepository
	audioTaskRepo    models.AudioProcessingTaskRepository
	pyAnalyzerClient grpc_clients.PythonAudioAnalyzerClient
	audioHistoryRepo models.AudioHistoryRepository // Added for history
	userRepo         models.UserRepository         // NEW: userRepo for user checks
	appConfig        *config.Config
	logger           *logger.Logger
}

// NewAudioHandler creates a new AudioHandler.
func NewAudioHandler(
	s3Svc *s3service.S3Service,
	audioRepo models.AudioRepository,
	audioTaskRepo models.AudioProcessingTaskRepository,
	pyClient grpc_clients.PythonAudioAnalyzerClient,
	cfg *config.Config,
	appLogger *logger.Logger,
	audioHistoryRepo models.AudioHistoryRepository, // Added for history
	userRepo models.UserRepository, // NEW: userRepo for user checks
) *AudioHandler {
	return &AudioHandler{
		s3Service:        s3Svc,
		audioRepo:        audioRepo,
		audioTaskRepo:    audioTaskRepo,
		pyAnalyzerClient: pyClient,
		audioHistoryRepo: audioHistoryRepo, // Added for history
		userRepo:         userRepo,         // NEW: userRepo for user checks
		appConfig:        cfg,
		logger:           appLogger,
	}
}

// UploadAudioFile handles new audio file uploads and triggers analysis.
// POST /api/v1/audio/upload
func (h *AudioHandler) UploadAudioFile(c *gin.Context) {
	h.logger.Info("UploadAudioFile: Received request")

	claims, exists := middleware.GetCurrentUserClaims(c)
	if !exists || claims == nil {
		h.logger.Warn("UploadAudioFile: User claims not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: user claims not found"})
		return
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		h.logger.Error("UploadAudioFile: Invalid user ID in JWT claims", zap.String("user_id_str", claims.UserID), zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: invalid user ID in token"})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)
	file, header, err := c.Request.FormFile(fileFormField)
	if err != nil {
		if err.Error() == "http: request body too large" {
			h.logger.Warn("UploadAudioFile: File size limit exceeded", zap.Error(err), zap.Int64("limit_bytes", maxUploadSize))
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("File size limit exceeded. Max size: %d MB", maxUploadSize/(1024*1024))})
			return
		}
		h.logger.Error("UploadAudioFile: Error retrieving file from form", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file upload request: " + err.Error()})
		return
	}
	defer file.Close()

	originalFilename := filepath.Clean(header.Filename)
	if originalFilename == "." || originalFilename == "/" {
		originalFilename = "uploaded_file"
	}

	ext := strings.ToLower(filepath.Ext(originalFilename))
	if !allowedAudioExtensions[ext] {
		h.logger.Warn("UploadAudioFile: Invalid file extension", zap.String("filename", header.Filename), zap.String("extension", ext))
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid file format. Allowed formats: %v", getAllowedExtensionsList())})
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	baseFilename := strings.TrimSuffix(originalFilename, filepath.Ext(originalFilename))
	safeBaseFilename := strings.ReplaceAll(strings.ToLower(baseFilename), " ", "_")
	s3Key := fmt.Sprintf("%s/%d/%s%s", userID.String(), time.Now().UnixNano(), safeBaseFilename, ext)

	h.logger.Info("Attempting to upload to S3", zap.String("s3_key", s3Key), zap.String("content_type", contentType))

	// Проверка существования пользователя перед сохранением аудиофайла
	user, err := h.userRepo.GetUserByID(userID.String())
	if err != nil || user == nil {
		h.logger.Warn("User not found in DB for audio upload", zap.String("user_id", userID.String()), zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found or deleted. Please re-login."})
		return
	}

	fileURL, err := h.s3Service.UploadFile(c.Request.Context(), s3Key, file, contentType)
	if err != nil {
		h.logger.Error("Failed to upload file to S3", zap.String("s3_key", s3Key), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file to storage"})
		return
	}

	audioFileMetadata := &models.AudioFile{
		ID:               uuid.New(),
		UserID:           userID,
		S3Key:            s3Key,
		OriginalFilename: originalFilename,
		ContentType:      contentType,
		SizeBytes:        header.Size,
		UploadedAt:       time.Now(),
	}

	if saveErr := h.audioRepo.SaveAudioFile(c.Request.Context(), audioFileMetadata); saveErr != nil {
		h.logger.Error("Failed to save audio metadata to DB", zap.String("s3_key", s3Key), zap.Error(saveErr))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save audio file metadata"})
		return
	} else if saveErr == nil {
		// Диагностический лог: если вдруг логгер вызывается с nil ошибкой
		h.logger.Debug("Audio metadata saved to DB without error", zap.String("s3_key", s3Key))
	}

	h.logger.Info("Audio file uploaded and metadata saved. Triggering gRPC analysis...",
		zap.String("s3_key", s3Key),
		zap.String("bucketName", h.appConfig.S3.BucketName)) // Log bucket name from config

	// Call Python gRPC service for analysis
	// Use a new context for the gRPC call, potentially with a timeout from config or a reasonable default.
	// c.Request.Context() is for the incoming HTTP request.
	grpcCtx, grpcCancel := context.WithTimeout(context.Background(), 5*time.Minute) // Example timeout
	defer grpcCancel()

	analysisResp, err := h.pyAnalyzerClient.AnalyzeAudio(grpcCtx, h.appConfig.S3.BucketName, s3Key)

	apiResponse := UploadAndAnalyzeAudioResponse{
		FileID:  audioFileMetadata.ID,
		S3Key:   s3Key,
		Message: "Аудиофайл был успешно загружен. Начинаем анализ...",
		FileURL: fileURL,
	}

	if err != nil {
		h.logger.Error("Failed to call Python gRPC audio analysis service", zap.String("s3_key", s3Key), zap.Error(err))
		apiResponse.Message = "Аудиофайл был загружен, но возникла ошибка при попытке анализа."
		apiResponse.AnalysisError = "gRPC call error: " + err.Error()
		// It's important to still return StatusCreated or StatusOK because the file upload part was successful.
		// The client can check the AnalysisError field.
		c.JSON(http.StatusCreated, apiResponse) // Or http.StatusInternalServerError if we consider this a full failure
		return
	}

	if analysisResp.ErrorMessage != "" {
		h.logger.Warn("Python gRPC service returned an error during analysis",
			zap.String("s3_key", s3Key),
			zap.String("python_error", analysisResp.ErrorMessage))
		apiResponse.AnalysisError = analysisResp.ErrorMessage
		apiResponse.Message = "Аудиофайл был загружен, но произошла ошибка при анализе."
	}

	if len(analysisResp.Predictions) > 0 {
		apiResponse.AnalysisResults = make([]AudioAnalysisResult, len(analysisResp.Predictions))
		for i, pred := range analysisResp.Predictions {
			apiResponse.AnalysisResults[i] = AudioAnalysisResult{
				ChunkID:        pred.ChunkId,
				Score:          pred.Score,
				StartTimestamp: pred.StartTimeSeconds,
				EndTimestamp:   pred.EndTimeSeconds,
			}
		}
		if apiResponse.AnalysisError == "" { // If there was no major gRPC or Python error
			apiResponse.Message = "Аудиофайл был успешно проанализирован."
		}
	}

	h.logger.Info("Audio analysis complete", zap.String("s3_key", s3Key), zap.Int("predictions_count", len(apiResponse.AnalysisResults)))

	// Log the actual analysis results
	if len(apiResponse.AnalysisResults) > 0 {
		h.logger.Info("Detailed Analysis Results:", zap.Any("results", apiResponse.AnalysisResults))
	} else {
		h.logger.Info("No analysis results to log.")
	}

	// Save to history after successful analysis or even if analysis had errors but upload was fine
	// We need to decide what probability to store. For now, let's assume an overall probability
	// might be derived or a default one used if detailed predictions are not the focus for the main history list.
	// For simplicity, if there are predictions, we can average them or take the highest.
	// If no predictions or error, maybe store a specific value or null.
	// Let's assume for now we store a general probability if available, or 0 if not.

	// For demonstration, let's calculate an average probability from analysis results if available.
	var overallProbability float64
	if len(apiResponse.AnalysisResults) > 0 {
		var sumPercent float64
		for _, res := range apiResponse.AnalysisResults {
			percent := math.Round(float64(res.Score) * 100)
			sumPercent += percent
		}
		overallProbability = math.Round(sumPercent / float64(len(apiResponse.AnalysisResults)))
	}

	// Convert apiResponse.AnalysisResults to json.RawMessage for storage
	var analysisDetailsJSON []byte
	if len(apiResponse.AnalysisResults) > 0 {
		var errMarshal error
		analysisDetailsJSON, errMarshal = json.Marshal(apiResponse.AnalysisResults)
		if errMarshal != nil {
			h.logger.Error("Failed to marshal analysis results for history", zap.Error(errMarshal), zap.String("s3_key", s3Key))
			// Decide if this is critical enough to prevent history saving or just log
		}
	}

	historyEntry := &models.AudioHistoryEntry{
		ID:              uuid.New(),
		UserID:          userID,
		Filename:        originalFilename,
		FileSize:        fmt.Sprintf("%.2f KB", float64(header.Size)/1024), // Or store raw bytes and format in frontend
		Probability:     overallProbability,                                // Теперь это целое число процентов
		S3Key:           &s3Key,
		OriginalFileID:  &audioFileMetadata.ID,
		AnalysisDetails: analysisDetailsJSON, // Store marshaled results
		AnalysisDate:    time.Now(),
	}

	if err := h.audioHistoryRepo.CreateAudioHistoryEntry(historyEntry); err != nil {
		h.logger.Error("Failed to save audio analysis to history", zap.Error(err), zap.String("user_id", userID.String()), zap.String("s3_key", s3Key))
		// Do not fail the main request for this, just log it.
		// The main operation (upload and analysis) might have succeeded.
	}

	c.JSON(http.StatusCreated, apiResponse)
}

// Helper function to get list of allowed extensions for error message
func getAllowedExtensionsList() []string {
	extensions := make([]string, 0, len(allowedAudioExtensions))
	for ext := range allowedAudioExtensions {
		extensions = append(extensions, ext)
	}
	return extensions
}
