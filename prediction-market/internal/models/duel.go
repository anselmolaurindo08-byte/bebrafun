package models

import (
	"time"

	"github.com/google/uuid"
)

type DuelStatus string

const (
	DuelStatusPending   DuelStatus = "PENDING"
	DuelStatusMatched   DuelStatus = "MATCHED"
	DuelStatusActive    DuelStatus = "ACTIVE"
	DuelStatusResolved  DuelStatus = "RESOLVED"
	DuelStatusCancelled DuelStatus = "CANCELLED"
	DuelStatusExpired   DuelStatus = "EXPIRED"
)

type DuelTransactionType string

const (
	DuelTransactionTypeDeposit  DuelTransactionType = "DEPOSIT"
	DuelTransactionTypeWithdraw DuelTransactionType = "WITHDRAW"
	DuelTransactionTypePayout   DuelTransactionType = "PAYOUT"
	DuelTransactionTypeTransfer DuelTransactionType = "TRANSFER"
)

type DuelTransactionStatus string

const (
	DuelTransactionStatusPending   DuelTransactionStatus = "PENDING"
	DuelTransactionStatusConfirmed DuelTransactionStatus = "CONFIRMED"
	DuelTransactionStatusFailed    DuelTransactionStatus = "FAILED"
)

// Duel represents a single duel between two players
type Duel struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DuelID           int64      `gorm:"uniqueIndex;not null" json:"duel_id"`
	Player1ID        uint       `gorm:"not null;index" json:"player_1_id"`
	Player2ID        *uint      `gorm:"index" json:"player_2_id"`
	BetAmount        int64      `gorm:"not null" json:"bet_amount"`
	Player1Amount    int64      `gorm:"not null" json:"player_1_amount"`
	Player2Amount    *int64     `json:"player_2_amount"`
	MarketID         *uint      `gorm:"index" json:"market_id"`
	EventID          *uint      `gorm:"index" json:"event_id"`
	PredictedOutcome *string    `gorm:"size:255" json:"predicted_outcome"`
	Status           DuelStatus `gorm:"size:50;not null;default:PENDING;index" json:"status"`
	WinnerID         *uint      `json:"winner_id"`
	EscrowTxHash     *string    `gorm:"size:255" json:"escrow_tx_hash"`
	ResolutionTxHash *string    `gorm:"size:255" json:"resolution_tx_hash"`
	CreatedAt        time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	StartedAt        *time.Time `json:"started_at"`
	ResolvedAt       *time.Time `json:"resolved_at"`
	ExpiresAt        *time.Time `json:"expires_at"`
}

func (Duel) TableName() string {
	return "duels"
}

// DuelTransaction represents a blockchain transaction for a duel
type DuelTransaction struct {
	ID              uuid.UUID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DuelID          uuid.UUID             `gorm:"type:uuid;not null;index" json:"duel_id"`
	TransactionType DuelTransactionType   `gorm:"size:50;not null" json:"transaction_type"`
	PlayerID        uint                  `gorm:"not null;index" json:"player_id"`
	Amount          int64                 `gorm:"not null" json:"amount"`
	TxHash          *string               `gorm:"size:255" json:"tx_hash"`
	Status          DuelTransactionStatus `gorm:"size:50;not null;default:PENDING;index" json:"status"`
	CreatedAt       time.Time             `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	ConfirmedAt     *time.Time            `json:"confirmed_at"`
}

func (DuelTransaction) TableName() string {
	return "duel_transactions"
}

// DuelQueue represents a player waiting for a match
type DuelQueue struct {
	ID               uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PlayerID         uint       `gorm:"not null;index" json:"player_id"`
	BetAmount        int64      `gorm:"not null;index" json:"bet_amount"`
	MarketID         *uint      `gorm:"index" json:"market_id"`
	EventID          *uint      `gorm:"index" json:"event_id"`
	PredictedOutcome *string    `gorm:"size:255" json:"predicted_outcome"`
	Status           string     `gorm:"size:50;not null;default:WAITING;index" json:"status"`
	CreatedAt        time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	MatchedAt        *time.Time `json:"matched_at"`
}

func (DuelQueue) TableName() string {
	return "duel_queue"
}

// DuelStatistics represents player duel statistics
type DuelStatistics struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
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

func (DuelStatistics) TableName() string {
	return "duel_statistics"
}

// CreateDuelRequest represents a request to create a new duel
// CreateDuelRequest represents a request to create a new duel
type CreateDuelRequest struct {
	BetAmount        int64   `json:"bet_amount" binding:"required,min=1"`
	MarketID         *uint   `json:"market_id"`
	EventID          *uint   `json:"event_id"`
	PredictedOutcome *string `json:"predicted_outcome"`
	Opponent         *uint   `json:"opponent"` // Optional: specific opponent ID
}

// DuelResponse represents a duel in API responses
type DuelResponse struct {
	ID            string     `json:"id"`
	DuelID        int64      `json:"duel_id"`
	Player1       UserInfo   `json:"player_1"`
	Player2       *UserInfo  `json:"player_2"`
	BetAmount     int64      `json:"bet_amount"`
	Player1Amount int64      `json:"player_1_amount"`
	Player2Amount *int64     `json:"player_2_amount"`
	Status        string     `json:"status"`
	Winner        *UserInfo  `json:"winner"`
	CreatedAt     time.Time  `json:"created_at"`
	StartedAt     *time.Time `json:"started_at"`
	ResolvedAt    *time.Time `json:"resolved_at"`
	ExpiresAt     *time.Time `json:"expires_at"`
}

type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}
