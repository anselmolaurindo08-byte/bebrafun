package handlers

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"

	"prediction-market/internal/auth"
	"prediction-market/internal/models"
	"prediction-market/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DuelHandler struct {
	duelService *services.DuelService
}

func NewDuelHandler(duelService *services.DuelService) *DuelHandler {
	return &DuelHandler{
		duelService: duelService,
	}
}

// CreateDuel creates a new duel
// POST /api/duels
func (h *DuelHandler) CreateDuel(c *gin.Context) {
	playerID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.CreateDuelRequest

	// DEBUG: Read and log raw JSON body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}
	log.Printf("[CreateDuel Handler] Raw JSON body: %s", string(bodyBytes))

	// Restore body for binding
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// DEBUG: Log parsed direction value
	if req.Direction != nil {
		log.Printf("[CreateDuel Handler] Parsed Direction: %d", *req.Direction)
	} else {
		log.Printf("[CreateDuel Handler] Parsed Direction: nil")
	}

	duel, err := h.duelService.CreateDuel(c.Request.Context(), playerID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, duel)
}

// GetDuel retrieves a duel by ID
// GET /api/duels/:id
func (h *DuelHandler) GetDuel(c *gin.Context) {
	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	duel, err := h.duelService.GetDuelByID(c.Request.Context(), duelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "duel not found"})
		return
	}

	c.JSON(http.StatusOK, duel)
}

// GetPlayerDuels retrieves all duels for the current player
// GET /api/duels
func (h *DuelHandler) GetPlayerDuels(c *gin.Context) {
	playerID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Parse pagination parameters
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

	duels, err := h.duelService.GetPlayerDuels(c.Request.Context(), playerID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get duels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"duels": duels,
		"total": len(duels),
	})
}

