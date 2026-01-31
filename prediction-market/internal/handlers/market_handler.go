package handlers

import (
	"net/http"
	"strconv"
	"time"

	"prediction-market/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MarketHandler struct {
	db *gorm.DB
}

func NewMarketHandler(db *gorm.DB) *MarketHandler {
	return &MarketHandler{db: db}
}

// GetMarkets returns all active markets with optional filtering
func (h *MarketHandler) GetMarkets(c *gin.Context) {
	category := c.Query("category")
	status := c.DefaultQuery("status", "active")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")

	limitInt, _ := strconv.Atoi(limit)
	offsetInt, _ := strconv.Atoi(offset)

	var markets []models.Market
	query := h.db.Where("status = ?", status)

	if category != "" {
		query = query.Where("category = ?", category)
	}

	if err := query.Limit(limitInt).Offset(offsetInt).Preload("Events").Find(&markets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch markets"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    markets,
		"count":   len(markets),
	})
}

// GetMarketByID returns a specific market with its events
func (h *MarketHandler) GetMarketByID(c *gin.Context) {
	marketID := c.Param("id")

	var market models.Market
	if err := h.db.Where("id = ?", marketID).Preload("Events").First(&market).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Market not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch market"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    market,
	})
}

// CreateMarket creates a new market (admin only)
func (h *MarketHandler) CreateMarket(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Title       string   `json:"title" binding:"required"`
		Description string   `json:"description"`
		Category    string   `json:"category" binding:"required"`
		Outcomes    []string `json:"outcomes" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDUint := userID.(uint)
	market := models.Market{
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Status:      "active",
		CreatedBy:   &userIDUint,
	}

	if err := h.db.Create(&market).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create market"})
		return
	}

	// Create market events
	events := make([]models.MarketEvent, len(req.Outcomes))
	for i, outcome := range req.Outcomes {
		events[i] = models.MarketEvent{
			MarketID:         market.ID,
			EventTitle:       outcome,
			EventDescription: outcome,
			OutcomeType:      outcome,
		}
	}
	h.db.Create(&events)

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    market,
	})
}

// ProposeMarket allows users to propose new markets
func (h *MarketHandler) ProposeMarket(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Category    string `json:"category" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	proposal := models.UserProposal{
		UserID:            userID.(uint),
		MarketTitle:       req.Title,
		MarketDescription: req.Description,
		Category:          req.Category,
		Status:            "pending",
	}

	if err := h.db.Create(&proposal).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create proposal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    proposal,
	})
}

// GetPendingProposals returns all pending market proposals (admin only)
func (h *MarketHandler) GetPendingProposals(c *gin.Context) {
	var proposals []models.UserProposal
	if err := h.db.Where("status = ?", "pending").Find(&proposals).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch proposals"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    proposals,
		"count":   len(proposals),
	})
}

// ModerateProposal approves or rejects a market proposal (admin only)
func (h *MarketHandler) ModerateProposal(c *gin.Context) {
	proposalID := c.Param("id")

	var req struct {
		Action string `json:"action" binding:"required"` // "approve" or "reject"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Action != "approve" && req.Action != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action"})
		return
	}

	var proposal models.UserProposal
	if err := h.db.Where("id = ?", proposalID).First(&proposal).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proposal not found"})
		return
	}

	if req.Action == "approve" {
		// Create market from proposal
		market := models.Market{
			Title:       proposal.MarketTitle,
			Description: proposal.MarketDescription,
			Category:    proposal.Category,
			Status:      "active",
		}

		if err := h.db.Create(&market).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create market"})
			return
		}

		// Update proposal status
		h.db.Model(&proposal).Update("status", "approved")

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Proposal approved and market created",
			"market":  market,
		})
	} else {
		// Reject proposal
		h.db.Model(&proposal).Update("status", "rejected")

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Proposal rejected",
		})
	}
}

// ResolveMarket resolves a market with a specific outcome (admin only)
func (h *MarketHandler) ResolveMarket(c *gin.Context) {
	marketID := c.Param("id")

	var req struct {
		Outcome string `json:"outcome" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var market models.Market
	if err := h.db.Where("id = ?", marketID).First(&market).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Market not found"})
		return
	}

	now := time.Now()
	if err := h.db.Model(&market).Updates(map[string]interface{}{
		"status":             "resolved",
		"resolution_outcome": req.Outcome,
		"resolved_at":        now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve market"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Market resolved",
		"data":    market,
	})
}
