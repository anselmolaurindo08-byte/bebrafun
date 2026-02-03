package handlers

import (
	"net/http"

	"prediction-market/internal/models"
	"prediction-market/internal/services"

	"github.com/gin-gonic/gin"
)

// PositionHandler handles HTTP requests for user positions
type PositionHandler struct {
	positionService *services.PositionService
}

// NewPositionHandler creates a new position handler
func NewPositionHandler(positionService *services.PositionService) *PositionHandler {
	return &PositionHandler{
		positionService: positionService,
	}
}

// CreatePosition handles POST /api/positions
func (h *PositionHandler) CreatePosition(c *gin.Context) {
	var req models.CreatePositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	position, err := h.positionService.CreatePosition(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, h.positionService.ToPositionResponse(position))
}

// GetUserPositions handles GET /api/positions/:user_address
func (h *PositionHandler) GetUserPositions(c *gin.Context) {
	userAddress := c.Param("user_address")
	poolID := c.Query("pool_id") // Optional filter by pool

	var poolIDPtr *string
	if poolID != "" {
		poolIDPtr = &poolID
	}

	positions, err := h.positionService.GetUserPositions(c.Request.Context(), userAddress, poolIDPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	responses := make([]*models.PositionResponse, len(positions))
	for i, pos := range positions {
		responses[i] = h.positionService.ToPositionResponse(&pos)
	}

	c.JSON(http.StatusOK, gin.H{
		"positions": responses,
		"total":     len(responses),
	})
}

// GetPoolPositions handles GET /api/positions/pool/:pool_id
func (h *PositionHandler) GetPoolPositions(c *gin.Context) {
	poolID := c.Param("pool_id")

	positions, err := h.positionService.GetPoolPositions(c.Request.Context(), poolID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	responses := make([]*models.PositionResponse, len(positions))
	for i, pos := range positions {
		responses[i] = h.positionService.ToPositionResponse(&pos)
	}

	c.JSON(http.StatusOK, gin.H{
		"positions": responses,
		"total":     len(responses),
	})
}

// GetPosition handles GET /api/positions/detail/:id
func (h *PositionHandler) GetPosition(c *gin.Context) {
	positionID := c.Param("id")

	position, err := h.positionService.GetPosition(c.Request.Context(), positionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, h.positionService.ToPositionResponse(position))
}

// ClosePosition handles POST /api/positions/:id/close
func (h *PositionHandler) ClosePosition(c *gin.Context) {
	positionID := c.Param("id")

	var req models.ClosePositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.positionService.ClosePosition(c.Request.Context(), positionID, req.ExitPrice, req.SolReceived); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Position closed successfully"})
}
