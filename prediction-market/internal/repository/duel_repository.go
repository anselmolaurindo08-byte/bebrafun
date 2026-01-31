package repository

import (
	"context"

	"prediction-market/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateDuel creates a new duel
func (r *Repository) CreateDuel(ctx context.Context, duel *models.Duel) error {
	return r.db.WithContext(ctx).Create(duel).Error
}

// GetDuelByID retrieves a duel by ID
func (r *Repository) GetDuelByID(ctx context.Context, duelID uuid.UUID) (*models.Duel, error) {
	var duel models.Duel
	err := r.db.WithContext(ctx).Where("id = ?", duelID).First(&duel).Error
	if err != nil {
		return nil, err
	}
	return &duel, nil
}

// GetDuelByDuelID retrieves a duel by DuelID (numeric ID)
func (r *Repository) GetDuelByDuelID(ctx context.Context, duelID int64) (*models.Duel, error) {
	var duel models.Duel
	err := r.db.WithContext(ctx).Where("duel_id = ?", duelID).First(&duel).Error
	if err != nil {
		return nil, err
	}
	return &duel, nil
}

// UpdateDuel updates a duel
func (r *Repository) UpdateDuel(ctx context.Context, duel *models.Duel) error {
	return r.db.WithContext(ctx).Save(duel).Error
}

// GetLatestDuelByPlayer retrieves the latest duel created by a player
func (r *Repository) GetLatestDuelByPlayer(ctx context.Context, playerID uint) (*models.Duel, error) {
	var duel models.Duel
	err := r.db.WithContext(ctx).
		Where("player1_id = ?", playerID).
		Order("created_at DESC").
		First(&duel).Error
	if err != nil {
		return nil, err
	}
	return &duel, nil
}

// FindMatchingOpponent finds a waiting opponent with the same bet amount
func (r *Repository) FindMatchingOpponent(
	ctx context.Context,
	playerID uint,
	betAmount int64,
) (*uint, error) {
	// Find a duel in PENDING status with same bet amount but different player
	var duel models.Duel
	err := r.db.WithContext(ctx).
		Where("status = ? AND bet_amount = ? AND player1_id != ? AND player2_id IS NULL",
			models.DuelStatusPending, betAmount, playerID).
		Order("created_at ASC").
		First(&duel).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil // No match found
	}

	if err != nil {
		return nil, err
	}

	// Return the opponent's player ID
	return &duel.Player1ID, nil
}

// GetPlayerDuels retrieves all duels for a player
func (r *Repository) GetPlayerDuels(
	ctx context.Context,
	playerID uint,
	limit int,
	offset int,
) ([]*models.Duel, error) {
	var duels []*models.Duel
	err := r.db.WithContext(ctx).
		Where("player1_id = ? OR player2_id = ?", playerID, playerID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&duels).Error

	if err != nil {
		return nil, err
	}

	return duels, nil
}

// CreateDuelTransaction creates a new duel transaction
func (r *Repository) CreateDuelTransaction(ctx context.Context, tx *models.DuelTransaction) error {
	return r.db.WithContext(ctx).Create(tx).Error
}

// GetDuelDeposits retrieves all confirmed deposit transactions for a duel
func (r *Repository) GetDuelDeposits(ctx context.Context, duelID uuid.UUID) ([]*models.DuelTransaction, error) {
	var transactions []*models.DuelTransaction
	err := r.db.WithContext(ctx).
		Where("duel_id = ? AND transaction_type = ? AND status = ?",
			duelID, models.DuelTransactionTypeDeposit, models.DuelTransactionStatusConfirmed).
		Find(&transactions).Error

	if err != nil {
		return nil, err
	}

	return transactions, nil
}

// GetDuelTransactions retrieves all transactions for a duel
func (r *Repository) GetDuelTransactions(ctx context.Context, duelID uuid.UUID) ([]*models.DuelTransaction, error) {
	var transactions []*models.DuelTransaction
	err := r.db.WithContext(ctx).
		Where("duel_id = ?", duelID).
		Order("created_at DESC").
		Find(&transactions).Error

	if err != nil {
		return nil, err
	}

	return transactions, nil
}

