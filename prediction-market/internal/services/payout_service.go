package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"prediction-market/internal/blockchain"
	"prediction-market/internal/models"
	"prediction-market/internal/repository"

	"github.com/google/uuid"
)

type PayoutService struct {
	escrowContract *blockchain.EscrowContract
	repo           *repository.Repository
	feePercent     float64
}

func NewPayoutService(
	escrowContract *blockchain.EscrowContract,
	repo *repository.Repository,
	feePercent float64,
) *PayoutService {
	return &PayoutService{
		escrowContract: escrowContract,
		repo:           repo,
		feePercent:     feePercent,
	}
}

// ExecutePayout executes automatic payout to winner with platform fee deduction
func (ps *PayoutService) ExecutePayout(
	ctx context.Context,
	duel *models.Duel,
	winnerID uint,
) (*models.DuelTransaction, error) {
	// Calculate amounts
	totalAmount := duel.BetAmount * 2
	feeAmount := int64(float64(totalAmount) * (ps.feePercent / 100.0))
	payoutAmount := totalAmount - feeAmount

	log.Printf("Executing payout for duel %d: Total=%d, Fee=%d (%.1f%%), Payout=%d",
		duel.DuelID, totalAmount, feeAmount, ps.feePercent, payoutAmount)

	// Get winner's wallet address
	winner, err := ps.repo.GetUserByID(ctx, winnerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get winner: %w", err)
	}

	if winner.WalletAddress == "" {
		return nil, errors.New("winner has no wallet address")
	}

	// Execute smart contract payout
	txHash, err := ps.escrowContract.ReleaseToWinner(
		ctx,
		duel.DuelID,
		winner.WalletAddress,
		uint64(payoutAmount), // Convert int64 to uint64
	)
	if err != nil {
		return nil, fmt.Errorf("failed to release funds from escrow: %w", err)
	}

	log.Printf("Payout transaction sent: %s", txHash)

	// Record payout transaction
	payoutTx := &models.DuelTransaction{
		ID:              uuid.New(),
		DuelID:          duel.ID,
		TransactionType: models.DuelTransactionTypePayout,
		PlayerID:        winnerID,
		Amount:          payoutAmount,
		TxHash:          &txHash,
		Status:          models.DuelTransactionStatusConfirmed,
		CreatedAt:       time.Now(),
		ConfirmedAt:     func() *time.Time { t := time.Now(); return &t }(),
	}

	err = ps.repo.CreateDuelTransaction(ctx, payoutTx)
	if err != nil {
		return nil, fmt.Errorf("failed to record payout transaction: %w", err)
	}

	// Record platform fee transaction
	feeTx := &models.DuelTransaction{
		ID:              uuid.New(),
		DuelID:          duel.ID,
		TransactionType: models.DuelTransactionTypeFee,
		PlayerID:        0, // Platform (no specific player)
		Amount:          feeAmount,
		TxHash:          &txHash, // Same transaction
		Status:          models.DuelTransactionStatusConfirmed,
		CreatedAt:       time.Now(),
		ConfirmedAt:     func() *time.Time { t := time.Now(); return &t }(),
	}

	err = ps.repo.CreateDuelTransaction(ctx, feeTx)
	if err != nil {
		// Log warning but don't fail the payout
		log.Printf("Warning: failed to record fee transaction: %v", err)
	}

	log.Printf("Payout executed successfully: Duel %d, Winner %d, Amount %d lamports (Fee: %d lamports)",
		duel.DuelID, winnerID, payoutAmount, feeAmount)

	return payoutTx, nil
}
