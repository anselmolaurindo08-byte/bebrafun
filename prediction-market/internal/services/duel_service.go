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

type DuelService struct {
	repo              *repository.Repository
	escrowContract    *blockchain.EscrowContract
	solanaClient      *blockchain.SolanaClient
	duelMatchingQueue chan *models.DuelQueue
}

func NewDuelService(
	repo *repository.Repository,
	escrowContract *blockchain.EscrowContract,
	solanaClient *blockchain.SolanaClient,
) *DuelService {
	ds := &DuelService{
		repo:              repo,
		escrowContract:    escrowContract,
		solanaClient:      solanaClient,
		duelMatchingQueue: make(chan *models.DuelQueue, 1000),
	}

	// Start matching goroutine
	go ds.matchDuels()

	return ds
}

// CreateDuel creates a new duel and adds player to queue
func (ds *DuelService) CreateDuel(
	ctx context.Context,
	playerID uint,
	req *models.CreateDuelRequest,
) (*models.Duel, error) {
	// Validate bet amount
	if req.BetAmount <= 0 {
		return nil, errors.New("bet amount must be positive")
	}

	// TODO: Check player wallet balance
	// This requires WalletConnection integration
	// For now, we'll skip balance validation and let blockchain handle it

	// Check if player already has too many active duels
	activeCount, err := ds.repo.CountPlayerActiveDuels(ctx, playerID)
	if err != nil {
		return nil, fmt.Errorf("failed to count active duels: %w", err)
	}

	if activeCount >= 5 {
		return nil, errors.New("maximum 5 active duels allowed")
	}

	// Generate duel ID
	duelID := time.Now().UnixNano()

	// Create duel in database
	duel := &models.Duel{
		ID:               uuid.New(),
		DuelID:           duelID,
		Player1ID:        playerID,
		BetAmount:        req.BetAmount,
		Player1Amount:    req.BetAmount,
		MarketID:         req.MarketID,
		EventID:          req.EventID,
		PredictedOutcome: req.PredictedOutcome,
		Status:           models.DuelStatusPending,
		CreatedAt:        time.Now(),
		ExpiresAt:        timePtr(time.Now().Add(5 * time.Minute)), // 5 min expiry
	}

	// Save to database
	err = ds.repo.CreateDuel(ctx, duel)
	if err != nil {
		return nil, fmt.Errorf("failed to create duel: %w", err)
	}

	// Add to matching queue
	queueItem := &models.DuelQueue{
		ID:               uuid.New(),
		PlayerID:         playerID,
		BetAmount:        req.BetAmount,
		MarketID:         req.MarketID,
		EventID:          req.EventID,
		PredictedOutcome: req.PredictedOutcome,
		Status:           "WAITING",
		CreatedAt:        time.Now(),
	}

	select {
	case ds.duelMatchingQueue <- queueItem:
		log.Printf("Added duel %d to matching queue", duelID)
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		log.Printf("Warning: matching queue full, duel will wait")
	}

	return duel, nil
}

// matchDuels continuously matches players from the queue
func (ds *DuelService) matchDuels() {
	for queueItem := range ds.duelMatchingQueue {
		ctx := context.Background()

		// Try to find a matching opponent
		opponentID, err := ds.repo.FindMatchingOpponent(
			ctx,
			queueItem.PlayerID,
			queueItem.BetAmount,
		)

		if err != nil {
			log.Printf("Error finding opponent: %v", err)
			continue
		}

		if opponentID == nil {
			// No opponent found, keep waiting
			log.Printf("No opponent found for player %d with bet %d", queueItem.PlayerID, queueItem.BetAmount)
			continue
		}

		// Found a match! Update the duel
		duel1, err := ds.repo.GetLatestDuelByPlayer(ctx, queueItem.PlayerID)
		if err != nil {
			log.Printf("Error getting duel: %v", err)
			continue
		}

		// Update first duel with matched opponent
		duel1.Player2ID = opponentID
		duel1.Player2Amount = &queueItem.BetAmount
		duel1.Status = models.DuelStatusMatched
		duel1.StartedAt = timePtr(time.Now())

		// Save to database
		err = ds.repo.UpdateDuel(ctx, duel1)
		if err != nil {
			log.Printf("Error updating duel: %v", err)
			continue
		}

		// Initialize escrow on blockchain
		escrowTxHash, err := ds.escrowContract.InitializeEscrow(
			ctx,
			duel1.DuelID,
			duel1.Player1ID,
			*duel1.Player2ID,
			duel1.BetAmount,
		)

		if err != nil {
			log.Printf("Error initializing escrow: %v", err)
			// Don't fail the match if escrow fails, just log it
			// In production, you might want to handle this differently
		} else {
			duel1.EscrowTxHash = &escrowTxHash
			err = ds.repo.UpdateDuel(ctx, duel1)
			if err != nil {
				log.Printf("Error updating escrow hash: %v", err)
			}
		}

		log.Printf("Matched duel %d: %d vs %d", duel1.DuelID, duel1.Player1ID, *duel1.Player2ID)
	}
}

