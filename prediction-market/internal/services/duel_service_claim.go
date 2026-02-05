package services

import (
	"context"
	"fmt"
	"log"

	"prediction-market/internal/models"

	"github.com/gagliardetto/solana-go"
	"github.com/google/uuid"
)

// ClaimWinnings calls the smart contract to distribute winnings to the winner
func (ds *DuelService) ClaimWinnings(
	ctx context.Context,
	duelID uuid.UUID,
	claimerID uint,
) (*models.DuelResult, error) {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	// Check if duel is resolved
	if duel.Status != models.DuelStatusResolved {
		return nil, fmt.Errorf("duel is not resolved, current status: %s", duel.Status)
	}

	// Check if already claimed (status = FINISHED)
	if duel.Status == models.DuelStatusFinished {
		log.Printf("[ClaimWinnings] Duel %s already claimed", duelID)
		return ds.GetDuelResult(ctx, duelID)
	}

	// Verify claimer is the winner
	if duel.WinnerID == nil {
		return nil, fmt.Errorf("duel has no winner")
	}
	if *duel.WinnerID != claimerID {
		return nil, fmt.Errorf("only the winner can claim winnings")
	}

	// Check if both players exist
	if duel.Player2ID == nil {
		return nil, fmt.Errorf("duel does not have a second player")
	}

	// Get player wallet addresses
	player1Wallet, err := ds.repo.GetUserWalletAddress(ctx, duel.Player1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get player 1 wallet: %w", err)
	}
	player2Wallet, err := ds.repo.GetUserWalletAddress(ctx, *duel.Player2ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get player 2 wallet: %w", err)
	}

	// Convert wallet addresses to PublicKey
	player1Pubkey, err := solana.PublicKeyFromBase58(player1Wallet)
	if err != nil {
		return nil, fmt.Errorf("invalid player 1 wallet: %w", err)
	}
	player2Pubkey, err := solana.PublicKeyFromBase58(player2Wallet)
	if err != nil {
		return nil, fmt.Errorf("invalid player 2 wallet: %w", err)
	}

	// Get exit price
	if duel.PriceAtEnd == nil {
		return nil, fmt.Errorf("duel does not have an exit price")
	}
	exitPrice := *duel.PriceAtEnd

	// Convert exit price to lamports (micro-units)
	exitPriceLamports := uint64(exitPrice * 1e6)

	// Call smart contract to resolve duel and distribute winnings
	log.Printf("[ClaimWinnings] Calling contract resolve_duel for duel %s (duelId=%d, exitPrice=%d)",
		duelID, duel.DuelID, exitPriceLamports)

	signature, err := ds.anchorClient.ResolveDuel(
		ctx,
		uint64(duel.DuelID),
		exitPriceLamports,
		player1Pubkey,
		player2Pubkey,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve duel on-chain: %w", err)
	}

	log.Printf("[ClaimWinnings] Duel resolved on-chain: %s", signature)

	// Update duel status to FINISHED
	duel.Status = models.DuelStatusFinished

	err = ds.repo.UpdateDuel(ctx, duel)
	if err != nil {
		return nil, fmt.Errorf("failed to update duel status: %w", err)
	}

	log.Printf("[ClaimWinnings] Duel %s claimed successfully. Transaction: %s", duelID, signature)

	// Return result
	var loserID uint
	if *duel.WinnerID == duel.Player1ID {
		loserID = *duel.Player2ID
	} else {
		loserID = duel.Player1ID
	}

	result := &models.DuelResult{
		DuelID:   duelID,
		WinnerID: *duel.WinnerID,
		LoserID:  loserID,
	}

	return result, nil
}
