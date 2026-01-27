package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"prediction-market/internal/auth"
	"prediction-market/internal/services"
)

type ReferralHandler struct {
	db                 *gorm.DB
	referralService    *services.ReferralService
	socialShareService *services.SocialShareService
}

func NewReferralHandler(db *gorm.DB) *ReferralHandler {
	return &ReferralHandler{
		db:                 db,
		referralService:    services.NewReferralService(db),
		socialShareService: services.NewSocialShareService(db),
	}
}

// GetReferralCode returns user's referral code
func (h *ReferralHandler) GetReferralCode(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	code, err := h.referralService.GetUserReferralCode(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get referral code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    code,
	})
}

// ApplyReferralCode applies a referral code to the current user
func (h *ReferralHandler) ApplyReferralCode(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.referralService.ValidateAndApplyReferralCode(userID, req.Code); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Referral code applied successfully",
	})
}

// GetReferralStats returns referral statistics for a user
func (h *ReferralHandler) GetReferralStats(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	stats, err := h.referralService.GetReferralStats(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetReferrals returns all referrals for a user
func (h *ReferralHandler) GetReferrals(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	referrals, err := h.referralService.GetUserReferrals(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get referrals"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    referrals,
		"count":   len(referrals),
	})
}

// GetReferralRebates returns all rebates earned
func (h *ReferralHandler) GetReferralRebates(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	rebates, err := h.referralService.GetReferralRebates(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get rebates"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    rebates,
		"count":   len(rebates),
	})
}

// ShareWinOnTwitter creates a social share record
func (h *ReferralHandler) ShareWinOnTwitter(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		MarketID  uint   `json:"market_id" binding:"required"`
		PnLAmount string `json:"pnl_amount" binding:"required"`
		ShareURL  string `json:"share_url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pnlAmount, err := decimal.NewFromString(req.PnLAmount)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid pnl_amount"})
		return
	}

	share, err := h.socialShareService.ShareWinOnTwitter(userID, req.MarketID, pnlAmount, req.ShareURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create share"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    share,
	})
}

// GetSocialShares returns all social shares for a user
func (h *ReferralHandler) GetSocialShares(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	shares, err := h.socialShareService.GetUserSocialShares(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get shares"})
		return
	}

	totalBonus, _ := h.socialShareService.GetTotalSocialBonus(userID)

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"data":        shares,
		"count":       len(shares),
		"total_bonus": totalBonus,
	})
}
