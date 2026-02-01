package services

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"prediction-market/internal/blockchain"
	"prediction-market/internal/models"
)

type BlockchainService struct {
	db           *gorm.DB
	solanaClient *blockchain.SolanaClient
	mu           sync.Mutex
}

func NewBlockchainService(db *gorm.DB, network, tokenMintAddress, escrowContractAddress, serverWalletPrivateKey string) *BlockchainService {
	return &BlockchainService{
		db:           db,
		solanaClient: blockchain.NewSolanaClient(network, tokenMintAddress, escrowContractAddress, serverWalletPrivateKey),
	}
}

// ConnectWallet connects a wallet to a user account
func (s *BlockchainService) ConnectWallet(userID uint, walletAddress string) (*models.WalletConnection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate wallet address
	if !s.solanaClient.ValidateWalletAddress(walletAddress) {
		return nil, fmt.Errorf("invalid wallet address format")
	}

	// Check if user already has a wallet - if yes, update it
	var existing models.WalletConnection
	userHasWallet := s.db.Where("user_id = ?", userID).First(&existing).Error == nil

	if userHasWallet {
		// User already has a wallet - update it with new address
		log.Printf("User %d already has wallet %s, updating to %s", userID, existing.WalletAddress, walletAddress)

		// Get new balance
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		balance, err := s.solanaClient.GetTokenBalance(ctx, walletAddress)
		if err != nil {
			log.Printf("Warning: Could not fetch balance: %v", err)
			balance = decimal.Zero
		}

		now := time.Now()
		existing.WalletAddress = walletAddress
		existing.TokenBalance = balance
		existing.LastBalanceUpdate = &now
		existing.ConnectedAt = now

		if err := s.db.Save(&existing).Error; err != nil {
			return nil, fmt.Errorf("failed to update wallet connection: %w", err)
		}

		// Update wallet_address in users table
		if err := s.db.Model(&models.User{}).Where("id = ?", userID).Update("wallet_address", walletAddress).Error; err != nil {
			log.Printf("Warning: Failed to update user wallet_address: %v", err)
		}

		log.Printf("Wallet updated for user %d: %s (balance: %s PREDICT)", userID, walletAddress, balance)
		return &existing, nil
	}

	// Check if wallet is already used by another user
	if err := s.db.Where("wallet_address = ?", walletAddress).First(&existing).Error; err == nil {
		return nil, fmt.Errorf("wallet is already connected to another account")
	}

	// Get initial token balance
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	balance, err := s.solanaClient.GetTokenBalance(ctx, walletAddress)
	if err != nil {
		log.Printf("Warning: Could not fetch initial balance: %v", err)
		balance = decimal.Zero
	}

	now := time.Now()
	wallet := models.WalletConnection{
		UserID:            userID,
		WalletAddress:     walletAddress,
		Blockchain:        "SOLANA",
		TokenBalance:      balance,
		TokenSymbol:       "PREDICT",
		IsVerified:        true,
		ConnectedAt:       now,
		LastBalanceUpdate: &now,
	}

	if err := s.db.Create(&wallet).Error; err != nil {
		return nil, fmt.Errorf("failed to create wallet connection: %w", err)
	}

	// Also update wallet_address in users table for dual authentication
	if err := s.db.Model(&models.User{}).Where("id = ?", userID).Update("wallet_address", walletAddress).Error; err != nil {
		log.Printf("Warning: Failed to update user wallet_address: %v", err)
	}

	log.Printf("Wallet connected for user %d: %s (balance: %s PREDICT)", userID, walletAddress, balance)
	return &wallet, nil
}

// DisconnectWallet disconnects a wallet from a user account
func (s *BlockchainService) DisconnectWallet(userID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for active escrow holds
	var activeHolds int64
	if err := s.db.Model(&models.DuelEscrowHold{}).
		Where("user_id = ? AND status = ?", userID, "LOCKED").
		Count(&activeHolds).Error; err != nil {
		return err
	}

	if activeHolds > 0 {
		return fmt.Errorf("cannot disconnect wallet with active escrow holds")
	}

	result := s.db.Where("user_id = ?", userID).Delete(&models.WalletConnection{})
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("no wallet found for user")
	}

	// Also clear wallet_address from users table
	if err := s.db.Model(&models.User{}).Where("id = ?", userID).Update("wallet_address", nil).Error; err != nil {
		log.Printf("Warning: Failed to clear user wallet_address: %v", err)
	}

	log.Printf("Wallet disconnected for user %d", userID)
	return nil
}

// GetWalletConnection retrieves wallet connection for a user
func (s *BlockchainService) GetWalletConnection(userID uint) (*models.WalletConnection, error) {
	var wallet models.WalletConnection
	if err := s.db.Where("user_id = ?", userID).First(&wallet).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &wallet, nil
}

// GetWalletByAddress retrieves wallet connection by address
func (s *BlockchainService) GetWalletByAddress(address string) (*models.WalletConnection, error) {
	var wallet models.WalletConnection
	if err := s.db.Where("wallet_address = ?", address).First(&wallet).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &wallet, nil
}