// DepositToDuel deposits tokens to escrow for a duel
func (ds *DuelService) DepositToDuel(
	ctx context.Context,
	duelID uuid.UUID,
	playerNumber uint8,
	signature string,
) error {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return fmt.Errorf("failed to get duel: %w", err)
	}

	// Verify duel status
	if duel.Status != models.DuelStatusMatched {
		return fmt.Errorf("duel is not in matched status, current status: %s", duel.Status)
	}

	// Verify transaction on blockchain (require at least 1 confirmation)
	confirmed, err := ds.solanaClient.VerifyTransaction(ctx, signature, 1)
	if err != nil {
		return fmt.Errorf("failed to verify transaction: %w", err)
	}

	if !confirmed {
		return errors.New("transaction not confirmed on blockchain")
	}

	// Determine player ID
	var playerID uint
	if playerNumber == 1 {
		playerID = duel.Player1ID
	} else if playerNumber == 2 && duel.Player2ID != nil {
		playerID = *duel.Player2ID
	} else {
		return errors.New("invalid player number")
	}

	// Record transaction
	tx := &models.DuelTransaction{
		ID:              uuid.New(),
		DuelID:          duelID,
		TransactionType: models.DuelTransactionTypeDeposit,
		PlayerID:        playerID,
		Amount:          duel.BetAmount,
		TxHash:          &signature,
		Status:          models.DuelTransactionStatusConfirmed,
		CreatedAt:       time.Now(),
		ConfirmedAt:     timePtr(time.Now()),
	}

	err = ds.repo.CreateDuelTransaction(ctx, tx)
	if err != nil {
		return fmt.Errorf("failed to record transaction: %w", err)
	}

	// Check if both players have deposited
	deposits, err := ds.repo.GetDuelDeposits(ctx, duelID)
	if err != nil {
		return fmt.Errorf("failed to get deposits: %w", err)
	}

	if len(deposits) == 2 {
		// Both players have deposited, update duel status to active
		duel.Status = models.DuelStatusActive
		err = ds.repo.UpdateDuel(ctx, duel)
		if err != nil {
			return fmt.Errorf("failed to update duel status: %w", err)
		}

		log.Printf("Duel %d is now active - both players deposited", duel.DuelID)
	} else {
		log.Printf("Duel %d waiting for deposits: %d/2", duel.DuelID, len(deposits))
	}

	return nil
}

// ResolveDuel resolves a duel with a winner
func (ds *DuelService) ResolveDuel(
	ctx context.Context,
	duelID uuid.UUID,
	winnerID uint,
	winnerAmount int64,
) error {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return fmt.Errorf("failed to get duel: %w", err)
	}

	// Verify duel status
	if duel.Status != models.DuelStatusActive {
		return fmt.Errorf("duel is not active, current status: %s", duel.Status)
	}

	// Verify winner is one of the players
	if winnerID != duel.Player1ID && (duel.Player2ID == nil || winnerID != *duel.Player2ID) {
		return errors.New("winner must be one of the duel players")
	}

	// Determine winner number
	var winnerNumber uint8
	if winnerID == duel.Player1ID {
		winnerNumber = 1
	} else {
		winnerNumber = 2
	}

	// Release tokens from escrow to winner
	txHash, err := ds.escrowContract.ReleaseToWinner(
		ctx,
		duel.DuelID,
		winnerNumber,
		winnerAmount,
	)

	if err != nil {
		return fmt.Errorf("failed to release tokens: %w", err)
	}

	// Update duel
	duel.Status = models.DuelStatusResolved
	duel.WinnerID = &winnerID
	duel.ResolvedAt = timePtr(time.Now())
	duel.ResolutionTxHash = &txHash

	err = ds.repo.UpdateDuel(ctx, duel)
	if err != nil {
		return fmt.Errorf("failed to update duel: %w", err)
	}

	// Record payout transaction
	payoutTx := &models.DuelTransaction{
		ID:              uuid.New(),
		DuelID:          duelID,
		TransactionType: models.DuelTransactionTypePayout,
		PlayerID:        winnerID,
		Amount:          winnerAmount,
		TxHash:          &txHash,
		Status:          models.DuelTransactionStatusConfirmed,
		CreatedAt:       time.Now(),
		ConfirmedAt:     timePtr(time.Now()),
	}

	err = ds.repo.CreateDuelTransaction(ctx, payoutTx)
	if err != nil {
		return fmt.Errorf("failed to record payout: %w", err)
	}

	// Update player statistics
	err = ds.updatePlayerStatistics(ctx, duel, winnerID)
	if err != nil {
		log.Printf("Error updating statistics: %v", err)
	}

	log.Printf("Duel %d resolved. Winner: %d, Amount: %d", duel.DuelID, winnerID, winnerAmount)

	return nil
}

