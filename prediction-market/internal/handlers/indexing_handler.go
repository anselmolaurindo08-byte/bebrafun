package handlers

import (
	"net/http"

	"prediction-market/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IndexingHandler handles indexing of on-chain events
type IndexingHandler struct {
	ammService  *services.AMMService
	duelService *services.DuelService
}

// NewIndexingHandler creates a new indexing handler
func NewIndexingHandler(ammService *services.AMMService, duelService *services.DuelService) *IndexingHandler {
	return &IndexingHandler{
		ammService:  ammService,
		duelService: duelService,
	}
}

// IndexPoolCreation indexes a pool creation from an on-chain transaction
// POST /api/amm/pools/index
func (h *IndexingHandler) IndexPoolCreation(c *gin.Context) {
	var req struct {
		TransactionSignature string `json:"transaction_signature" binding:"required"`
		MarketID             *uint  `json:"market_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pool, err := h.ammService.IndexPoolCreation(c.Request.Context(), req.TransactionSignature, req.MarketID)
	if err != nil {
		// Determine appropriate status code based on error
		statusCode := http.StatusInternalServerError
		errMsg := err.Error()

		switch {
		case contains(errMsg, "not found"):
			statusCode = http.StatusNotFound
		case contains(errMsg, "not confirmed"):
			statusCode = http.StatusConflict
		case contains(errMsg, "invalid"):
			statusCode = http.StatusBadRequest
		}

		c.JSON(statusCode, gin.H{"error": errMsg})
		return
	}

	c.JSON(http.StatusCreated, h.ammService.ToPoolResponse(pool))
}

// IndexDuelCreation indexes a duel creation from an on-chain transaction
// POST /api/duels/index
func (h *IndexingHandler) IndexDuelCreation(c *gin.Context) {
	var req struct {
		TransactionSignature string `json:"transaction_signature" binding:"required"`
		PlayerID             uint   `json:"player_id" binding:"required"`
		MarketID             *uint  `json:"market_id"`
		EventID              *uint  `json:"event_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	duel, err := h.duelService.IndexDuelCreation(
		c.Request.Context(),
		req.TransactionSignature,
		req.PlayerID,
		req.MarketID,
		req.EventID,
	)
	if err != nil {
		// Determine appropriate status code based on error
		statusCode := http.StatusInternalServerError
		errMsg := err.Error()

		switch {
		case contains(errMsg, "not found"):
			statusCode = http.StatusNotFound
		case contains(errMsg, "not confirmed"):
			statusCode = http.StatusConflict
		case contains(errMsg, "invalid"):
			statusCode = http.StatusBadRequest
		}

		c.JSON(statusCode, gin.H{"error": errMsg})
		return
	}

	c.JSON(http.StatusCreated, duel)
}

// IndexDuelJoin indexes a duel join from an on-chain transaction
// POST /api/duels/:id/join/index
func (h *IndexingHandler) IndexDuelJoin(c *gin.Context) {
	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	var req struct {
		TransactionSignature string `json:"transaction_signature" binding:"required"`
		PlayerID             uint   `json:"player_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	duel, err := h.duelService.IndexDuelJoin(
		c.Request.Context(),
		duelID,
		req.PlayerID,
		req.TransactionSignature,
	)
	if err != nil {
		// Determine appropriate status code based on error
		statusCode := http.StatusInternalServerError
		errMsg := err.Error()

		switch {
		case contains(errMsg, "not found"):
			statusCode = http.StatusNotFound
		case contains(errMsg, "not confirmed"):
			statusCode = http.StatusConflict
		case contains(errMsg, "invalid"):
			statusCode = http.StatusBadRequest
		}

		c.JSON(statusCode, gin.H{"error": errMsg})
		return
	}

	c.JSON(http.StatusOK, duel)
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