// UpdateWalletBalance updates wallet token balance from blockchain
func (s *BlockchainService) UpdateWalletBalance(walletID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var wallet models.WalletConnection
	if err := s.db.First(&wallet, walletID).Error; err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	balance, err := s.solanaClient.GetTokenBalance(ctx, wallet.WalletAddress)
	if err != nil {
		return fmt.Errorf("failed to fetch balance: %w", err)
	}

	now := time.Now()
	if err := s.db.Model(&wallet).Updates(map[string]interface{}{
		"token_balance":       balance,
		"last_balance_update": now,
	}).Error; err != nil {
		return err
	}

	log.Printf("Updated wallet %d balance: %s PREDICT", walletID, balance)
	return nil
}

// RefreshUserWalletBalance refreshes wallet balance for a user
func (s *BlockchainService) RefreshUserWalletBalance(userID uint) (*models.WalletConnection, error) {
	wallet, err := s.GetWalletConnection(userID)
	if err != nil || wallet == nil {
		return nil, fmt.Errorf("wallet not found")
	}

	if err := s.UpdateWalletBalance(wallet.ID); err != nil {
		return nil, err
	}

	// Reload wallet
	return s.GetWalletConnection(userID)
}

// LockTokensInEscrow creates escrow records when user places a duel bet
func (s *BlockchainService) LockTokensInEscrow(duelID, userID uint, amount decimal.Decimal, txHash string) (*models.EscrowTransaction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Verify user has a wallet
	var wallet models.WalletConnection
	if err := s.db.Where("user_id = ?", userID).First(&wallet).Error; err != nil {
		return nil, fmt.Errorf("user does not have a connected wallet")
	}

	// Create escrow transaction record
	escrowTx := models.EscrowTransaction{
		DuelID:          duelID,
		UserID:          userID,
		TransactionType: "DEPOSIT",
		Amount:          amount,
		TokenSymbol:     "PREDICT",
		TransactionHash: txHash,
		Status:          "PENDING",
	}

	if err := s.db.Create(&escrowTx).Error; err != nil {
		return nil, fmt.Errorf("failed to create escrow transaction: %w", err)
	}

	// Create escrow hold record
	hold := models.DuelEscrowHold{
		DuelID:       duelID,
		UserID:       userID,
		AmountLocked: amount,
		TokenSymbol:  "PREDICT",
		Status:       "LOCKED",
	}

	if err := s.db.Create(&hold).Error; err != nil {
		return nil, fmt.Errorf("failed to create escrow hold: %w", err)
	}

	log.Printf("Tokens locked in escrow: duel=%d, user=%d, amount=%s PREDICT", duelID, userID, amount)
	return &escrowTx, nil
}