// GetPlayerStatistics retrieves duel statistics for the current player
// GET /api/duels/stats
func (h *DuelHandler) GetPlayerStatistics(c *gin.Context) {
	playerID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	stats, err := h.duelService.GetPlayerStatistics(c.Request.Context(), playerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get statistics"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// JoinDuel allows a player to join/accept a pending duel
// POST /api/duels/:id/join
func (h *DuelHandler) JoinDuel(c *gin.Context) {
	playerID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	var req struct {
		Signature string `json:"signature" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "signature required"})
		return
	}

	duel, err := h.duelService.JoinDuel(c.Request.Context(), duelID, playerID, req.Signature)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, duel)
}

// DepositToDuel deposits tokens to a duel escrow
// POST /api/duels/:id/deposit
func (h *DuelHandler) DepositToDuel(c *gin.Context) {
	_, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	var req struct {
		Signature string `json:"signature" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Determine player number (1 or 2)
	duel, err := h.duelService.GetDuelByID(c.Request.Context(), duelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "duel not found"})
		return
	}

	playerID, _ := auth.GetUserID(c)
	var playerNumber uint8
	if duel.Player1ID == playerID {
		playerNumber = 1
	} else if duel.Player2ID != nil && *duel.Player2ID == playerID {
		playerNumber = 2
	} else {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a participant in this duel"})
		return
	}

	err = h.duelService.DepositToDuel(c.Request.Context(), duelID, playerNumber, req.Signature)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deposit successful"})
}

// ResolveDuel resolves a duel (admin only)
// POST /api/admin/duels/:id/resolve
func (h *DuelHandler) ResolveDuel(c *gin.Context) {
	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	var req struct {
		WinnerID     string `json:"winner_id" binding:"required"`
		WinnerAmount int64  `json:"winner_amount" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Attempt to parse as int first (since our internal system uses uint IDs)
	// But the request implies string ID. If admin sends UUID string, we might have issues if we changed IDs to uint.
	// Assume admin sends uint as string or int.
	// Let's assume request binding supports it if we change struct, OR we parse int.

	// Wait, req.WinnerID is string in handler.
	winnerIDUint, err := strconv.ParseUint(req.WinnerID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid winner id (expected uint)"})
		return
	}
	winnerID := uint(winnerIDUint)

	err = h.duelService.ResolveDuel(c.Request.Context(), duelID, winnerID, req.WinnerAmount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "duel resolved"})
}

// CancelDuel cancels a pending duel
// POST /api/duels/:id/cancel
func (h *DuelHandler) CancelDuel(c *gin.Context) {
	playerID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	err = h.duelService.CancelDuel(c.Request.Context(), duelID, playerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "duel cancelled"})
}

// GetActiveDuels retrieves all active duels (admin only)
// GET /api/admin/duels/active
func (h *DuelHandler) GetActiveDuels(c *gin.Context) {
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	duels, err := h.duelService.GetActiveDuels(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get active duels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"duels": duels,
		"total": len(duels),
	})
}

// ============================================================================
// Enhanced Duel Handler Methods
// ============================================================================

// GetAvailableDuels retrieves pending duels available for joining
// GET /api/duels/available
func (h *DuelHandler) GetAvailableDuels(c *gin.Context) {
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

	duels, total, err := h.duelService.GetAvailableDuels(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get available duels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"duels": duels,
			"total": total,
		},
	})
}

// GetUserDuels retrieves all duels for a specific user
// GET /api/duels/user/:userId
func (h *DuelHandler) GetUserDuels(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
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

	duels, total, err := h.duelService.GetUserDuels(c.Request.Context(), uint(userID), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user duels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"duels": duels,
			"total": total,
		},
	})
}

// ConfirmTransaction records a transaction confirmation
// POST /api/duels/confirm-transaction
func (h *DuelHandler) ConfirmTransaction(c *gin.Context) {
	var req models.ConfirmTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	duelID, err := uuid.Parse(req.DuelID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	confirmation, err := h.duelService.RecordTransactionConfirmation(
		c.Request.Context(),
		duelID,
		req.TransactionHash,
		0, // Initial confirmations
		"pending",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    confirmation,
	})
}

// CheckConfirmations checks the confirmation status of a transaction
// GET /api/duels/confirmations/:transactionHash
func (h *DuelHandler) CheckConfirmations(c *gin.Context) {
	txHash := c.Param("transactionHash")
	if txHash == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "transaction hash required"})
		return
	}

	record, err := h.duelService.GetTransactionConfirmation(c.Request.Context(), txHash)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"confirmations": 0,
				"status":        "pending",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"confirmations": record.Confirmations,
			"status":        record.Status,
		},
	})
}

// GetDuelResult retrieves the result of a resolved duel
// GET /api/duels/:id/result
func (h *DuelHandler) GetDuelResult(c *gin.Context) {
	duelID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	result, err := h.duelService.GetDuelResult(c.Request.Context(), duelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "duel result not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// ResolveDuelWithPrice resolves a duel using price data
// POST /api/duels/resolve
func (h *DuelHandler) ResolveDuelWithPrice(c *gin.Context) {
	var req models.ResolveDuelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	duelID, err := uuid.Parse(req.DuelID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel id"})
		return
	}

	winnerIDUint, err := strconv.ParseUint(req.WinnerID, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid winner id"})
		return
	}

	result, err := h.duelService.ResolveDuelWithPrice(
		c.Request.Context(),
		duelID,
		uint(winnerIDUint),
		req.ExitPrice,
		req.TransactionHash,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

// ShareOnX generates a share URL for Twitter/X
// POST /api/duels/share/x
func (h *DuelHandler) ShareOnX(c *gin.Context) {
	var req models.ShareRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	shareURL, tweetText := h.duelService.GenerateShareURL(
		req.AmountWon,
		req.Currency,
		req.LoserUsername,
		req.ReferralCode,
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"shareUrl":  url.QueryEscape(shareURL),
			"tweetText": tweetText,
		},
	})
}

// GetConfig returns duel configuration including server wallet
// GET /api/duels/config
func (h *DuelHandler) GetConfig(c *gin.Context) {
	serverWallet := os.Getenv("SERVER_WALLET_PUBLIC_KEY")
	network := os.Getenv("SOLANA_NETWORK")

	if serverWallet == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server wallet not configured"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"serverWallet": serverWallet,
		"network":      network,
	})
}

// AutoResolveDuel automatically resolves a duel when timer expires
// POST /api/duels/:id/auto-resolve
func (h *DuelHandler) AutoResolveDuel(c *gin.Context) {
	duelIDStr := c.Param("id")
	duelID, err := uuid.Parse(duelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel ID"})
		return
	}

	var req struct {
		ExitPrice float64 `json:"exit_price" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.duelService.AutoResolveDuel(c.Request.Context(), duelID, req.ExitPrice)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ClaimWinnings allows the winner to claim their winnings from a resolved duel
// POST /api/duels/:id/claim
func (h *DuelHandler) ClaimWinnings(c *gin.Context) {
	playerID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	duelIDStr := c.Param("id")
	duelID, err := uuid.Parse(duelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel ID"})
		return
	}

	result, err := h.duelService.ClaimWinnings(c.Request.Context(), duelID, playerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// SetChartStartPrice sets the chart start price for a duel
// POST /api/duels/:id/chart-start
func (h *DuelHandler) SetChartStartPrice(c *gin.Context) {
	duelIDStr := c.Param("id")
	duelID, err := uuid.Parse(duelIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid duel ID"})
		return
	}

	var req struct {
		Price float64 `json:"price" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.duelService.SetChartStartPrice(c.Request.Context(), duelID, req.Price)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
