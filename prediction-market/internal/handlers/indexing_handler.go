package handlers

import (
	"net/http"

	"prediction-market/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// IndexPoolCreation indexes a pool creation from an on-chain transaction
// POST /api/amm/pools/index
func (h *AMMHandler) IndexPoolCreation(c *gin.Context) {
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, h.ammService.ToPoolResponse(pool))
}

// DuelHandler struct for duel indexing endpoints
type DuelIndexHandler struct {
	duelService *services.DuelService
}

func NewDuelIndexHandler(duelService *services.DuelService) *DuelIndexHandler {
	return &DuelIndexHandler{
		duelService: duelService,
	}
}

// IndexDuelCreation indexes a duel creation from an on-chain transaction
// POST /api/duels/index
func (h *DuelIndexHandler) IndexDuelCreation(c *gin.Context) {
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, duel)
}

// IndexDuelJoin indexes a duel join from an on-chain transaction
// POST /api/duels/:id/join/index
func (h *DuelIndexHandler) IndexDuelJoin(c *gin.Context) {
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, duel)
}
