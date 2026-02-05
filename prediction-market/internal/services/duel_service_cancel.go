package services

import (
	"context"
	"errors"
	"fmt"
	"log"

	"prediction-market/internal/models"

	"github.com/google/uuid"
)

// CancelDuel cancels a pending duel (player 1 only, before player 2 joins)
func (ds *DuelService) CancelDuel(
	ctx context.Context,
	duelID uuid.UUID,
	callerID uint,
) error {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return fmt.Errorf("failed to get duel: %w", err)
	}

	// Verify caller is player 1
	if duel.Player1ID != callerID {
		return errors.New("only player 1 can cancel the duel")
	}

	// Verify status is PENDING
	if duel.Status != models.DuelStatusPending {
		return fmt.Errorf("cannot cancel duel with status %s, must be PENDING", duel.Status)
	}

	// Verify no player 2 has joined
	if duel.Player2ID != nil {
		return errors.New("cannot cancel duel after player 2 has joined")
	}

	// Update status to CANCELLED
	duel.Status = models.DuelStatusCancelled

	err = ds.repo.UpdateDuel(ctx, duel)
	if err != nil {
		return fmt.Errorf("failed to update duel status: %w", err)
	}

	log.Printf("[CancelDuel] Duel %s cancelled by player %d", duelID, callerID)

	return nil
}
