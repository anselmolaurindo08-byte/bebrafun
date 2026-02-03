package services

import (
	"context"
	"fmt"
	"time"

	"prediction-market/internal/models"

	"github.com/google/uuid"
)

// IndexDuelCreation indexes a duel creation from an on-chain transaction
// This is called after the frontend creates a duel via Anchor
func (ds *DuelService) IndexDuelCreation(ctx context.Context, txSignature string, playerID uint, marketID *uint, eventID *uint) (*models.Duel, error) {
	if ds.anchorClient == nil {
		return nil, fmt.Errorf("anchor client not initialized")
	}

	// 1. Verify transaction exists and is confirmed
	txDetails, err := ds.solanaClient.VerifyTransaction(ctx, txSignature, 1)
	if err != nil {
		return nil, fmt.Errorf("failed to verify transaction: %w", err)
	}

	if !txDetails.Confirmed {
		return nil, fmt.Errorf("transaction not confirmed")
	}

	// 2. TODO: Parse DuelCreated event from logs to get duel_id
	// For now, we'll use timestamp as duel_id
	duelID := uint64(time.Now().UnixNano())

	// 3. Fetch duel account from chain
	duelAccount, err := ds.anchorClient.GetDuel(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch duel from chain: %w", err)
	}

	// 4. Derive duel PDA
	duelPda, _, err := ds.anchorClient.GetDuelPDA(duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to derive duel PDA: %w", err)
	}

	duelAddress := duelPda.String()

	// 5. Create DB record
	duel := &models.Duel{
		ID:            uuid.New(),
		DuelID:        int64(duelAccount.DuelID),
		DuelAddress:   &duelAddress,
		Player1ID:     playerID,
		BetAmount:     int64(duelAccount.BetAmount),
		Player1Amount: int64(duelAccount.BetAmount),
		MarketID:      marketID,
		EventID:       eventID,
		Status:        models.DuelStatusPending,
		CreatedAt:     time.Unix(duelAccount.CreatedAt, 0),
		ExpiresAt:     timePtr(time.Now().Add(5 * time.Minute)),
	}

	if err := ds.repo.CreateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to create duel in DB: %w", err)
	}

	return duel, nil
}

// IndexDuelJoin indexes a duel join from an on-chain transaction
// This is called after the frontend joins a duel via Anchor
func (ds *DuelService) IndexDuelJoin(ctx context.Context, duelID uuid.UUID, playerID uint, txSignature string) (*models.Duel, error) {
	if ds.anchorClient == nil {
		return nil, fmt.Errorf("anchor client not initialized")
	}

	// 1. Get duel from DB
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	// 2. Verify transaction exists and is confirmed
	txDetails, err := ds.solanaClient.VerifyTransaction(ctx, txSignature, 1)
	if err != nil {
		return nil, fmt.Errorf("failed to verify transaction: %w", err)
	}

	if !txDetails.Confirmed {
		return nil, fmt.Errorf("transaction not confirmed")
	}

	// 3. Fetch updated duel account from chain
	duelAccount, err := ds.anchorClient.GetDuel(ctx, uint64(duel.DuelID))
	if err != nil {
		return nil, fmt.Errorf("failed to fetch duel from chain: %w", err)
	}

	// 4. Verify player2 is set on-chain
	if duelAccount.Player2 == nil {
		return nil, fmt.Errorf("player2 not set on-chain")
	}

	// 5. Validate bet amount
	if duelAccount.BetAmount == 0 {
		return nil, fmt.Errorf("invalid bet amount: 0")
	}

	// 6. Update DB record
	duel.Player2ID = &playerID
	player2Amount := int64(duelAccount.BetAmount)
	duel.Player2Amount = &player2Amount
	duel.Status = models.DuelStatusMatched
	startedAt := time.Now()
	duel.StartedAt = &startedAt

	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to update duel in DB: %w", err)
	}

	return duel, nil
}
