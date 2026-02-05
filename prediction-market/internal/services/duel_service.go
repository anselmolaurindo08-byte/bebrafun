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

	"github.com/gagliardetto/solana-go"
	"github.com/google/uuid"
)

type DuelService struct {
	repo              *repository.Repository
	escrowContract    *blockchain.EscrowContract
	solanaClient      *blockchain.SolanaClient
	anchorClient      *blockchain.AnchorClient // NEW: Anchor program client
	payoutService     *PayoutService
	priceService      *PriceService // NEW: Price oracle service
	duelMatchingQueue chan *models.DuelQueue
}

func NewDuelService(
	repo *repository.Repository,
	escrowContract *blockchain.EscrowContract,
	solanaClient *blockchain.SolanaClient,
	anchorClient *blockchain.AnchorClient,
	payoutService *PayoutService,
	priceService *PriceService,
) *DuelService {
	ds := &DuelService{
		repo:              repo,
		escrowContract:    escrowContract,
		solanaClient:      solanaClient,
		anchorClient:      anchorClient,
		payoutService:     payoutService,
		priceService:      priceService,
		duelMatchingQueue: make(chan *models.DuelQueue, 1000),
	}

	// Start matching goroutine
	go ds.matchDuels()

	return ds
}

// CreateDuel creates a new duel with immediate deposit verification
func (ds *DuelService) CreateDuel(
	ctx context.Context,
	playerID uint,
	req *models.CreateDuelRequest,
) (*models.Duel, error) {
	// Validate bet amount
	if req.BetAmount <= 0 {
		return nil, errors.New("bet amount must be positive")
	}

	// Convert float64 SOL to int64 lamports
	betAmountLamports := int64(req.BetAmount * 1_000_000_000)

	// Verify transaction on blockchain FIRST
	txDetails, err := ds.solanaClient.VerifyTransaction(ctx, req.Signature, 1)
	if err != nil {
		return nil, fmt.Errorf("failed to verify deposit transaction: %w", err)
	}

	if txDetails == nil || !txDetails.Confirmed {
		return nil, errors.New("deposit transaction not confirmed on blockchain")
	}

	// Verify transaction amount matches bet amount
	if txDetails.Amount < uint64(betAmountLamports) {
		return nil, fmt.Errorf("insufficient deposit: expected %d lamports, got %d", betAmountLamports, txDetails.Amount)
	}

	// Use duel ID from frontend if provided, otherwise generate new one
	var duelID int64
	if req.DuelID != nil && *req.DuelID > 0 {
		duelID = *req.DuelID
		log.Printf("=== [CreateDuel] Using duel ID from frontend: %d ===", duelID)
	} else {
		duelID = time.Now().UnixNano()
		log.Printf("=== [CreateDuel] ⚠️  Generated NEW duel ID (frontend didn't provide): %d ===", duelID)
	}

	log.Printf("[CreateDuel] Request details:")
	log.Printf("  - DuelID: %d", duelID)
	log.Printf("  - BetAmount: %.9f SOL (%d lamports)", req.BetAmount, betAmountLamports)
	log.Printf("  - Signature: %s", req.Signature)

	// Prepare duel address if provided
	var duelAddress *string
	if req.DuelAddress != "" {
		duelAddress = &req.DuelAddress
	}

	// DEBUG: Log direction field
	log.Printf("[CreateDuel] Direction field from request: %v (PredictedOutcome: %v)",
		func() string {
			if req.Direction != nil {
				return fmt.Sprintf("%d", *req.Direction)
			}
			return "nil"
		}(),
		func() string {
			if req.PredictedOutcome != nil {
				return *req.PredictedOutcome
			}
			return "nil"
		}())

	// Create duel in database with PENDING status (waiting for opponent)
	duel := &models.Duel{
		ID:               uuid.New(),
		DuelID:           duelID,
		DuelAddress:      duelAddress,
		Player1ID:        playerID,
		BetAmount:        betAmountLamports,
		Player1Amount:    betAmountLamports,
		MarketID:         req.MarketID,
		EventID:          req.EventID,
		PredictedOutcome: req.PredictedOutcome,
		Direction:        req.Direction,
		Status:           models.DuelStatusPending,
		CreatedAt:        time.Now(),
		ExpiresAt:        timePtr(time.Now().Add(5 * time.Minute)), // 5 min expiry
	}

	// Save to database
	err = ds.repo.CreateDuel(ctx, duel)
	if err != nil {
		return nil, fmt.Errorf("failed to create duel: %w", err)
	}

	// Record deposit transaction
	depositTx := &models.DuelTransaction{
		ID:              uuid.New(),
		DuelID:          duel.ID,
		TransactionType: models.DuelTransactionTypeDeposit,
		PlayerID:        playerID,
		Amount:          betAmountLamports,
		TxHash:          &req.Signature,
		Status:          models.DuelTransactionStatusConfirmed,
		CreatedAt:       time.Now(),
		ConfirmedAt:     timePtr(time.Now()),
	}

	err = ds.repo.CreateDuelTransaction(ctx, depositTx)
	if err != nil {
		return nil, fmt.Errorf("failed to record deposit transaction: %w", err)
	}

	log.Printf("Duel %d created with verified deposit from player %d (tx: %s)", duelID, playerID, req.Signature)

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
		// TODO: Implement escrow initialization when smart contract is ready
		// escrowTxHash, err := ds.escrowContract.InitializeEscrow(...)
		log.Printf("Escrow initialization skipped for duel %d (not implemented yet)", duel1.DuelID)

		log.Printf("Matched duel %d: %d vs %d", duel1.DuelID, duel1.Player1ID, *duel1.Player2ID)
	}
}

