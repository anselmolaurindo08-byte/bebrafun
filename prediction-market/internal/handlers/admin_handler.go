package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"prediction-market/internal/models"
	"prediction-market/internal/services"
)

type AdminHandler struct {
	db           *gorm.DB
	adminService *services.AdminService
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{
		db:           db,
		adminService: services.NewAdminService(db),
	}
}

// AdminMiddleware checks if user is admin
func (h *AdminHandler) AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		admin, err := h.adminService.GetAdminByUserID(userID.(uint))
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Not an admin"})
			c.Abort()
			return
		}

		c.Set("admin_id", admin.ID)
		c.Set("admin_role", admin.Role)
		c.Next()
	}
}

// SuperAdminMiddleware checks if user is super admin
func (h *AdminHandler) SuperAdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("admin_role")
		if !exists || role != "SUPER_ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Super admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// GetDashboard returns admin dashboard data
func (h *AdminHandler) GetDashboard(c *gin.Context) {
	stats, _ := h.adminService.GetPlatformStats(time.Now())

	var totalUsers int64
	var totalMarkets int64
	var totalTrades int64
	// var activeContests int64

	h.db.Model(&models.User{}).Count(&totalUsers)
	h.db.Model(&models.Market{}).Count(&totalMarkets)
	// h.db.Model(&models.Trade{}).Count(&totalTrades) // Trade model removed
	h.db.Model(&models.AMMTrade{}).Count(&totalTrades) // Use AMMTrade
	// h.db.Model(&models.Contest{}).Where("status = ?", "ACTIVE").Count(&activeContests)

	// Recent activity
	var recentLogs []models.AdminLog
	h.db.Preload("Admin").Preload("Admin.User").Order("created_at DESC").Limit(10).Find(&recentLogs)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total_users":     totalUsers,
			"total_markets":   totalMarkets,
			"total_trades":    totalTrades,
			"active_contests": 0, // Disabled
			"stats":           stats,
			"recent_logs":     recentLogs,
		},
	})
}

// GetUsers returns all users
func (h *AdminHandler) GetUsers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	search := c.Query("search")

	users, total, err := h.adminService.GetAllUsers(limit, offset, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    users,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// RestrictUser restricts a user
func (h *AdminHandler) RestrictUser(c *gin.Context) {
	adminID := c.GetUint("admin_id")

	var req struct {
		UserID          uint   `json:"user_id" binding:"required"`
		RestrictionType string `json:"restriction_type" binding:"required"`
		Reason          string `json:"reason"`
		DurationDays    *int   `json:"duration_days"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	restriction, err := h.adminService.RestrictUser(req.UserID, req.RestrictionType, req.Reason, req.DurationDays, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    restriction,
	})
}

// RemoveRestriction removes a user restriction
func (h *AdminHandler) RemoveRestriction(c *gin.Context) {
	adminID := c.GetUint("admin_id")
	restrictionID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid restriction ID"})
		return
	}

	if err := h.adminService.RemoveRestriction(uint(restrictionID), adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove restriction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Restriction removed",
	})
}

// GetUserRestrictions returns restrictions for a user
func (h *AdminHandler) GetUserRestrictions(c *gin.Context) {
	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	restrictions, err := h.adminService.GetUserRestrictions(uint(userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch restrictions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    restrictions,
	})
}

// PromoteToAdmin promotes a user to admin
func (h *AdminHandler) PromoteToAdmin(c *gin.Context) {
	adminID := c.GetUint("admin_id")

	var req struct {
		UserID uint   `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Role != "SUPER_ADMIN" && req.Role != "MODERATOR" && req.Role != "ANALYST" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	admin, err := h.adminService.PromoteUserToAdmin(req.UserID, req.Role, adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    admin,
	})
}

// GetAdminLogs returns admin activity logs
func (h *AdminHandler) GetAdminLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	logs, err := h.adminService.GetAdminLogs(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    logs,
		"count":   len(logs),
	})
}

// GetPlatformStats returns platform statistics
func (h *AdminHandler) GetPlatformStats(c *gin.Context) {
	dateStr := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format"})
		return
	}

	stats, err := h.adminService.GetPlatformStats(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    stats,
	})
}

// GetMarkets returns all markets for admin
func (h *AdminHandler) GetMarkets(c *gin.Context) {
	var markets []models.Market
	if err := h.db.Order("created_at DESC").Find(&markets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch markets"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    markets,
		"count":   len(markets),
	})
}

// UpdateMarketStatus updates a market's status
func (h *AdminHandler) UpdateMarketStatus(c *gin.Context) {
	adminID := c.GetUint("admin_id")
	marketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid market ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Model(&models.Market{}).Where("id = ?", marketID).
		Update("status", req.Status).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update market"})
		return
	}

	mID := uint(marketID)
	h.adminService.LogAdminAction(adminID, "UPDATE_MARKET_STATUS", "MARKET", &mID, map[string]interface{}{
		"status": req.Status,
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Market status updated",
	})
}
