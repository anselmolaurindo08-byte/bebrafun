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
	priceService      *PriceService
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
		priceService:      NewPriceService(),
		duelMatchingQueue: make(chan *models.DuelQueue, 1000),
	}

	// Start matching goroutine
	go ds.matchDuels()

	// Start resolution monitor (Server-side Oracle)
	go ds.monitorActiveDuels()

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

	// Convert float to int64 based on currency decimals (simplified for SOL)
	betAmountInt := int64(req.BetAmount * 1e9) // Assuming SOL (9 decimals)

	// Map string currency to int16
	var currencyCode int16 = 0 // Default to SOL
	if req.Currency == "PUMP" {
		currencyCode = 1
	}

	// Create duel in database
	duel := &models.Duel{
		ID:               uuid.New(),
		DuelID:           duelID,
		Player1ID:        playerID,
		BetAmount:        betAmountInt,
		Player1Amount:    betAmountInt,
		Currency:         currencyCode,
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
		BetAmount:        betAmountInt,
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

		// NOTE: Escrow Initialization is now triggered by Frontend
		// Backend just waits for transaction hash confirmation via DepositToDuel

		log.Printf("Matched duel %d: %d vs %d", duel1.DuelID, duel1.Player1ID, *duel1.Player2ID)
	}
}

// JoinDuel allows a player to join/accept a pending duel
func (ds *DuelService) JoinDuel(
	ctx context.Context,
	duelID uuid.UUID,
	playerID uint,
) (*models.Duel, error) {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	// Verify duel is in PENDING status
	if duel.Status != models.DuelStatusPending {
		return nil, fmt.Errorf("duel is not available to join, current status: %s", duel.Status)
	}

	// Verify player is not Player1 (can't join your own duel)
	if duel.Player1ID == playerID {
		return nil, errors.New("cannot join your own duel")
	}

	// Verify Player2 slot is empty
	if duel.Player2ID != nil {
		return nil, errors.New("duel already has a second player")
	}

	// Set Player2 and update status
	duel.Player2ID = &playerID
	duel.Player2Amount = &duel.BetAmount
	duel.Status = models.DuelStatusMatched
	now := time.Now()
	duel.StartedAt = &now

	// Save to database
	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to update duel: %w", err)
	}

	log.Printf("Player %d joined duel %d (created by player %d)", playerID, duel.DuelID, duel.Player1ID)

	return duel, nil
}

