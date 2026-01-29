package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"prediction-market/internal/services"
)

type BlockchainHandler struct {
	db                *gorm.DB
	blockchainService *services.BlockchainService
}

func NewBlockchainHandler(db *gorm.DB, blockchainService *services.BlockchainService) *BlockchainHandler {
	return &BlockchainHandler{
		db:                db,
		blockchainService: blockchainService,
	}
}

// ConnectWallet connects a wallet to user account
func (h *BlockchainHandler) ConnectWallet(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		WalletAddress string `json:"wallet_address" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("ERROR: ConnectWallet - Failed to bind JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("INFO: ConnectWallet - UserID: %d, WalletAddress: %s", userID, req.WalletAddress)

	wallet, err := h.blockchainService.ConnectWallet(userID, req.WalletAddress)
	if err != nil {
		log.Printf("ERROR: ConnectWallet - BlockchainService.ConnectWallet failed: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("SUCCESS: ConnectWallet - Wallet connected for user %d", userID)
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    wallet,
	})
}

// DisconnectWallet disconnects a wallet from user account
func (h *BlockchainHandler) DisconnectWallet(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := h.blockchainService.DisconnectWallet(userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Wallet disconnected",
	})
}

// GetWalletConnection retrieves wallet connection
func (h *BlockchainHandler) GetWalletConnection(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wallet, err := h.blockchainService.GetWalletConnection(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get wallet"})
		return
	}

	if wallet == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Wallet not connected"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    wallet,
	})
}

// RefreshWalletBalance updates wallet balance from blockchain
func (h *BlockchainHandler) RefreshWalletBalance(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wallet, err := h.blockchainService.RefreshUserWalletBalance(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    wallet,
	})
}

// GetUserBalances returns user's wallet balance, escrow balance, and available balance
func (h *BlockchainHandler) GetUserBalances(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	wallet, err := h.blockchainService.GetWalletConnection(userID)
	if err != nil || wallet == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"wallet_connected": false,
				"wallet_balance":   decimal.Zero,
				"escrow_balance":   decimal.Zero,
				"available_balance": decimal.Zero,
				"token_symbol":     "PREDICT",
			},
		})
		return
	}

	available, escrowLocked, err := h.blockchainService.GetUserAvailableBalance(userID)
	if err != nil {
		escrowLocked = decimal.Zero
		available = wallet.TokenBalance
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"wallet_connected":  true,
			"wallet_address":    wallet.WalletAddress,
			"wallet_balance":    wallet.TokenBalance,
			"escrow_balance":    escrowLocked,
			"available_balance": available,
			"token_symbol":      wallet.TokenSymbol,
			"last_updated":      wallet.LastBalanceUpdate,
		},
	})
}

// GetEscrowBalance retrieves user's escrow balance
func (h *BlockchainHandler) GetEscrowBalance(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	balance, err := h.blockchainService.GetUserEscrowBalance(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get balance"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"escrow_balance": balance,
			"token_symbol":   "PREDICT",
		},
	})
}

// GetEscrowTransactions retrieves escrow transactions
func (h *BlockchainHandler) GetEscrowTransactions(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	transactions, err := h.blockchainService.GetEscrowTransactions(userID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get transactions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    transactions,
		"count":   len(transactions),
	})
}

// LockTokensForDuel locks tokens in escrow for a duel
func (h *BlockchainHandler) LockTokensForDuel(c *gin.Context) {
	userID := c.GetUint("user_id")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		DuelID          uint   `json:"duel_id" binding:"required"`
		Amount          string `json:"amount" binding:"required"`
		TransactionHash string `json:"transaction_hash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	amount, err := decimal.NewFromString(req.Amount)
	if err != nil || amount.LessThanOrEqual(decimal.Zero) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid amount"})
		return
	}

	escrowTx, err := h.blockchainService.LockTokensInEscrow(req.DuelID, userID, amount, req.TransactionHash)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    escrowTx,
	})
}

// ConfirmEscrowDeposit confirms a deposit transaction
func (h *BlockchainHandler) ConfirmEscrowDeposit(c *gin.Context) {
	var req struct {
		EscrowTransactionID uint   `json:"escrow_transaction_id" binding:"required"`
		TransactionHash     string `json:"transaction_hash" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.blockchainService.ConfirmEscrowDeposit(req.EscrowTransactionID, req.TransactionHash); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Deposit confirmed",
	})
}