// GetDuelStatistics retrieves duel statistics for a user
func (r *Repository) GetDuelStatistics(ctx context.Context, userID uint) (*models.DuelStatistics, error) {
	var stats models.DuelStatistics
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&stats).Error

	if err == gorm.ErrRecordNotFound {
		// Create new stats if not exists
		stats = models.DuelStatistics{
			ID:           uuid.New(),
			UserID:       userID,
			TotalDuels:   0,
			Wins:         0,
			Losses:       0,
			TotalWagered: 0,
			TotalWon:     0,
			TotalLost:    0,
			WinRate:      0,
			AvgBet:       0,
		}

		if err := r.db.WithContext(ctx).Create(&stats).Error; err != nil {
			return nil, err
		}

		return &stats, nil
	}

	if err != nil {
		return nil, err
	}

	return &stats, nil
}

// IncrementDuelStats updates duel statistics for a user
func (r *Repository) IncrementDuelStats(
	ctx context.Context,
	userID uint,
	duelsIncr int64,
	winsIncr int64,
	lossesIncr int64,
	wageredIncr int64,
	wonIncr int64,
	lostIncr int64,
) error {
	// Prepare the upsert struct with initial values (for the INSERT case)
	initialStats := models.DuelStatistics{
		UserID:       userID,
		TotalDuels:   duelsIncr,
		Wins:         winsIncr,
		Losses:       lossesIncr,
		TotalWagered: wageredIncr,
		TotalWon:     wonIncr,
		TotalLost:    lostIncr,
	}

	// Calculate initial derived stats
	if initialStats.TotalDuels > 0 {
		initialStats.WinRate = float64(initialStats.Wins) / float64(initialStats.TotalDuels) * 100
		initialStats.AvgBet = initialStats.TotalWagered / initialStats.TotalDuels
	}

	// Perform Upsert with atomic update for counters
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"total_duels":   gorm.Expr("duel_statistics.total_duels + ?", duelsIncr),
			"wins":          gorm.Expr("duel_statistics.wins + ?", winsIncr),
			"losses":        gorm.Expr("duel_statistics.losses + ?", lossesIncr),
			"total_wagered": gorm.Expr("duel_statistics.total_wagered + ?", wageredIncr),
			"total_won":     gorm.Expr("duel_statistics.total_won + ?", wonIncr),
			"total_lost":    gorm.Expr("duel_statistics.total_lost + ?", lostIncr),
			// Calculate derived fields atomically using the NEW values of counters
			// Note: referencing the column name here (e.g. duel_statistics.total_duels) usually refers to the OLD value in Postgres ON CONFLICT DO UPDATE.
			// So we must repeat the increment logic in the calculation.
			"win_rate": gorm.Expr("CASE WHEN (duel_statistics.total_duels + ?) > 0 THEN (CAST((duel_statistics.wins + ?) AS NUMERIC) / (duel_statistics.total_duels + ?) * 100) ELSE 0 END", duelsIncr, winsIncr, duelsIncr),
			"avg_bet":  gorm.Expr("CASE WHEN (duel_statistics.total_duels + ?) > 0 THEN ((duel_statistics.total_wagered + ?) / (duel_statistics.total_duels + ?)) ELSE 0 END", duelsIncr, wageredIncr, duelsIncr),
			"updated_at": gorm.Expr("CURRENT_TIMESTAMP"),
		}),
	}).Create(&initialStats).Error
}

// GetUserByID retrieves a user by ID
func (r *Repository) GetUserByID(ctx context.Context, userID uint) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).Where("id = ?", userID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// AddToQueue adds a player to the duel matching queue
func (r *Repository) AddToQueue(ctx context.Context, queueItem *models.DuelQueue) error {
	return r.db.WithContext(ctx).Create(queueItem).Error
}

// RemoveFromQueue removes a player from the duel matching queue
func (r *Repository) RemoveFromQueue(ctx context.Context, playerID uint) error {
	return r.db.WithContext(ctx).
		Where("player_id = ? AND status = ?", playerID, "WAITING").
		Delete(&models.DuelQueue{}).Error
}

// GetActiveDuels retrieves all active duels
func (r *Repository) GetActiveDuels(ctx context.Context, limit int) ([]*models.Duel, error) {
	var duels []*models.Duel
	err := r.db.WithContext(ctx).
		Where("status IN ?", []models.DuelStatus{
			models.DuelStatusPending,
			models.DuelStatusMatched,
			models.DuelStatusActive,
		}).
		Order("created_at DESC").
		Limit(limit).
		Find(&duels).Error

	if err != nil {
		return nil, err
	}

	return duels, nil
}

// CountPlayerActiveDuels counts active duels for a player
func (r *Repository) CountPlayerActiveDuels(ctx context.Context, playerID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Duel{}).
		Where("(player1_id = ? OR player2_id = ?) AND status IN ?",
			playerID, playerID,
			[]models.DuelStatus{
				models.DuelStatusPending,
				models.DuelStatusMatched,
				models.DuelStatusActive,
			}).
		Count(&count).Error

	return count, err
}