// DepositToDuel verifies the escrow deposit transaction from frontend
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
	// Allow Pending (Player 1 depositing before match), Matched (Both players), or Active (Already active, maybe retry/late confirmation)
	if duel.Status != models.DuelStatusPending && duel.Status != models.DuelStatusMatched && duel.Status != models.DuelStatusActive {
		return fmt.Errorf("duel is not in pending/matched/active status, current status: %s", duel.Status)
	}

	// Verify transaction on blockchain
	// Pass the expected bet amount (lamports) to the verification logic
	confirmed, err := ds.escrowContract.VerifyDuelTransaction(ctx, signature, uint64(duel.BetAmount))
	if err != nil {
		return fmt.Errorf("failed to verify transaction: %w", err)
	}

	if !confirmed {
		return errors.New("transaction not confirmed on blockchain or amount mismatch")
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
		now := time.Now()
		duel.StartedAt = &now

		// Capture Start Price Server-Side
		// TODO: Support DOGE or other pairs based on duel config. Default to SOLUSDT for demo.
		symbol := "SOLUSDT"
		if startPrice, err := ds.priceService.GetCurrentPrice(symbol); err == nil {
			duel.PriceAtStart = &startPrice
			log.Printf("Captured Start Price for Duel %d: %f", duel.DuelID, startPrice)
		} else {
			log.Printf("Warning: Failed to capture start price for Duel %d: %v", duel.DuelID, err)
			// Fallback? Or fail start? For MVP, we proceed, resolution might need handling.
		}

		err = ds.repo.UpdateDuel(ctx, duel)
		if err != nil {
			return fmt.Errorf("failed to update duel status: %w", err)
		}

		log.Printf("Duel %d is now active - both players deposited. StartedAt: %v", duel.DuelID, now)
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

	// TODO: Get Winner's Wallet Address from DB
	// For now using placeholder, in real implementation retrieve from User model
	winnerUser, err := ds.repo.GetUserByID(ctx, winnerID)
	if err != nil {
		return fmt.Errorf("failed to get winner user: %w", err)
	}
	winnerPubKey := winnerUser.WalletAddress
	// winnerPubKey := "WinnerWalletAddressPlaceholder"

	// Trigger Blockchain Release via Server Authority
	// This generates a signed transaction that the server submits to the network
	// Pass amount in lamports
	txHash, err := ds.escrowContract.ReleaseToWinner(ctx, duel.DuelID, winnerPubKey, uint64(winnerAmount))
	if err != nil {
		log.Printf("Error signing release transaction: %v", err)
		// We might want to retry or mark for manual intervention
		return fmt.Errorf("failed to release funds on-chain: %w", err)
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

	log.Printf("Duel %d resolved. Winner: %d, Amount: %d, Tx: %s", duel.DuelID, winnerID, winnerAmount, txHash)

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

	// Cancel escrow if matched (Trigger server cancellation or verify user cancellation)
	if duel.Status == models.DuelStatusMatched && duel.EscrowTxHash != nil {
		// Verify cancellation on chain? For now assume user cancels on frontend and notifies us
		// Or we trigger it if we are admin
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

// monitorActiveDuels background job to auto-resolve duels
func (ds *DuelService) monitorActiveDuels() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		activeDuels, err := ds.repo.GetActiveDuels(ctx, 100) // Batch process
		if err != nil {
			log.Printf("Error fetching active duels: %v", err)
			continue
		}

		for _, duel := range activeDuels {
			// Only process ACTIVE duels that have started
			if duel.Status != models.DuelStatusActive || duel.StartedAt == nil {
				continue
			}

			// Check if duration passed (60 seconds)
			elapsed := time.Since(*duel.StartedAt)
			if elapsed >= 60*time.Second {
				ds.resolveDuelAutomatically(ctx, duel)
			}
		}
	}
}

func (ds *DuelService) resolveDuelAutomatically(ctx context.Context, duel *models.Duel) {
	log.Printf("Auto-resolving Duel %d...", duel.DuelID)

	symbol := "SOLUSDT" // Dynamic based on duel.Currency/Asset later
	exitPrice, err := ds.priceService.GetCurrentPrice(symbol)
	if err != nil {
		log.Printf("Failed to get exit price for duel %d: %v. Retrying next tick.", duel.DuelID, err)
		return
	}

	startPrice := 0.0
	if duel.PriceAtStart != nil {
		startPrice = *duel.PriceAtStart
	} else {
		// Fallback: If start price wasn't captured, use exit price (Push/Tie) or error?
		// For demo, we might just use exitPrice, resulting in 0 change.
		// Ideally we should have persistent candles.
		log.Printf("Warning: No start price for duel %d", duel.DuelID)
	}

	// Determine Winner Logic
	// Player 1 (Creator) predicts.
	// Direction: 0 = UP, 1 = DOWN (from duel struct, assuming mapped)
	// Map string "UP"/"DOWN" to internal if needed.
	// The model has PredictedOutcome string.

	isUpPrediction := duel.PredictedOutcome != nil && *duel.PredictedOutcome == "UP"
	wentUp := exitPrice > startPrice
	wentDown := exitPrice < startPrice

	var winnerID uint
	if (isUpPrediction && wentUp) || (!isUpPrediction && wentDown) {
		winnerID = duel.Player1ID
	} else if duel.Player2ID != nil {
		winnerID = *duel.Player2ID
	} else {
		winnerID = duel.Player1ID // Fallback if single player (shouldn't happen in active)
	}

	// Execute Resolution
	// We reuse ResolveDuelWithPrice but ignore the client hash argument
	_, err = ds.ResolveDuelWithPrice(ctx, duel.ID, winnerID, exitPrice, "SERVER_AUTO_RESOLUTION")
	if err != nil {
		log.Printf("Error auto-resolving duel %d: %v", duel.DuelID, err)
	}
}

// ============================================================================
// Enhanced Duel Service Methods
// ============================================================================

// GetAvailableDuels retrieves pending duels available for joining
func (ds *DuelService) GetAvailableDuels(
	ctx context.Context,
	limit, offset int,
) ([]*models.Duel, int64, error) {
	return ds.repo.GetAvailableDuels(ctx, limit, offset)
}

// GetUserDuels retrieves all duels for a specific user with pagination
func (ds *DuelService) GetUserDuels(
	ctx context.Context,
	userID uint,
	limit, offset int,
) ([]*models.Duel, int64, error) {
	return ds.repo.GetUserDuels(ctx, userID, limit, offset)
}

// RecordTransactionConfirmation records or updates a transaction confirmation
func (ds *DuelService) RecordTransactionConfirmation(
	ctx context.Context,
	duelID uuid.UUID,
	txHash string,
	confirmations int16,
	status string,
) (*models.TransactionConfirmationRecord, error) {
	record := &models.TransactionConfirmationRecord{
		ID:              uuid.New(),
		DuelID:          duelID,
		TransactionHash: txHash,
		Confirmations:   confirmations,
		Status:          status,
		Timestamp:       time.Now().UnixMilli(),
	}

	result, err := ds.repo.UpsertTransactionConfirmation(ctx, record)
	if err != nil {
		return nil, fmt.Errorf("failed to record confirmation: %w", err)
	}

	// If confirmed with enough confirmations, update duel status
	if confirmations >= 6 {
		duel, err := ds.repo.GetDuelByID(ctx, duelID)
		if err == nil && duel.Status == models.DuelStatusConfirmingTransaction {
			duel.Status = models.DuelStatusCountdown
			duel.Confirmations = confirmations
			if updateErr := ds.repo.UpdateDuel(ctx, duel); updateErr != nil {
				log.Printf("Error updating duel status to COUNTDOWN: %v", updateErr)
			}
		}
	}

	return result, nil
}

// GetTransactionConfirmation retrieves confirmation status by transaction hash
func (ds *DuelService) GetTransactionConfirmation(
	ctx context.Context,
	txHash string,
) (*models.TransactionConfirmationRecord, error) {
	return ds.repo.GetTransactionConfirmation(ctx, txHash)
}

// ResolveDuelWithPrice resolves a duel using price data and creates a result record
func (ds *DuelService) ResolveDuelWithPrice(
	ctx context.Context,
	duelID uuid.UUID,
	winnerID uint,
	exitPrice float64,
	clientTxHash string,
) (*models.DuelResult, error) {
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	if duel.Status != models.DuelStatusActive && duel.Status != models.DuelStatusFinished {
		return nil, fmt.Errorf("duel is not active/finished, current status: %s", duel.Status)
	}

	// Determine loser
	var loserID uint
	if winnerID == duel.Player1ID {
		if duel.Player2ID == nil {
			return nil, errors.New("duel has no second player")
		}
		loserID = *duel.Player2ID
	} else if duel.Player2ID != nil && winnerID == *duel.Player2ID {
		loserID = duel.Player1ID
	} else {
		return nil, errors.New("winner must be one of the duel players")
	}

	// Trigger Blockchain Release via Server Authority
	// The client might send a hash, but we ideally want the server to perform the payout
	// from the escrow account.

	// Fetch real address from User model
	winnerUser, err := ds.repo.GetUserByID(ctx, winnerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get winner user: %w", err)
	}
	winnerPubKey := winnerUser.WalletAddress

	// Calculate total prize (2x bet amount)
	totalPrize := uint64(duel.BetAmount * 2)

	txHash, err := ds.escrowContract.ReleaseToWinner(ctx, duel.DuelID, winnerPubKey, totalPrize)
	if err != nil {
		log.Printf("Error releasing funds: %v", err)
		// Fallback to client hash if server release fails (e.g. simulation mode)
		if clientTxHash != "" {
			txHash = clientTxHash
		} else {
			return nil, fmt.Errorf("failed to release funds on-chain: %w", err)
		}
	}

	// Calculate price data
	entryPrice := float64(0)
	if duel.PriceAtStart != nil {
		entryPrice = *duel.PriceAtStart
	}
	priceChange := exitPrice - entryPrice
	priceChangePercent := float64(0)
	if entryPrice > 0 {
		priceChangePercent = (priceChange / entryPrice) * 100
	}

	// Determine direction
	direction := int16(0)
	if duel.Direction != nil {
		direction = *duel.Direction
	}

	// Determine if prediction was correct
	wasCorrect := winnerID == duel.Player1ID

	// Calculate duration
	durationSeconds := int64(0)
	if duel.StartedAt != nil {
		durationSeconds = int64(time.Since(*duel.StartedAt).Seconds())
	}

	// Lookup usernames
	winnerUsername := ""
	loserUsername := ""
	var winnerAvatar, loserAvatar *string

	if winnerID == duel.Player1ID {
		winnerUsername = duel.Player1Username
		winnerAvatar = duel.Player1Avatar
		if duel.Player2Username != nil {
			loserUsername = *duel.Player2Username
		}
		loserAvatar = duel.Player2Avatar
	} else {
		loserUsername = duel.Player1Username
		loserAvatar = duel.Player1Avatar
		if duel.Player2Username != nil {
			winnerUsername = *duel.Player2Username
		}
		winnerAvatar = duel.Player2Avatar
	}

	// Update duel
	duel.Status = models.DuelStatusResolved
	duel.WinnerID = &winnerID
	duel.PriceAtEnd = &exitPrice
	duel.TransactionHash = &txHash
	duel.ResolvedAt = timePtr(time.Now())

	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to update duel: %w", err)
	}

	// Create result record
	amountWon := float64(duel.BetAmount * 2)
	duelResult := &models.DuelResult{
		ID:                 uuid.New(),
		DuelID:             duel.ID,
		WinnerID:           winnerID,
		LoserID:            loserID,
		WinnerUsername:     winnerUsername,
		LoserUsername:      loserUsername,
		WinnerAvatar:       winnerAvatar,
		LoserAvatar:        loserAvatar,
		AmountWon:          amountWon,
		Currency:           duel.Currency,
		EntryPrice:         entryPrice,
		ExitPrice:          exitPrice,
		PriceChange:        priceChange,
		PriceChangePercent: priceChangePercent,
		Direction:          direction,
		WasCorrect:         wasCorrect,
		DurationSeconds:    durationSeconds,
	}

	if err := ds.repo.CreateDuelResult(ctx, duelResult); err != nil {
		return nil, fmt.Errorf("failed to create duel result: %w", err)
	}

	// Update statistics
	if err := ds.updatePlayerStatistics(ctx, duel, winnerID); err != nil {
		log.Printf("Error updating statistics after resolve: %v", err)
	}

	log.Printf("Duel %s resolved with price. Winner: %d, ExitPrice: %.4f", duelID, winnerID, exitPrice)

	return duelResult, nil
}

