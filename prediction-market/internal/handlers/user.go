package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"prediction-market/internal/auth"
	"prediction-market/internal/services"
)

// UserHandler handles user-related endpoints
type UserHandler struct {
	userService *services.UserService
}

// NewUserHandler creates a new UserHandler
func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
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

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":              user.ID,
			"x_username":      user.XUsername,
			"x_id":            user.XID,
			"followers_count": user.FollowersCount,
			"virtual_balance": user.VirtualBalance,
			"created_at":      user.CreatedAt,
		},
	})
}

// GetBalance returns the current user's virtual balance
func (h *UserHandler) GetBalance(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	balance, err := h.userService.GetUserBalance(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"balance": balance,
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
