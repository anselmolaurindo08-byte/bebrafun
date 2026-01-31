package handlers

import (
	"net/http"
	"strconv"
	"time"

	"prediction-market/internal/models"
	"prediction-market/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AMMHandler struct {
	ammService *services.AMMService
}

func NewAMMHandler(ammService *services.AMMService) *AMMHandler {
	return &AMMHandler{
		ammService: ammService,
	}
}

// GetPool retrieves a pool by ID
// GET /api/amm/pools/:id
func (h *AMMHandler) GetPool(c *gin.Context) {
	poolID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pool id"})
		return
	}

	pool, err := h.ammService.GetPool(c.Request.Context(), poolID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found"})
		return
	}

	c.JSON(http.StatusOK, h.ammService.ToPoolResponse(pool))
}

// GetPoolByMarket retrieves a pool by market ID
// GET /api/amm/pools/market/:market_id
func (h *AMMHandler) GetPoolByMarket(c *gin.Context) {
	marketID, err := strconv.ParseUint(c.Param("market_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid market id"})
		return
	}

	pool, err := h.ammService.GetPoolByMarketID(c.Request.Context(), uint(marketID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "pool not found for this market"})
		return
	}

	c.JSON(http.StatusOK, h.ammService.ToPoolResponse(pool))
}

// GetAllPools retrieves all active pools
// GET /api/amm/pools
func (h *AMMHandler) GetAllPools(c *gin.Context) {
	limit := 20
	offset := 0

	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	pools, err := h.ammService.GetAllPools(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get pools"})
		return
	}

	responses := make([]interface{}, len(pools))
	for i := range pools {
		responses[i] = h.ammService.ToPoolResponse(&pools[i])
	}

	c.JSON(http.StatusOK, gin.H{
		"pools": responses,
		"total": len(responses),
	})
}

// CreatePool creates a new AMM pool
// POST /api/amm/pools
func (h *AMMHandler) CreatePool(c *gin.Context) {
	var req models.CreatePoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pool, err := h.ammService.CreatePool(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, h.ammService.ToPoolResponse(pool))
}

// GetTradeQuote calculates a trade quote
// GET /api/amm/quote
func (h *AMMHandler) GetTradeQuote(c *gin.Context) {
	poolIDStr := c.Query("pool_id")
	inputAmountStr := c.Query("input_amount")
	tradeTypeStr := c.Query("trade_type")

	if poolIDStr == "" || inputAmountStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pool_id and input_amount are required"})
		return
	}

	poolID, err := uuid.Parse(poolIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pool_id"})
		return
	}

	inputAmount, err := strconv.ParseInt(inputAmountStr, 10, 64)
	if err != nil || inputAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input_amount"})
		return
	}

	tradeType := int16(0)
	if tradeTypeStr != "" {
		tt, err := strconv.ParseInt(tradeTypeStr, 10, 16)
		if err != nil || tt < 0 || tt > 3 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid trade_type (0-3)"})
			return
		}
		tradeType = int16(tt)
	}

	quote, err := h.ammService.GetTradeQuote(c.Request.Context(), poolID, inputAmount, tradeType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// RecordTrade records a trade after blockchain confirmation
// POST /api/amm/trades
func (h *AMMHandler) RecordTrade(c *gin.Context) {
	var req struct {
		PoolID               string `json:"pool_id" binding:"required"`
		UserAddress          string `json:"user_address" binding:"required"`
		TradeType            int16  `json:"trade_type" binding:"min=0,max=3"`
		InputAmount          int64  `json:"input_amount" binding:"required,min=1"`
		OutputAmount         int64  `json:"output_amount" binding:"required,min=1"`
		FeeAmount            int64  `json:"fee_amount"`
		TransactionSignature string `json:"transaction_signature" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tradeReq := &models.RecordTradeRequest{
		PoolID:               req.PoolID,
		TradeType:            req.TradeType,
		InputAmount:          req.InputAmount,
		OutputAmount:         req.OutputAmount,
		FeeAmount:            req.FeeAmount,
		TransactionSignature: req.TransactionSignature,
	}

	trade, err := h.ammService.RecordTrade(c.Request.Context(), req.UserAddress, tradeReq)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, trade)
}

// GetUserPosition retrieves a user's position in a pool
// GET /api/amm/positions/:pool_id/:user_address
func (h *AMMHandler) GetUserPosition(c *gin.Context) {
	poolID, err := uuid.Parse(c.Param("pool_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pool_id"})
		return
	}

	userAddress := c.Param("user_address")
	if userAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_address is required"})
		return
	}

	position, err := h.ammService.GetUserPosition(c.Request.Context(), poolID, userAddress)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "position not found"})
		return
	}

	c.JSON(http.StatusOK, position)
}

// GetUserPositions retrieves all positions for a user
// GET /api/amm/positions/:user_address
func (h *AMMHandler) GetUserPositions(c *gin.Context) {
	userAddress := c.Param("user_address")
	if userAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_address is required"})
		return
	}

	positions, err := h.ammService.GetUserPositions(c.Request.Context(), userAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get positions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"positions": positions,
		"total":     len(positions),
	})
}

// GetTradeHistory retrieves trade history for a pool
// GET /api/amm/trades/:pool_id
func (h *AMMHandler) GetTradeHistory(c *gin.Context) {
	poolID, err := uuid.Parse(c.Param("pool_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pool_id"})
		return
	}

	limit := 20
	offset := 0
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	trades, err := h.ammService.GetTradeHistory(c.Request.Context(), poolID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get trades"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"trades": trades,
		"total":  len(trades),
	})
}

// GetPriceHistory retrieves price candles for a pool
// GET /api/amm/prices/:pool_id
func (h *AMMHandler) GetPriceHistory(c *gin.Context) {
	poolID, err := uuid.Parse(c.Param("pool_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid pool_id"})
		return
	}

	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}

	// Default: last 24 hours
	endTime := time.Now()
	startTime := endTime.Add(-24 * time.Hour)

	if startStr := c.Query("start_time"); startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = t
		}
	}
	if endStr := c.Query("end_time"); endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = t
		}
	}

	candles, err := h.ammService.GetPriceHistory(c.Request.Context(), poolID, startTime, endTime, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get price history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"candles": candles,
		"total":   len(candles),
	})
}
