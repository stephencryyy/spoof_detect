package handlers

import (
	"net/http"

	"example.com/auth_service/internal/middleware"
	"example.com/auth_service/internal/models"
	"example.com/auth_service/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AudioHistoryHandler handles HTTP requests related to audio history.
type AudioHistoryHandler struct {
	repo   models.AudioHistoryRepository
	logger *logger.Logger // Changed to use custom logger type
}

// NewAudioHistoryHandler creates a new AudioHistoryHandler.
func NewAudioHistoryHandler(repo models.AudioHistoryRepository, logger *logger.Logger) *AudioHistoryHandler { // Changed to use custom logger type
	return &AudioHistoryHandler{repo: repo, logger: logger}
}

// GetHistory retrieves the audio history for the authenticated user.
// @Summary Get audio history
// @Description Retrieves all audio history entries for the currently authenticated user.
// @Tags audio-history
// @Security BearerAuth
// @Produce json
// @Success 200 {array} models.AudioHistoryEntry
// @Failure 401 {object} models.ErrorResponse "Unauthorized"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /history [get]
func (h *AudioHistoryHandler) GetHistory(c *gin.Context) {
	claims, exists := middleware.GetCurrentUserClaims(c)
	if !exists {
		h.logger.Warn("User claims not found in context")
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Unauthorized: User claims missing"})
		return
	}

	userID, err := uuid.Parse(claims.UserID) // Assuming claims.UserID is the string representation of UUID
	if err != nil {
		h.logger.Error("Failed to parse user ID from claims", zap.Error(err), zap.String("userIDFromClaims", claims.UserID))
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Unauthorized: Invalid user ID format in claims"})
		return
	}

	historyEntries, err := h.repo.GetAudioHistoryByUserID(userID)
	if err != nil {
		h.logger.Error("Failed to get audio history for user", zap.Error(err), zap.String("user_id", userID.String()))
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to retrieve audio history"})
		return
	}

	h.logger.Info("Audio history loaded", zap.String("user_id", userID.String()), zap.Int("count", len(historyEntries)))
	if len(historyEntries) > 0 {
		maxLog := 5
		if len(historyEntries) < maxLog {
			maxLog = len(historyEntries)
		}
		for i := 0; i < maxLog; i++ {
			h.logger.Debug("History entry", zap.Any("entry", historyEntries[i]))
		}
	}

	if historyEntries == nil {
		historyEntries = []*models.AudioHistoryEntry{} // Return empty array instead of null
	}

	c.JSON(http.StatusOK, historyEntries)
}

// DeleteHistoryEntry deletes a specific audio history entry for the authenticated user.
// @Summary Delete audio history entry
// @Description Deletes a specific audio history entry by its ID for the currently authenticated user.
// @Tags audio-history
// @Security BearerAuth
// @Param entryId path string true "History Entry ID (UUID)"
// @Success 200 {object} models.SuccessResponse "Entry deleted successfully"
// @Failure 400 {object} models.ErrorResponse "Invalid entry ID format"
// @Failure 401 {object} models.ErrorResponse "Unauthorized"
// @Failure 404 {object} models.ErrorResponse "Entry not found or not authorized to delete"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /history/{entryId} [delete]
func (h *AudioHistoryHandler) DeleteHistoryEntry(c *gin.Context) {
	claims, exists := middleware.GetCurrentUserClaims(c)
	if !exists {
		h.logger.Warn("User claims not found in context for deleting history entry")
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Unauthorized: User claims missing"})
		return
	}
	userID, err := uuid.Parse(claims.UserID) // Assuming claims.UserID is the string representation of UUID
	if err != nil {
		h.logger.Error("Failed to parse user ID from claims for deleting history entry", zap.Error(err), zap.String("userIDFromClaims", claims.UserID))
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Unauthorized: Invalid user ID format in claims"})
		return
	}

	entryIDstr := c.Param("entryId")
	entryID, err := uuid.Parse(entryIDstr)
	if err != nil {
		h.logger.Error("Invalid history entry ID format", zap.Error(err), zap.String("entryIDstr", entryIDstr))
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid history entry ID format"})
		return
	}

	err = h.repo.DeleteAudioHistoryEntry(entryID, userID)
	if err != nil {
		if err == models.ErrNotFound { // Assuming ErrNotFound is returned for not found or not authorized
			h.logger.Warn("History entry not found or user not authorized to delete", zap.String("entry_id", entryID.String()), zap.String("user_id", userID.String()))
			c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "History entry not found or you are not authorized to delete it"})
			return
		}
		h.logger.Error("Failed to delete audio history entry", zap.Error(err), zap.String("entry_id", entryID.String()), zap.String("user_id", userID.String()))
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to delete audio history entry"})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "History entry deleted successfully"})
}

// ClearHistory deletes all audio history entries for the authenticated user.
// @Summary Clear all audio history
// @Description Deletes all audio history entries for the currently authenticated user.
// @Tags audio-history
// @Security BearerAuth
// @Success 200 {object} models.SuccessResponse "History cleared successfully"
// @Failure 401 {object} models.ErrorResponse "Unauthorized"
// @Failure 500 {object} models.ErrorResponse "Internal server error"
// @Router /history [delete]
func (h *AudioHistoryHandler) ClearHistory(c *gin.Context) {
	claims, exists := middleware.GetCurrentUserClaims(c)
	if !exists {
		h.logger.Warn("User claims not found in context for clearing history")
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Unauthorized: User claims missing"})
		return
	}
	userID, err := uuid.Parse(claims.UserID) // Assuming claims.UserID is the string representation of UUID
	if err != nil {
		h.logger.Error("Failed to parse user ID from claims for clearing history", zap.Error(err), zap.String("userIDFromClaims", claims.UserID))
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Unauthorized: Invalid user ID format in claims"})
		return
	}

	err = h.repo.ClearAudioHistoryByUserID(userID)
	if err != nil {
		h.logger.Error("Failed to clear audio history for user", zap.Error(err), zap.String("user_id", userID.String()))
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to clear audio history"})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Audio history cleared successfully"})
}
