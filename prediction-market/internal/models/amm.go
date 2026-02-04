package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Pool status constants
type PoolStatus string

const (
	PoolStatusActive   PoolStatus = "ACTIVE"
	PoolStatusPaused   PoolStatus = "PAUSED"
	PoolStatusResolved PoolStatus = "RESOLVED"
)

// Trade type constants (matches frontend TradeType)
type AMMTradeType int16

const (
	TradeTypeBuyYes  AMMTradeType = 0
	TradeTypeBuyNo   AMMTradeType = 1
	TradeTypeSellYes AMMTradeType = 2
	TradeTypeSellNo  AMMTradeType = 3
)

// Trade status constants
type AMMTradeStatus string

const (
	AMMTradeStatusPending   AMMTradeStatus = "PENDING"
	AMMTradeStatusConfirmed AMMTradeStatus = "CONFIRMED"
	AMMTradeStatusFailed    AMMTradeStatus = "FAILED"
)

// AMMPool represents a liquidity pool for a prediction market
type AMMPool struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	MarketID       *uint      `gorm:"index" json:"market_id"`
	OnchainPoolID  *uint64    `gorm:"uniqueIndex" json:"onchain_pool_id"` // Blockchain pool_id
	ProgramID      string     `gorm:"size:255;uniqueIndex;not null" json:"program_id"`
	Authority      string     `gorm:"size:255;not null" json:"authority"`
	PoolAddress    *string    `gorm:"size:255;uniqueIndex" json:"pool_address"` // On-chain pool PDA address
	YesMint        string     `gorm:"size:255;not null" json:"yes_mint"`
	NoMint         string     `gorm:"size:255;not null" json:"no_mint"`
	YesReserve     int64      `gorm:"not null;default:0" json:"yes_reserve"`
	NoReserve      int64      `gorm:"not null;default:0" json:"no_reserve"`
	FeePercentage  int16      `gorm:"not null;default:50" json:"fee_percentage"` // basis points (50 = 0.5%)
	TotalLiquidity int64      `gorm:"not null;default:0" json:"total_liquidity"`
	Bump           int16      `gorm:"not null;default:0" json:"bump"`
	Status         PoolStatus `gorm:"size:50;not null;default:ACTIVE;index" json:"status"`
	CreatedAt      time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (AMMPool) TableName() string {
	return "amm_pools"
}

// PriceCandle represents OHLCV data for charting
type PriceCandle struct {
	ID        uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PoolID    uuid.UUID       `gorm:"type:uuid;not null;index" json:"pool_id"`
	Timestamp time.Time       `gorm:"not null;index" json:"timestamp"`
	Open      decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"open"`
	High      decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"high"`
	Low       decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"low"`
	Close     decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"close"`
	Volume    int64           `gorm:"not null;default:0" json:"volume"`
	CreatedAt time.Time       `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (PriceCandle) TableName() string {
	return "price_candles"
}

// AMMPosition represents a user's token position in a pool
type AMMPosition struct {
	ID            uuid.UUID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PoolID        uuid.UUID        `gorm:"type:uuid;not null;index" json:"pool_id"`
	UserAddress   string           `gorm:"size:255;not null;index" json:"user_address"`
	YesBalance    int64            `gorm:"not null;default:0" json:"yes_balance"`
	NoBalance     int64            `gorm:"not null;default:0" json:"no_balance"`
	EntryPriceYes *decimal.Decimal `gorm:"type:decimal(20,8)" json:"entry_price_yes"`
	EntryPriceNo  *decimal.Decimal `gorm:"type:decimal(20,8)" json:"entry_price_no"`
	PnL           decimal.Decimal  `gorm:"type:decimal(20,8);default:0" json:"pnl"`
	CreatedAt     time.Time        `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt     time.Time        `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (AMMPosition) TableName() string {
	return "amm_positions"
}

// AMMTrade represents a single trade in a pool
type AMMTrade struct {
	ID                   uuid.UUID       `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	PoolID               uuid.UUID       `gorm:"type:uuid;not null;index" json:"pool_id"`
	UserAddress          string          `gorm:"size:255;not null;index" json:"user_address"`
	TradeType            AMMTradeType    `gorm:"not null" json:"trade_type"`
	InputAmount          int64           `gorm:"not null" json:"input_amount"`
	OutputAmount         int64           `gorm:"not null" json:"output_amount"`
	FeeAmount            int64           `gorm:"not null" json:"fee_amount"`
	Price                decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"price"`
	TransactionSignature string          `gorm:"size:255;not null;uniqueIndex" json:"transaction_signature"`
	Status               AMMTradeStatus  `gorm:"size:50;not null;default:PENDING;index" json:"status"`
	Confirmations        int16           `gorm:"default:0" json:"confirmations"`
	CreatedAt            time.Time       `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt            time.Time       `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (AMMTrade) TableName() string {
	return "amm_trades"
}

// ---- Request/Response DTOs ----

// CreatePoolRequest is the request body for creating a new AMM pool
type CreatePoolRequest struct {
	MarketID      *uint   `json:"market_id"`
	OnchainPoolID *uint64 `json:"onchain_pool_id"` // Blockchain pool_id
	ProgramID     string  `json:"program_id" binding:"required"`
	Authority     string  `json:"authority" binding:"required"`
	PoolAddress   string  `json:"pool_address"` // On-chain pool PDA address
	YesMint       string  `json:"yes_mint" binding:"required"`
	NoMint        string  `json:"no_mint" binding:"required"`
	YesReserve    int64   `json:"yes_reserve" binding:"required,min=1"`
	NoReserve     int64   `json:"no_reserve" binding:"required,min=1"`
	FeePercentage int16   `json:"fee_percentage"`
}

// TradeQuoteRequest is the query params for getting a trade quote
type TradeQuoteRequest struct {
	PoolID      string `form:"pool_id" binding:"required"`
	InputAmount int64  `form:"input_amount" binding:"required,min=1"`
	TradeType   int16  `form:"trade_type" binding:"min=0,max=3"`
}

// TradeQuoteResponse is the response for a trade quote
type TradeQuoteResponse struct {
	OutputAmount    int64   `json:"output_amount"`
	PricePerToken   float64 `json:"price_per_token"`
	FeeAmount       int64   `json:"fee_amount"`
	PriceImpact     float64 `json:"price_impact"`
	MinimumReceived int64   `json:"minimum_received"`
}

// RecordTradeRequest is the request body for recording a trade
type RecordTradeRequest struct {
	PoolID               string `json:"pool_id" binding:"required"`
	TradeType            int16  `json:"trade_type" binding:"min=0,max=3"`
	InputAmount          int64  `json:"input_amount" binding:"required,min=1"`
	OutputAmount         int64  `json:"output_amount" binding:"required,min=1"`
	FeeAmount            int64  `json:"fee_amount"`
	TransactionSignature string `json:"transaction_signature" binding:"required"`
}

// PoolResponse is the API response for a pool
type PoolResponse struct {
	ID             string    `json:"id"`
	MarketID       *uint     `json:"market_id"`
	ProgramID      string    `json:"program_id"`
	Authority      string    `json:"authority"`
	PoolAddress    *string   `json:"pool_address,omitempty"` // On-chain pool address
	YesMint        string    `json:"yes_mint"`
	NoMint         string    `json:"no_mint"`
	YesReserve     int64     `json:"yes_reserve"`
	NoReserve      int64     `json:"no_reserve"`
	FeePercentage  int16     `json:"fee_percentage"`
	TotalLiquidity int64     `json:"total_liquidity"`
	YesPrice       float64   `json:"yes_price"`
	NoPrice        float64   `json:"no_price"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
