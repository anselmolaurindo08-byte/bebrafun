package handlers

import (
	"crypto/ed25519"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mr-tron/base58"

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

// WalletLogin authenticates a user by their Solana wallet address and signature.
// Requires signature of the message "Sign this message to authenticate with PUMPSLY".
// POST /auth/wallet
func (h *AuthHandler) WalletLogin(c *gin.Context) {
	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
		Signature     string `json:"signature" binding:"required"`
		InviteCode    string `json:"invite_code"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Verify Wallet Address Format
	if len(req.WalletAddress) < 32 || len(req.WalletAddress) > 44 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
		return
	}

	// 2. Verify Signature
	// The message expected to be signed. In a real app, this should include a nonce or timestamp to prevent replay attacks.
	message := []byte("Sign this message to authenticate with PUMPSLY")

	// Decode wallet address (Public Key) from Base58
	pubKey, err := base58.Decode(req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid public key format"})
		return
	}

	// Decode signature (could be Hex or Base58 depending on frontend implementation, assuming Hex or Base58)
	// Usually frontend wallets return signature as byte array or base58. Let's try base58 first as it's standard for Solana
	sig, err := base58.Decode(req.Signature)
	if err != nil {
		// Fallback to hex if base58 fails?
		sig, err = hex.DecodeString(req.Signature)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature format"})
			return
		}
	}

	if !ed25519.Verify(pubKey, message, sig) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	// 3. Process Login/Registration
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
