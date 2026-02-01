package models

import (
	"time"

	"github.com/google/uuid"
)

type DuelStatus string

const (
	DuelStatusPending               DuelStatus = "PENDING"
	DuelStatusMatched               DuelStatus = "MATCHED"
	DuelStatusWaitingDeposit        DuelStatus = "WAITING_DEPOSIT"
	DuelStatusConfirmingTransaction DuelStatus = "CONFIRMING_TRANSACTIONS"
	DuelStatusCountdown             DuelStatus = "COUNTDOWN"
	DuelStatusActive                DuelStatus = "ACTIVE"
	DuelStatusFinished              DuelStatus = "FINISHED"
	DuelStatusResolved              DuelStatus = "RESOLVED"
	DuelStatusCancelled             DuelStatus = "CANCELLED"
	DuelStatusExpired               DuelStatus = "EXPIRED"
)

type DuelTransactionType string

const (
	DuelTransactionTypeDeposit  DuelTransactionType = "DEPOSIT"
	DuelTransactionTypeWithdraw DuelTransactionType = "WITHDRAW"
	DuelTransactionTypePayout   DuelTransactionType = "PAYOUT"
	DuelTransactionTypeFee      DuelTransactionType = "FEE"
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
	Player1Username  string     `gorm:"size:255" json:"player_1_username"`
	Player1Avatar    *string    `gorm:"size:500" json:"player_1_avatar"`
	Player2ID        *uint      `gorm:"index" json:"player_2_id"`
	Player2Username  *string    `gorm:"size:255" json:"player_2_username"`
	Player2Avatar    *string    `gorm:"size:500" json:"player_2_avatar"`
	BetAmount        int64      `gorm:"not null" json:"bet_amount"`
	Currency         int16      `gorm:"not null;default:0" json:"currency"` // 0: SOL, 1: PUMP
	Player1Amount    int64      `gorm:"not null" json:"player_1_amount"`
	Player2Amount    *int64     `json:"player_2_amount"`
	MarketID         *uint      `gorm:"index" json:"market_id"`
	EventID          *uint      `gorm:"index" json:"event_id"`
	PredictedOutcome *string    `gorm:"size:255" json:"predicted_outcome"`
	Status           DuelStatus `gorm:"size:50;not null;default:PENDING;index" json:"status"`
	WinnerID         *uint      `json:"winner_id"`
	PriceAtStart     *float64   `gorm:"type:decimal(20,8)" json:"price_at_start"`
	PriceAtEnd       *float64   `gorm:"type:decimal(20,8)" json:"price_at_end"`
	Direction        *int16     `json:"direction"` // 0: UP, 1: DOWN
	TransactionHash  *string    `gorm:"size:255" json:"transaction_hash"`
	Confirmations    int16      `gorm:"default:0" json:"confirmations"`
	EscrowTxHash     *string    `gorm:"size:255" json:"escrow_tx_hash"`
	ResolutionTxHash *string    `gorm:"size:255" json:"resolution_tx_hash"`
	CreatedAt        time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	StartedAt        *time.Time `json:"started_at"`
	ResolvedAt       *time.Time `json:"resolved_at"`
	ExpiresAt        *time.Time `json:"expires_at"`
	UpdatedAt        time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
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

// TransactionConfirmationRecord tracks blockchain confirmations for a duel
type TransactionConfirmationRecord struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DuelID          uuid.UUID `gorm:"type:uuid;not null;index" json:"duel_id"`
	TransactionHash string    `gorm:"size:255;not null;uniqueIndex" json:"transaction_hash"`
	Confirmations   int16     `gorm:"default:0" json:"confirmations"`
	Status          string    `gorm:"size:50;not null;default:pending" json:"status"` // pending, confirmed, failed
	Timestamp       int64     `gorm:"not null" json:"timestamp"`
	CreatedAt       time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt       time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (TransactionConfirmationRecord) TableName() string {
	return "transaction_confirmations"
}

// DuelResult stores the outcome of a resolved duel
type DuelResult struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
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

func (DuelResult) TableName() string {
	return "duel_results"
}

// DuelPriceCandle represents OHLCV price data recorded during a duel
type DuelPriceCandle struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DuelID    uuid.UUID `gorm:"type:uuid;not null;index" json:"duel_id"`
	Time      int64     `gorm:"not null" json:"time"`
	Open      float64   `gorm:"type:decimal(20,8);not null" json:"open"`
	High      float64   `gorm:"type:decimal(20,8);not null" json:"high"`
	Low       float64   `gorm:"type:decimal(20,8);not null" json:"low"`
	Close     float64   `gorm:"type:decimal(20,8);not null" json:"close"`
	Volume    float64   `gorm:"type:decimal(20,8);not null" json:"volume"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (DuelPriceCandle) TableName() string {
	return "duel_price_candles"
}

// CreateDuelRequest represents a request to create a new duel
type CreateDuelRequest struct {
	BetAmount        float64 `json:"bet_amount" binding:"required,gt=0"`
	Currency         string  `json:"currency"` // "SOL", "PUMP"
	MarketID         *uint   `json:"market_id"`
	EventID          *uint   `json:"event_id"`
	PredictedOutcome *string `json:"predicted_outcome"`
	Opponent         *uint   `json:"opponent"`
	Signature        string  `json:"signature" binding:"required"` // Transaction signature for deposit
}

// DuelResponse represents a duel in API responses
type DuelResponse struct {
	ID            string     `json:"id"`
	DuelID        int64      `json:"duel_id"`
	Player1       UserInfo   `json:"player_1"`
	Player2       *UserInfo  `json:"player_2"`
	BetAmount     int64      `json:"bet_amount"`
	Currency      int16      `json:"currency"`
	Player1Amount int64      `json:"player_1_amount"`
	Player2Amount *int64     `json:"player_2_amount"`
	Status        string     `json:"status"`
	Winner        *UserInfo  `json:"winner"`
	PriceAtStart  *float64   `json:"price_at_start"`
	PriceAtEnd    *float64   `json:"price_at_end"`
	Direction     *int16     `json:"direction"`
	Confirmations int16      `json:"confirmations"`
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

// ResolveDuelRequest represents a request to resolve a duel with price data
type ResolveDuelRequest struct {
	DuelID          string  `json:"duelId" binding:"required"`
	WinnerID        string  `json:"winnerId" binding:"required"`
	ExitPrice       float64 `json:"exitPrice" binding:"required"`
	TransactionHash string  `json:"transactionHash" binding:"required"`
}

// ConfirmTransactionRequest represents a transaction confirmation request
type ConfirmTransactionRequest struct {
	DuelID          string `json:"duelId" binding:"required"`
	TransactionHash string `json:"transactionHash" binding:"required"`
	PlayerID        string `json:"playerId" binding:"required"`
}

// ShareRequest represents a share-on-X request
type ShareRequest struct {
	DuelID        string  `json:"duelId" binding:"required"`
	WinnerID      string  `json:"winnerId" binding:"required"`
	AmountWon     float64 `json:"amountWon" binding:"required"`
	Currency      int16   `json:"currency"`
	LoserUsername string  `json:"loserUsername" binding:"required"`
	ReferralCode  string  `json:"referralCode"`
}
