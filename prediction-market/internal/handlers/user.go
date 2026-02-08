package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"prediction-market/internal/auth"
	"prediction-market/internal/services"
)

// UserHandler handles user-related endpoints
type UserHandler struct {
	userService  *services.UserService
	adminService *services.AdminService
}

// NewUserHandler creates a new UserHandler
func NewUserHandler(userService *services.UserService, adminService *services.AdminService) *UserHandler {
	return &UserHandler{
		userService:  userService,
		adminService: adminService,
	}
}

// GetProfile returns the current user's profile
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	user, err := h.userService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	// Build user response
	userResponse := gin.H{
		"id":              user.ID,
		"wallet_address":  user.WalletAddress,
		"nickname":        user.Nickname,
		"x_username":      user.XUsername,
		"x_id":            user.XID,
		"followers_count": user.FollowersCount,
		"created_at":      user.CreatedAt,
	}

	// Check if user is admin and add role field
	log.Printf("[GetProfile Debug] userID: %d", userID)
	log.Printf("[GetProfile Debug] adminService nil?: %v", h.adminService == nil)
	if h.adminService != nil {
		isAdmin := h.adminService.IsAdmin(userID)
		log.Printf("[GetProfile Debug] IsAdmin result: %v", isAdmin)
		if isAdmin {
			log.Printf("[GetProfile Debug] Adding role=admin to response")
			userResponse["role"] = "admin"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"user": userResponse,
	})
}

// GetInviteCodes returns the current user's invite codes
func (h *UserHandler) GetInviteCodes(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	inviteCodes, err := h.userService.GetUserInviteCodes(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve invite codes",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"invite_codes": inviteCodes,
	})
}

// GetReferrals returns the current user's referrals
func (h *UserHandler) GetReferrals(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	referrals, err := h.userService.GetUserReferrals(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve referrals",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"referrals": referrals,
	})
}

// UpdateNickname updates the current user's nickname
func (h *UserHandler) UpdateNickname(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	var req struct {
		Nickname string `json:"nickname" binding:"required,min=3,max=50"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	if err := h.userService.UpdateNickname(userID, req.Nickname); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Nickname updated successfully",
	})
}