// GetDuelResult retrieves the result of a resolved duel
func (ds *DuelService) GetDuelResult(ctx context.Context, duelID uuid.UUID) (*models.DuelResult, error) {
	return ds.repo.GetDuelResult(ctx, duelID)
}

// RecordPriceCandle records a price candle for a duel
func (ds *DuelService) RecordPriceCandle(
	ctx context.Context,
	duelID uuid.UUID,
	timestamp int64,
	open, high, low, close, volume float64,
) error {
	candle := &models.DuelPriceCandle{
		ID:     uuid.New(),
		DuelID: duelID,
		Time:   timestamp,
		Open:   open,
		High:   high,
		Low:    low,
		Close:  close,
		Volume: volume,
	}
	return ds.repo.CreateDuelPriceCandle(ctx, candle)
}

// GetPriceCandles retrieves all price candles for a duel
func (ds *DuelService) GetPriceCandles(ctx context.Context, duelID uuid.UUID) ([]*models.DuelPriceCandle, error) {
	return ds.repo.GetDuelPriceCandles(ctx, duelID)
}

// GenerateShareURL creates a Twitter share URL for a duel result
func (ds *DuelService) GenerateShareURL(
	amountWon float64,
	currency int16,
	loserUsername string,
	referralCode string,
) (string, string) {
	currencyLabel := "SOL"
	if currency == 1 {
		currencyLabel = "$PUMP"
	}

	tweetText := fmt.Sprintf(
		"I just won %.2f %s against @%s in a duel on @pumpfun! 🎉 Join me: %s",
		amountWon, currencyLabel, loserUsername, referralCode,
	)

	shareURL := fmt.Sprintf(
		"https://twitter.com/intent/tweet?text=%s",
		tweetText,
	)

	return shareURL, tweetText
}

// GetEscrowWalletAddress returns the server's wallet address for deposits
func (ds *DuelService) GetEscrowWalletAddress() string {
	return ds.solanaClient.GetServerWalletPublicKey()
}

// Helper functions
func timePtr(t time.Time) *time.Time {
	return &t
}