// ConfirmEscrowDeposit confirms a deposit transaction
func (s *BlockchainService) ConfirmEscrowDeposit(escrowTxID uint, txHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var escrowTx models.EscrowTransaction
	if err := s.db.First(&escrowTx, escrowTxID).Error; err != nil {
		return fmt.Errorf("escrow transaction not found: %w", err)
	}

	if escrowTx.Status == "CONFIRMED" {
		return nil // Already confirmed
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Verify transaction on blockchain
	isValid, confirmations, err := s.solanaClient.GetTransactionStatus(ctx, txHash)
	if err != nil {
		return fmt.Errorf("failed to verify transaction: %w", err)
	}

	if !isValid {
		escrowTx.Status = "FAILED"
		s.db.Save(&escrowTx)
		return fmt.Errorf("transaction failed or not found")
	}

	// Update transaction
	now := time.Now()
	escrowTx.Status = "CONFIRMED"
	escrowTx.Confirmations = confirmations
	escrowTx.ConfirmedAt = &now

	if err := s.db.Save(&escrowTx).Error; err != nil {
		return err
	}

	log.Printf("Escrow deposit confirmed: tx=%s, confirmations=%d", txHash, confirmations)
	return nil
}

// ReleaseTokensFromEscrow releases tokens from escrow to winner
func (s *BlockchainService) ReleaseTokensFromEscrow(duelID, winnerID uint, amount decimal.Decimal, txHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Create payout transaction
	payoutTx := models.EscrowTransaction{
		DuelID:          duelID,
		UserID:          winnerID,
		TransactionType: "PAYOUT",
		Amount:          amount,
		TokenSymbol:     "PREDICT",
		TransactionHash: txHash,
		Status:          "PENDING",
	}

	if err := s.db.Create(&payoutTx).Error; err != nil {
		return fmt.Errorf("failed to create payout transaction: %w", err)
	}

	// Update winner's escrow hold
	now := time.Now()
	if err := s.db.Model(&models.DuelEscrowHold{}).
		Where("duel_id = ? AND user_id = ?", duelID, winnerID).
		Updates(map[string]interface{}{
			"status":      "RELEASED",
			"released_at": now,
		}).Error; err != nil {
		return err
	}

	log.Printf("Tokens released from escrow: duel=%d, winner=%d, amount=%s PREDICT", duelID, winnerID, amount)
	return nil
}

// TransferLoserTokensToWinner handles token transfer from loser to winner
func (s *BlockchainService) TransferLoserTokensToWinner(duelID, loserID, winnerID uint, amount decimal.Decimal, txHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// Create transfer-out transaction for loser
	loserTx := models.EscrowTransaction{
		DuelID:          duelID,
		UserID:          loserID,
		TransactionType: "TRANSFER",
		Amount:          amount.Neg(), // Negative for outgoing
		TokenSymbol:     "PREDICT",
		TransactionHash: txHash,
		Status:          "CONFIRMED",
		ConfirmedAt:     &now,
	}

	if err := s.db.Create(&loserTx).Error; err != nil {
		return fmt.Errorf("failed to create loser transfer transaction: %w", err)
	}

	// Create transfer-in transaction for winner
	winnerTx := models.EscrowTransaction{
		DuelID:          duelID,
		UserID:          winnerID,
		TransactionType: "PAYOUT",
		Amount:          amount,
		TokenSymbol:     "PREDICT",
		TransactionHash: txHash,
		Status:          "CONFIRMED",
		ConfirmedAt:     &now,
	}

	if err := s.db.Create(&winnerTx).Error; err != nil {
		return fmt.Errorf("failed to create winner transfer transaction: %w", err)
	}

	// Update escrow holds
	if err := s.db.Model(&models.DuelEscrowHold{}).
		Where("duel_id = ? AND user_id = ?", duelID, loserID).
		Updates(map[string]interface{}{
			"status":      "TRANSFERRED",
			"released_at": now,
		}).Error; err != nil {
		return err
	}

	if err := s.db.Model(&models.DuelEscrowHold{}).
		Where("duel_id = ? AND user_id = ?", duelID, winnerID).
		Updates(map[string]interface{}{
			"status":      "RELEASED",
			"released_at": now,
		}).Error; err != nil {
		return err
	}

	log.Printf("Tokens transferred: duel=%d, loser=%d, winner=%d, amount=%s PREDICT", duelID, loserID, winnerID, amount)
	return nil
}

// GetEscrowTransactions retrieves escrow transactions for a user
func (s *BlockchainService) GetEscrowTransactions(userID uint, limit int) ([]models.EscrowTransaction, error) {
	var transactions []models.EscrowTransaction
	query := s.db.Where("user_id = ?", userID).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&transactions).Error; err != nil {
		return nil, err
	}
	return transactions, nil
}

// GetDuelEscrowHolds retrieves escrow holds for a duel
func (s *BlockchainService) GetDuelEscrowHolds(duelID uint) ([]models.DuelEscrowHold, error) {
	var holds []models.DuelEscrowHold
	if err := s.db.Where("duel_id = ?", duelID).Find(&holds).Error; err != nil {
		return nil, err
	}
	return holds, nil
}

// GetUserEscrowBalance calculates total tokens locked in escrow for a user
func (s *BlockchainService) GetUserEscrowBalance(userID uint) (decimal.Decimal, error) {
	var totalLocked decimal.Decimal

	row := s.db.Model(&models.DuelEscrowHold{}).
		Where("user_id = ? AND status = ?", userID, "LOCKED").
		Select("COALESCE(SUM(amount_locked), 0)").Row()

	if err := row.Scan(&totalLocked); err != nil {
		return decimal.Zero, err
	}

	return totalLocked, nil
}

// GetUserAvailableBalance calculates available balance (wallet balance - escrow locked)
func (s *BlockchainService) GetUserAvailableBalance(userID uint) (decimal.Decimal, decimal.Decimal, error) {
	wallet, err := s.GetWalletConnection(userID)
	if err != nil || wallet == nil {
		return decimal.Zero, decimal.Zero, fmt.Errorf("wallet not connected")
	}

	escrowLocked, err := s.GetUserEscrowBalance(userID)
	if err != nil {
		return decimal.Zero, decimal.Zero, err
	}

	available := wallet.TokenBalance.Sub(escrowLocked)
	if available.LessThan(decimal.Zero) {
		available = decimal.Zero
	}

	return available, escrowLocked, nil
}

// GetTokenConfig retrieves token configuration
func (s *BlockchainService) GetTokenConfig(symbol string) (*models.TokenConfig, error) {
	var config models.TokenConfig
	if err := s.db.Where("token_symbol = ? AND is_active = ?", symbol, true).First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

// CreateOrUpdateTokenConfig creates or updates token configuration
func (s *BlockchainService) CreateOrUpdateTokenConfig(symbol, mintAddress, escrowAddress string, decimals int) error {
	config := models.TokenConfig{
		TokenSymbol:           symbol,
		TokenMintAddress:      mintAddress,
		EscrowContractAddress: escrowAddress,
		Decimals:              decimals,
		IsActive:              true,
	}

	return s.db.Where("token_symbol = ?", symbol).
		Assign(config).
		FirstOrCreate(&config).Error
}
