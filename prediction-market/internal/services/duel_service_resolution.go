package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"prediction-market/internal/models"

	"github.com/google/uuid"
)

// ... existing code ...

// AutoResolveDuel automatically resolves a duel when timer expires
func (ds *DuelService) AutoResolveDuel(
	ctx context.Context,
	duelID uuid.UUID,
	exitPrice float64,
) (*models.DuelResult, error) {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	// Check if already resolved
	if duel.Status == models.DuelStatusResolved || duel.Status == models.DuelStatusFinished {
		log.Printf("[AutoResolveDuel] Duel %s already resolved with status %s", duelID, duel.Status)
		return ds.GetDuelResult(ctx, duelID)
	}

	// Check if duel is active
	if duel.Status != models.DuelStatusActive {
		return nil, fmt.Errorf("duel is not active, current status: %s", duel.Status)
	}

	// Check if both players exist
	if duel.Player2ID == nil {
		return nil, errors.New("duel does not have a second player")
	}

	// Check if entry price is set
	if duel.PriceAtStart == nil {
		return nil, errors.New("duel does not have an entry price")
	}

	entryPrice := *duel.PriceAtStart

	// Determine winner based on price movement and player 1's prediction
	var winnerID uint
	var loserID uint

	// Player 1's outcome is stored in PredictedOutcome or Direction
	// If Direction is set, use it (0 = UP, 1 = DOWN)
	// Otherwise check PredictedOutcome string
	var player1PredictedUp bool

	log.Printf("[AutoResolveDuel] Duel %s: Direction=%v, PredictedOutcome=%v",
		duelID,
		func() string {
			if duel.Direction != nil {
				return fmt.Sprintf("%d", *duel.Direction)
			}
			return "nil"
		}(),
		func() string {
			if duel.PredictedOutcome != nil {
				return *duel.PredictedOutcome
			}
			return "nil"
		}())

	if duel.Direction != nil {
		player1PredictedUp = *duel.Direction == 0
		log.Printf("[AutoResolveDuel] Using Direction field: %d (UP=%v)", *duel.Direction, player1PredictedUp)
	} else if duel.PredictedOutcome != nil {
		player1PredictedUp = *duel.PredictedOutcome == "UP"
		log.Printf("[AutoResolveDuel] Using PredictedOutcome field: %s (UP=%v)", *duel.PredictedOutcome, player1PredictedUp)
	} else {
		return nil, fmt.Errorf("duel does not have a predicted outcome (both Direction and PredictedOutcome are nil)")
	}

	// Determine winner
	priceWentUp := exitPrice >= entryPrice

	if player1PredictedUp == priceWentUp {
		// Player 1 predicted correctly
		winnerID = duel.Player1ID
		loserID = *duel.Player2ID
	} else {
		// Player 2 wins
		winnerID = *duel.Player2ID
		loserID = duel.Player1ID
	}

	log.Printf("[AutoResolveDuel] Duel %s: Entry=%.6f, Exit=%.6f, P1 predicted %s, Price went %s, Winner=%d",
		duelID, entryPrice, exitPrice,
		map[bool]string{true: "UP", false: "DOWN"}[player1PredictedUp],
		map[bool]string{true: "UP", false: "DOWN"}[priceWentUp],
		winnerID)

	// Update duel status directly in database (no on-chain call needed)
	now := time.Now()
	updates := map[string]interface{}{
		"status":       models.DuelStatusResolved,
		"winner_id":    winnerID,
		"price_at_end": exitPrice,
		"resolved_at":  &now,
	}

	err = ds.repo.UpdateDuel(ctx, duelID, updates)
	if err != nil {
		return nil, fmt.Errorf("failed to update duel status: %w", err)
	}

	log.Printf("[AutoResolveDuel] Duel %s resolved successfully. Winner: %d, Loser: %d", duelID, winnerID, loserID)

	// Return result
	result := &models.DuelResult{
		DuelID:   duelID,
		WinnerID: winnerID,
		Status:   models.DuelStatusResolved,
	}

	return result, nil
}

// SetChartStartPrice sets the chart start price for a duel
func (ds *DuelService) SetChartStartPrice(
	ctx context.Context,
	duelID uuid.UUID,
	price float64,
) error {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return fmt.Errorf("failed to get duel: %w", err)
	}

	// Only set if not already set
	if duel.ChartStartPrice != nil {
		log.Printf("[SetChartStartPrice] Duel %s already has chart start price: %.6f", duelID, *duel.ChartStartPrice)
		return nil
	}

	// Set chart start price
	duel.ChartStartPrice = &price

	// Update duel
	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return fmt.Errorf("failed to update duel: %w", err)
	}

	log.Printf("[SetChartStartPrice] Set chart start price for duel %s: %.6f", duelID, price)

	return nil
}