// JoinDuel allows a player to join/accept a pending duel with deposit verification
func (ds *DuelService) JoinDuel(
	ctx context.Context,
	duelID uuid.UUID,
	playerID uint,
	signature string,
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

	// Check if this transaction signature was already used (idempotency)
	existingTx, err := ds.repo.GetTransactionByHash(ctx, signature)
	if err == nil && existingTx != nil {
		return nil, errors.New("transaction signature already used")
	}

	// Verify transaction on blockchain
	log.Printf("[JoinDuel] Verifying transaction %s for duel %s", signature, duelID)
	txDetails, err := ds.solanaClient.VerifyTransaction(ctx, signature, 1)
	if err != nil {
		log.Printf("[JoinDuel] Transaction verification failed: %v", err)
		return nil, fmt.Errorf("failed to verify deposit transaction: %w", err)
	}

	if txDetails == nil || !txDetails.Confirmed {
		log.Printf("[JoinDuel] Transaction not confirmed: txDetails=%v", txDetails)
		return nil, errors.New("deposit transaction not confirmed on blockchain")
	}

	log.Printf("[JoinDuel] Transaction verified: amount=%d lamports, expected=%d lamports", txDetails.Amount, duel.BetAmount)

	// Verify transaction amount matches bet amount
	if txDetails.Amount < uint64(duel.BetAmount) {
		return nil, fmt.Errorf("insufficient deposit: expected %d lamports, got %d", duel.BetAmount, txDetails.Amount)
	}

	// Set Player2 and update status to COUNTDOWN temporarily
	duel.Player2ID = &playerID
	duel.Player2Amount = &duel.BetAmount

	// Save to database with COUNTDOWN status first
	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to update duel: %w", err)
	}

	// Record deposit transaction for Player2
	depositTx := &models.DuelTransaction{
		ID:              uuid.New(),
		DuelID:          duel.ID,
		TransactionType: models.DuelTransactionTypeDeposit,
		PlayerID:        playerID,
		Amount:          duel.BetAmount,
		TxHash:          &signature,
		Status:          models.DuelTransactionStatusConfirmed,
		CreatedAt:       time.Now(),
		ConfirmedAt:     timePtr(time.Now()),
	}

	err = ds.repo.CreateDuelTransaction(ctx, depositTx)
	if err != nil {
		return nil, fmt.Errorf("failed to record deposit transaction: %w", err)
	}

	log.Printf("Player %d joined duel %d with verified deposit (tx: %s)", playerID, duel.DuelID, signature)

	// Determine price pair based on duel currency or default to SOL/USD
	pricePair := "SOL/USD"
	if duel.PricePair != nil && *duel.PricePair != "" {
		pricePair = *duel.PricePair
	}

	// Get real-time entry price
	entryPrice, err := ds.priceService.GetPrice(pricePair)
	if err != nil {
		log.Printf("ERROR: Failed to get price for %s: %v", pricePair, err)
		return nil, fmt.Errorf("failed to get entry price: %w", err)
	}

	// Convert to cents (2 decimals) for price comparison
	entryPriceCents := uint64(entryPrice * 100)

	log.Printf("[JoinDuel] Starting duel %d with entry price %d cents (%.2f %s)",
		duel.DuelID, entryPriceCents, entryPrice, pricePair)

	// Call start_duel on-chain to set entry price
	log.Printf("=== [JoinDuel] Calling StartDuel on-chain ===")
	log.Printf("[JoinDuel] DuelID for on-chain call: %d", duel.DuelID)
	log.Printf("[JoinDuel] Entry price (cents): %d", entryPriceCents)

	startSignature, err := ds.anchorClient.StartDuel(
		ctx,
		uint64(duel.DuelID),
		entryPriceCents,
	)
	if err != nil {
		log.Printf("ERROR: Failed to start duel %s on-chain: %v", duel.ID, err)

		// Rollback: remove player 2 and revert to PENDING
		duel.Player2ID = nil
		duel.Player2Amount = nil
		duel.Status = models.DuelStatusPending
		if updateErr := ds.repo.UpdateDuel(ctx, duel); updateErr != nil {
			log.Printf("ERROR: Failed to rollback duel %s: %v", duel.ID, updateErr)
		}

		return nil, fmt.Errorf("failed to start duel on-chain: %w", err)
	}

	log.Printf("[JoinDuel] Duel started on-chain: %s", startSignature)

	// Update duel status to COUNTDOWN (cron job will set to ACTIVE later)
	duel.Status = models.DuelStatusCountdown
	now := time.Now()
	duel.StartedAt = &now
	entryPriceFloat := float64(entryPriceCents) / 100 // Convert cents to dollars
	duel.PriceAtStart = &entryPriceFloat

	// Save final state to database
	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to update duel to countdown: %w", err)
	}

	log.Printf("Duel %d started successfully. Entry price: $%.2f, Status: COUNTDOWN",
		duel.DuelID, entryPriceFloat)

	return duel, nil
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

	// Verify duel status - allow deposits in PENDING (first player) or MATCHED (both players)
	if duel.Status != models.DuelStatusPending && duel.Status != models.DuelStatusMatched {
		return fmt.Errorf("duel is not in pending/matched status, current status: %s", duel.Status)
	}

	// Verify transaction on blockchain (require at least 1 confirmation)
	txDetails, err := ds.solanaClient.VerifyTransaction(ctx, signature, 1)
	if err != nil {
		return fmt.Errorf("failed to verify transaction: %w", err)
	}

	if txDetails == nil || !txDetails.Confirmed {
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

	// Execute automatic payout via PayoutService
	payoutTx, err := ds.payoutService.ExecutePayout(ctx, duel, winnerID)
	if err != nil {
		return fmt.Errorf("failed to execute payout: %w", err)
	}

	// Update duel
	duel.Status = models.DuelStatusResolved
	duel.WinnerID = &winnerID
	duel.ResolvedAt = timePtr(time.Now())
	duel.ResolutionTxHash = payoutTx.TxHash

	err = ds.repo.UpdateDuel(ctx, duel)
	if err != nil {
		return fmt.Errorf("failed to update duel: %w", err)
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

	// Call smart contract to cancel and refund from escrow
	if duel.Status == models.DuelStatusPending && duel.Player1ID == playerID {
		// Get player 1 wallet address
		player1, err := ds.repo.GetUserByID(ctx, duel.Player1ID)
		if err != nil {
			log.Printf("[CancelDuel] Warning: failed to get player 1: %v", err)
		} else if player1.WalletAddress != "" {
			player1Pubkey, err := solana.PublicKeyFromBase58(player1.WalletAddress)
			if err != nil {
				log.Printf("[CancelDuel] Warning: invalid player 1 wallet: %v", err)
			} else {
				// Call smart contract to cancel and refund
				signature, err := ds.anchorClient.CancelDuel(ctx, uint64(duel.DuelID), player1Pubkey)
				if err != nil {
					log.Printf("[CancelDuel] Warning: failed to cancel on-chain: %v", err)
					// Continue with database update even if blockchain fails
				} else {
					log.Printf("[CancelDuel] On-chain cancel successful, refund tx: %s", signature)
				}
			}
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
	txHash string,
) (*models.DuelResult, error) {
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	if duel.Status != models.DuelStatusActive && duel.Status != models.DuelStatusFinished {
		return nil, fmt.Errorf("duel is not active/finished, current status: %s", duel.Status)
	}

	// Get player wallet addresses
	player1Wallet, err := ds.repo.GetUserWalletAddress(ctx, duel.Player1ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get player 1 wallet: %w", err)
	}
	if duel.Player2ID == nil {
		return nil, errors.New("duel has no second player")
	}
	player2Wallet, err := ds.repo.GetUserWalletAddress(ctx, *duel.Player2ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get player 2 wallet: %w", err)
	}

	// Convert exit price to cents (2 decimals) for price comparison
	// This must match the format used for entry_price in start_duel
	exitPriceCents := uint64(exitPrice * 100)

	// Call smart contract to resolve duel
	log.Printf("[ResolveDuelWithPrice] Calling contract resolve_duel for duel %s (duelId=%d, exitPrice=%d cents)",
		duelID, duel.DuelID, exitPriceCents)

	player1Pubkey, err := solana.PublicKeyFromBase58(player1Wallet)
	if err != nil {
		return nil, fmt.Errorf("invalid player 1 wallet: %w", err)
	}
	player2Pubkey, err := solana.PublicKeyFromBase58(player2Wallet)
	if err != nil {
		return nil, fmt.Errorf("invalid player 2 wallet: %w", err)
	}

	signature, err := ds.anchorClient.ResolveDuel(
		ctx,
		uint64(duel.DuelID),
		exitPriceCents,
		player1Pubkey,
		player2Pubkey,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve duel on-chain: %w", err)
	}

	log.Printf("[ResolveDuelWithPrice] Duel resolved on-chain: %s", signature)

	// Verify the transaction
	txDetails, err := ds.solanaClient.VerifyTransaction(ctx, signature, 1)
	if err != nil {
		return nil, fmt.Errorf("failed to verify resolution transaction: %w", err)
	}

	log.Printf("[ResolveDuelWithPrice] Resolution transaction verified: %+v", txDetails)

	// Determine loser
	var loserID uint
	if winnerID == duel.Player1ID {
		loserID = *duel.Player2ID
	} else if duel.Player2ID != nil && winnerID == *duel.Player2ID {
		loserID = duel.Player1ID
	} else {
		return nil, errors.New("winner must be one of the duel players")
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
	duel.TransactionHash = &signature // Use on-chain signature
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

	// NOTE: Payout is now handled by the smart contract automatically
	// No need to call payoutService.ExecutePayout anymore
	log.Printf("Duel %s resolved on-chain. Winner: %d, ExitPrice: %.4f, TxHash: %s",
		duelID, winnerID, exitPrice, signature)

	// Update statistics
	if err := ds.updatePlayerStatistics(ctx, duel, winnerID); err != nil {
		log.Printf("Error updating statistics after resolve: %v", err)
	}

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

// Helper functions
func timePtr(t time.Time) *time.Time {
	return &t
}

// AutoResolveDuel automatically resolves a duel when timer expires
// This function ONLY determines the winner and updates the database
// It does NOT call the smart contract - that happens when user clicks "CLAIM"
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

	// Check if duel is in correct status (allow both Countdown and Active)
	if duel.Status != models.DuelStatusActive && duel.Status != models.DuelStatusCountdown {
		return nil, fmt.Errorf("duel is not active or countdown (status: %s)", duel.Status)
	}

	// If still in Countdown, transition to Active first
	if duel.Status == models.DuelStatusCountdown {
		// Set entry price if not set
		if duel.PriceAtStart == nil {
			duel.PriceAtStart = &exitPrice // Use current price as entry
		}

		duel.Status = models.DuelStatusActive
		now := time.Now()
		duel.StartedAt = &now

		if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
			return nil, fmt.Errorf("failed to start duel: %w", err)
		}

		log.Printf("[AutoResolveDuel] Started duel %s with entry price %.4f", duelID, *duel.PriceAtStart)

		// Call smart contract start_duel to update on-chain status
		entryPriceCents := uint64(*duel.PriceAtStart * 100) // Convert to cents
		signature, err := ds.anchorClient.StartDuel(ctx, uint64(duel.DuelID), entryPriceCents)
		if err != nil {
			log.Printf("[AutoResolveDuel] WARNING: Failed to start duel on-chain: %v", err)
			// Don't fail the entire operation - DB is already updated
		} else {
			log.Printf("[AutoResolveDuel] Duel started on-chain: %s", signature)
		}
	}

	// Get entry price
	entryPrice := duel.PriceAtStart
	if entryPrice == nil {
		return nil, fmt.Errorf("duel has no entry price")
	}

	// Determine winner based on price movement
	var winnerID uint
	if exitPrice >= *entryPrice {
		// Price went UP - Player 1 wins
		winnerID = duel.Player1ID
	} else {
		// Price went DOWN - Player 2 wins
		if duel.Player2ID == nil {
			return nil, fmt.Errorf("duel has no player 2")
		}
		winnerID = *duel.Player2ID
	}

	log.Printf("[AutoResolveDuel] Duel %s resolved: entry=%.4f, exit=%.4f, winner=%d",
		duelID, *entryPrice, exitPrice, winnerID)

	// Update duel status to RESOLVED
	duel.Status = models.DuelStatusResolved
	duel.WinnerID = &winnerID
	duel.PriceAtEnd = &exitPrice
	now := time.Now()
	duel.ResolvedAt = &now

	if err := ds.repo.UpdateDuel(ctx, duel); err != nil {
		return nil, fmt.Errorf("failed to update duel: %w", err)
	}

	// Return minimal result
	result := &models.DuelResult{
		DuelID:     duelID,
		WinnerID:   winnerID,
		ExitPrice:  exitPrice,
		EntryPrice: *entryPrice,
	}

	return result, nil
}

// SetChartStartPrice sets the chart start price for a duel
// This is a stub method - chart functionality not fully implemented
func (ds *DuelService) SetChartStartPrice(
	ctx context.Context,
	duelID uuid.UUID,
	price float64,
) error {
	log.Printf("[SetChartStartPrice] Setting chart start price for duel %s: %.4f", duelID, price)
	// TODO: Implement chart start price logic if needed
	return nil
}

// ClaimWinnings processes a claim request from the winner
// This is called AFTER the smart contract has sent the payout
// It just updates the database to mark the duel as claimed
func (ds *DuelService) ClaimWinnings(
	ctx context.Context,
	duelID uuid.UUID,
	playerID uint,
) (*models.DuelResult, error) {
	// Get duel
	duel, err := ds.repo.GetDuelByID(ctx, duelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get duel: %w", err)
	}

	// Check if duel is resolved
	if duel.Status != models.DuelStatusResolved {
		return nil, fmt.Errorf("duel is not resolved (status: %s)", duel.Status)
	}

	// Check if player is the winner
	if duel.WinnerID == nil || *duel.WinnerID != playerID {
		return nil, fmt.Errorf("player %d is not the winner", playerID)
	}

	log.Printf("[ClaimWinnings] Player %d claiming winnings for duel %s", playerID, duelID)

	// Note: Status stays RESOLVED - we don't have CLAIMED status
	// Smart contract already sent payout, this just confirms claim in DB

	// Return result
	result := &models.DuelResult{
		DuelID:     duelID,
		WinnerID:   *duel.WinnerID,
		ExitPrice:  *duel.PriceAtEnd,
		EntryPrice: *duel.PriceAtStart,
	}

	return result, nil
}