// updatePlayerStatistics updates duel statistics for both players
func (ds *DuelService) updatePlayerStatistics(
	ctx context.Context,
	duel *models.Duel,
	winnerID uint,
) error {
	// Calculate prize amount (both bets)
	totalPrize := duel.BetAmount * 2

	// Update winner stats
	err := ds.repo.IncrementDuelStats(ctx, winnerID, 1, 1, 0, duel.BetAmount, totalPrize, 0)
	if err != nil {
		return fmt.Errorf("failed to update winner stats: %w", err)
	}

	// Update loser stats
	var loserID uint
	if winnerID == duel.Player1ID {
		loserID = *duel.Player2ID
	} else {
		loserID = duel.Player1ID
	}

	err = ds.repo.IncrementDuelStats(ctx, loserID, 1, 0, 1, duel.BetAmount, 0, duel.BetAmount)
	if err != nil {
		return fmt.Errorf("failed to update loser stats: %w", err)
	}

	return nil
}

// GetDuelByID retrieves a duel by ID
func (ds *DuelService) GetDuelByID(ctx context.Context, duelID uuid.UUID) (*models.Duel, error) {
	return ds.repo.GetDuelByID(ctx, duelID)
}

// GetPlayerDuels retrieves all duels for a player
func (ds *DuelService) GetPlayerDuels(
	ctx context.Context,
	playerID uint,
	limit int,
	offset int,
) ([]*models.Duel, error) {
	return ds.repo.GetPlayerDuels(ctx, playerID, limit, offset)
}

// GetPlayerStatistics retrieves duel statistics for a player
func (ds *DuelService) GetPlayerStatistics(
	ctx context.Context,
	playerID uint,
) (*models.DuelStatistics, error) {
	return ds.repo.GetDuelStatistics(ctx, playerID)
}

// CancelDuel cancels a pending duel
func (ds *DuelService) CancelDuel(ctx context.Context, duelID uuid.UUID, playerID uint) error {
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return fmt.Errorf("failed to get duel: %w", err)
	}

	// Only allow cancellation by one of the players
	if duel.Player1ID != playerID && (duel.Player2ID == nil || *duel.Player2ID != playerID) {
		return errors.New("only duel players can cancel")
	}

	// Only allow cancellation if not yet active
	if duel.Status != models.DuelStatusPending && duel.Status != models.DuelStatusMatched {
		return errors.New("cannot cancel active or resolved duel")
	}

	// Cancel escrow if matched
	if duel.Status == models.DuelStatusMatched && duel.EscrowTxHash != nil {
		_, err := ds.escrowContract.CancelEscrow(ctx, duel.DuelID)
		if err != nil {
			log.Printf("Warning: failed to cancel escrow: %v", err)
			// Continue with cancellation even if blockchain fails
		}
	}

	// Update duel status
	duel.Status = models.DuelStatusCancelled
	err = ds.repo.UpdateDuel(ctx, duel)
	if err != nil {
		return fmt.Errorf("failed to cancel duel: %w", err)
	}

	log.Printf("Duel %d cancelled by player %d", duel.DuelID, playerID)

	return nil
}

// GetActiveDuels retrieves active duels (for admin/monitoring)
func (ds *DuelService) GetActiveDuels(ctx context.Context, limit int) ([]*models.Duel, error) {
	return ds.repo.GetActiveDuels(ctx, limit)
}

// ExpirePendingDuels marks expired pending duels as expired
func (ds *DuelService) ExpirePendingDuels(ctx context.Context) error {
	return ds.repo.ExpirePendingDuels(ctx)
}

// Helper functions
func parseUint(s *string) *uint {
	if s == nil {
		return nil
	}
	// TODO: Add proper parsing if needed, but for now we expect *uint in request
	return nil
}

func timePtr(t time.Time) *time.Time {
	return &t
}