// ExpirePendingDuels marks pending duels as expired if they exceed expiry time
func (r *Repository) ExpirePendingDuels(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Model(&models.Duel{}).
		Where("status = ? AND expires_at < NOW()", models.DuelStatusPending).
		Update("status", models.DuelStatusExpired).Error
}

// ============================================================================
// Enhanced Duel Repository Methods
// ============================================================================

// GetAvailableDuels retrieves pending duels that haven't expired
func (r *Repository) GetAvailableDuels(ctx context.Context, limit, offset int) ([]*models.Duel, int64, error) {
	var total int64
	err := r.db.WithContext(ctx).Model(&models.Duel{}).
		Where("status = ? AND (expires_at IS NULL OR expires_at > NOW())", models.DuelStatusPending).
		Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	var duels []*models.Duel
	err = r.db.WithContext(ctx).
		Where("status = ? AND (expires_at IS NULL OR expires_at > NOW())", models.DuelStatusPending).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&duels).Error
	if err != nil {
		return nil, 0, err
	}

	return duels, total, nil
}

// GetUserDuels retrieves all duels for a user with total count
func (r *Repository) GetUserDuels(ctx context.Context, userID uint, limit, offset int) ([]*models.Duel, int64, error) {
	var total int64
	err := r.db.WithContext(ctx).Model(&models.Duel{}).
		Where("player1_id = ? OR player2_id = ?", userID, userID).
		Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	var duels []*models.Duel
	err = r.db.WithContext(ctx).
		Where("player1_id = ? OR player2_id = ?", userID, userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&duels).Error
	if err != nil {
		return nil, 0, err
	}

	return duels, total, nil
}

// UpsertTransactionConfirmation inserts or updates a transaction confirmation record
func (r *Repository) UpsertTransactionConfirmation(
	ctx context.Context,
	record *models.TransactionConfirmationRecord,
) (*models.TransactionConfirmationRecord, error) {
	// Try to find existing by transaction hash
	var existing models.TransactionConfirmationRecord
	err := r.db.WithContext(ctx).
		Where("transaction_hash = ?", record.TransactionHash).
		First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		// Create new
		if err := r.db.WithContext(ctx).Create(record).Error; err != nil {
			return nil, err
		}
		return record, nil
	}
	if err != nil {
		return nil, err
	}

	// Update existing
	existing.Confirmations = record.Confirmations
	existing.Status = record.Status
	if err := r.db.WithContext(ctx).Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

// GetTransactionConfirmation retrieves a confirmation by transaction hash
func (r *Repository) GetTransactionConfirmation(
	ctx context.Context,
	txHash string,
) (*models.TransactionConfirmationRecord, error) {
	var record models.TransactionConfirmationRecord
	err := r.db.WithContext(ctx).
		Where("transaction_hash = ?", txHash).
		First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

// CreateDuelResult creates a duel result record
func (r *Repository) CreateDuelResult(ctx context.Context, result *models.DuelResult) error {
	return r.db.WithContext(ctx).Create(result).Error
}

// GetDuelResult retrieves the result for a duel
func (r *Repository) GetDuelResult(ctx context.Context, duelID uuid.UUID) (*models.DuelResult, error) {
	var result models.DuelResult
	err := r.db.WithContext(ctx).Where("duel_id = ?", duelID).First(&result).Error
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// CreateDuelPriceCandle records a price candle for a duel
func (r *Repository) CreateDuelPriceCandle(ctx context.Context, candle *models.DuelPriceCandle) error {
	return r.db.WithContext(ctx).Create(candle).Error
}

// GetDuelPriceCandles retrieves all price candles for a duel
func (r *Repository) GetDuelPriceCandles(ctx context.Context, duelID uuid.UUID) ([]*models.DuelPriceCandle, error) {
	var candles []*models.DuelPriceCandle
	err := r.db.WithContext(ctx).
		Where("duel_id = ?", duelID).
		Order("time ASC").
		Find(&candles).Error
	if err != nil {
		return nil, err
	}
	return candles, nil
}
