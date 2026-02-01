package services

import (
	"context"
	"fmt"
	"testing"
	"time"

	"prediction-market/internal/models"
	"prediction-market/internal/repository"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// TestDuel mirrors models.Duel but compatible with SQLite (no Postgres specific defaults)
type TestDuel struct {
	ID               uuid.UUID         `gorm:"type:uuid;primaryKey" json:"id"`
	DuelID           int64             `gorm:"uniqueIndex;not null" json:"duel_id"`
	Player1ID        uint              `gorm:"not null;index" json:"player_1_id"`
	Player1Username  string            `gorm:"size:255" json:"player_1_username"`
	Player1Avatar    *string           `gorm:"size:500" json:"player_1_avatar"`
	Player2ID        *uint             `gorm:"index" json:"player_2_id"`
	Player2Username  *string           `gorm:"size:255" json:"player_2_username"`
	Player2Avatar    *string           `gorm:"size:500" json:"player_2_avatar"`
	BetAmount        int64             `gorm:"not null" json:"bet_amount"`
	Currency         int16             `gorm:"not null;default:0" json:"currency"`
	Player1Amount    int64             `gorm:"not null" json:"player_1_amount"`
	Player2Amount    *int64            `json:"player_2_amount"`
	Player1Deposited bool              `gorm:"default:false" json:"player_1_deposited"`
	Player2Deposited bool              `gorm:"default:false" json:"player_2_deposited"`
	MarketID         *uint             `gorm:"index" json:"market_id"`
	EventID          *uint             `gorm:"index" json:"event_id"`
	PredictedOutcome *string           `gorm:"size:255" json:"predicted_outcome"`
	Status           models.DuelStatus `gorm:"size:50;not null;default:PENDING;index" json:"status"`
	WinnerID         *uint             `json:"winner_id"`
	PriceAtStart     *float64          `gorm:"type:decimal(20,8)" json:"price_at_start"`
	PriceAtEnd       *float64          `gorm:"type:decimal(20,8)" json:"price_at_end"`
	Direction        *int16            `json:"direction"`
	TransactionHash  *string           `gorm:"size:255" json:"transaction_hash"`
	Confirmations    int16             `gorm:"default:0" json:"confirmations"`
	EscrowTxHash     *string           `gorm:"size:255" json:"escrow_tx_hash"`
	ResolutionTxHash *string           `gorm:"size:255" json:"resolution_tx_hash"`
	CreatedAt        time.Time         `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	StartedAt        *time.Time        `json:"started_at"`
	ResolvedAt       *time.Time        `json:"resolved_at"`
	ExpiresAt        *time.Time        `json:"expires_at"`
	UpdatedAt        time.Time         `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (TestDuel) TableName() string {
	return "duels"
}

// TestDuelStatistics mirrors models.DuelStatistics
type TestDuelStatistics struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID       uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	TotalDuels   int64     `gorm:"default:0" json:"total_duels"`
	Wins         int64     `gorm:"default:0" json:"wins"`
	Losses       int64     `gorm:"default:0" json:"losses"`
	TotalWagered int64     `gorm:"default:0" json:"total_wagered"`
	TotalWon     int64     `gorm:"default:0" json:"total_won"`
	TotalLost    int64     `gorm:"default:0" json:"total_lost"`
	WinRate      float64   `gorm:"type:decimal(5,2);default:0" json:"win_rate"`
	AvgBet       int64     `gorm:"default:0" json:"avg_bet"`
	UpdatedAt    time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (TestDuelStatistics) TableName() string {
	return "duel_statistics"
}

// TestTransactionConfirmationRecord mirrors models.TransactionConfirmationRecord
type TestTransactionConfirmationRecord struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	DuelID          uuid.UUID `gorm:"type:uuid;not null;index" json:"duel_id"`
	TransactionHash string    `gorm:"size:255;not null;uniqueIndex" json:"transaction_hash"`
	Confirmations   int16     `gorm:"default:0" json:"confirmations"`
	Status          string    `gorm:"size:50;not null;default:pending" json:"status"`
	Timestamp       int64     `gorm:"not null" json:"timestamp"`
	CreatedAt       time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt       time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (TestTransactionConfirmationRecord) TableName() string {
	return "transaction_confirmations"
}

// TestDuelResult mirrors models.DuelResult
type TestDuelResult struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	DuelID             uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"duel_id"`
	WinnerID           uint      `gorm:"not null;index" json:"winner_id"`
	LoserID            uint      `gorm:"not null;index" json:"loser_id"`
	WinnerUsername     string    `gorm:"size:255;not null" json:"winner_username"`
	LoserUsername      string    `gorm:"size:255;not null" json:"loser_username"`
	WinnerAvatar       *string   `gorm:"size:500" json:"winner_avatar"`
	LoserAvatar        *string   `gorm:"size:500" json:"loser_avatar"`
	AmountWon          float64   `gorm:"type:decimal(20,8);not null" json:"amount_won"`
	Currency           int16     `gorm:"not null" json:"currency"`
	EntryPrice         float64   `gorm:"type:decimal(20,8);not null" json:"entry_price"`
	ExitPrice          float64   `gorm:"type:decimal(20,8);not null" json:"exit_price"`
	PriceChange        float64   `gorm:"type:decimal(20,8);not null" json:"price_change"`
	PriceChangePercent float64   `gorm:"type:decimal(10,4);not null" json:"price_change_percent"`
	Direction          int16     `gorm:"not null" json:"direction"`
	WasCorrect         bool      `gorm:"not null" json:"was_correct"`
	DurationSeconds    int64     `gorm:"not null" json:"duration_seconds"`
	CreatedAt          time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (TestDuelResult) TableName() string {
	return "duel_results"
}

// TestDuelPriceCandle mirrors models.DuelPriceCandle
type TestDuelPriceCandle struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	DuelID    uuid.UUID `gorm:"type:uuid;not null;index" json:"duel_id"`
	Time      int64     `gorm:"not null" json:"time"`
	Open      float64   `gorm:"type:decimal(20,8);not null" json:"open"`
	High      float64   `gorm:"type:decimal(20,8);not null" json:"high"`
	Low       float64   `gorm:"type:decimal(20,8);not null" json:"low"`
	Close     float64   `gorm:"type:decimal(20,8);not null" json:"close"`
	Volume    float64   `gorm:"type:decimal(20,8);not null" json:"volume"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (TestDuelPriceCandle) TableName() string {
	return "duel_price_candles"
}

// TestDuelTransaction mirrors models.DuelTransaction
type TestDuelTransaction struct {
	ID              uuid.UUID                    `gorm:"type:uuid;primaryKey" json:"id"`
	DuelID          uuid.UUID                    `gorm:"type:uuid;not null;index" json:"duel_id"`
	TransactionType models.DuelTransactionType   `gorm:"size:50;not null" json:"transaction_type"`
	PlayerID        uint                         `gorm:"not null;index" json:"player_id"`
	Amount          int64                        `gorm:"not null" json:"amount"`
	TxHash          *string                      `gorm:"size:255" json:"tx_hash"`
	Status          models.DuelTransactionStatus `gorm:"size:50;not null;default:PENDING;index" json:"status"`
	CreatedAt       time.Time                    `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	ConfirmedAt     *time.Time                   `json:"confirmed_at"`
}

func (TestDuelTransaction) TableName() string {
	return "duel_transactions"
}

// TestDuelQueue mirrors models.DuelQueue
type TestDuelQueue struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	PlayerID         uint       `gorm:"not null;index" json:"player_id"`
	BetAmount        int64      `gorm:"not null;index" json:"bet_amount"`
	MarketID         *uint      `gorm:"index" json:"market_id"`
	EventID          *uint      `gorm:"index" json:"event_id"`
	PredictedOutcome *string    `gorm:"size:255" json:"predicted_outcome"`
	Status           string     `gorm:"size:50;not null;default:WAITING;index" json:"status"`
	CreatedAt        time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	MatchedAt        *time.Time `json:"matched_at"`
}

func (TestDuelQueue) TableName() string {
	return "duel_queue"
}

func TestPerformanceMatchDuels(t *testing.T) {
	// Set worker count to 1 for SQLite to avoid deadlocks in tests
	t.Setenv("DUEL_WORKER_COUNT", "1")

	// Setup in-memory DB with busy timeout to handle concurrency
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared&_journal_mode=WAL&_busy_timeout=5000"), &gorm.Config{
		Logger: logger.Discard,
	})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	// Migrate schema using Test structs
	err = db.AutoMigrate(
		&TestDuel{},
		&models.User{},
		&TestDuelStatistics{},
		&TestDuelTransaction{},
		&TestDuelQueue{},
		&TestDuelResult{},
		&TestTransactionConfirmationRecord{},
		&TestDuelPriceCandle{},
	)
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	repo := repository.NewRepository(db)
	ds := NewDuelService(repo, nil, nil) // Mocked dependencies

	// Create 1000 pending duels (Opponents)
	betAmount := int64(1000000000) // 1 SOL
	count := 1000

	fmt.Printf("Seeding %d opponents...\n", count)
	for i := 0; i < count; i++ {
		opponentID := uint(i + 10000)
		duel := &models.Duel{
			ID:        uuid.New(),
			DuelID:    int64(i),
			Player1ID: opponentID,
			BetAmount: betAmount,
			Status:    models.DuelStatusPending,
			CreatedAt: time.Now(),
		}
		if err := repo.CreateDuel(context.Background(), duel); err != nil {
			t.Fatalf("failed to create duel: %v", err)
		}
	}

	// Create all player duels first to avoid write contention during benchmark
	fmt.Printf("Creating %d player duels...\n", count)
	playerQueueItems := make([]*models.DuelQueue, count)
	for i := 0; i < count; i++ {
		playerID := uint(i + 20000)

		// We first create the duel for this player (as CreateDuel does)
		duel := &models.Duel{
			ID:        uuid.New(),
			DuelID:    int64(i + count),
			Player1ID: playerID,
			BetAmount: betAmount,
			Status:    models.DuelStatusPending,
			CreatedAt: time.Now(),
		}
		if err := repo.CreateDuel(context.Background(), duel); err != nil {
			t.Fatalf("failed to create player duel: %v", err)
		}

		playerQueueItems[i] = &models.DuelQueue{
			ID:               uuid.New(),
			PlayerID:         playerID,
			BetAmount:        betAmount,
			Status:           "WAITING",
			CreatedAt:        time.Now(),
		}
	}

	// Measure performance
	start := time.Now()

	fmt.Printf("Pushing %d requests to queue...\n", count)
	// Push requests to queue
	for _, item := range playerQueueItems {
		ds.duelMatchingQueue <- item
	}

	fmt.Println("Waiting for processing...")

	// Wait max 30 seconds
	timeout := time.After(30 * time.Second)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	completed := false
	var matches int64

	for {
		select {
		case <-timeout:
			t.Fatal("Timeout waiting for matches")
		case <-ticker.C:
			// Check how many of the "Player" duels are matched
			// IDs 1000 to 1999 (DuelID)
			db.Model(&TestDuel{}).
				Where("duel_id >= ? AND status = ?", count, models.DuelStatusMatched).
				Count(&matches)

			if matches >= int64(count) {
				completed = true
				goto Done
			}
		}
	}

Done:
	duration := time.Since(start)
	if !completed {
		t.Fatalf("Failed to complete all matches. Matched: %d/%d", matches, count)
	}

	fmt.Printf("Processed %d matches in %v (%.2f matches/sec)\n", count, duration, float64(count)/duration.Seconds())
}
