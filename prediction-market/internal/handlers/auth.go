package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"prediction-market/internal/auth"
	"prediction-market/internal/services"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *services.AuthService
}

// NewAuthHandler creates a new AuthHandler
func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// WalletLogin authenticates a user by their Solana wallet address.
// If the user doesn't exist, a new account is created.
// POST /auth/wallet
func (h *AuthHandler) WalletLogin(c *gin.Context) {
	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
		InviteCode    string `json:"invite_code"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate wallet address length (Solana base58 addresses are 32-44 chars)
	if len(req.WalletAddress) < 32 || len(req.WalletAddress) > 44 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
		return
	}

	user, err := h.authService.ProcessWalletLogin(req.WalletAddress, req.InviteCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to authenticate"})
		return
	}

	token, err := auth.GenerateToken(user.ID, user.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  user,
	})
}

// Logout handles user logout (stateless JWT — client-side only)
// POST /auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully logged out",
	})
}

// GetMe returns the currently authenticated user's profile
// GET /auth/me
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, exists := auth.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, err := h.authService.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}
