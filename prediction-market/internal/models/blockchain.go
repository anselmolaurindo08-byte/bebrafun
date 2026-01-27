package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// WalletConnection represents a user's connected blockchain wallet
type WalletConnection struct {
	ID                uint            `gorm:"primaryKey" json:"id"`
	UserID            uint            `gorm:"uniqueIndex;not null" json:"user_id"`
	User              *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	WalletAddress     string          `gorm:"uniqueIndex;size:255;not null" json:"wallet_address"`
	Blockchain        string          `gorm:"size:50;default:SOLANA" json:"blockchain"`
	TokenBalance      decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"token_balance"`
	TokenSymbol       string          `gorm:"size:20;default:PREDICT" json:"token_symbol"`
	IsVerified        bool            `gorm:"default:false" json:"is_verified"`
	ConnectedAt       time.Time       `gorm:"autoCreateTime" json:"connected_at"`
	LastBalanceUpdate *time.Time      `json:"last_balance_update,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

func (WalletConnection) TableName() string {
	return "wallet_connections"
}

// EscrowTransaction represents a transaction to/from the escrow contract
type EscrowTransaction struct {
	ID              uint            `gorm:"primaryKey" json:"id"`
	DuelID          uint            `gorm:"not null;index" json:"duel_id"`
	UserID          uint            `gorm:"not null;index" json:"user_id"`
	User            *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	TransactionType string          `gorm:"size:50;not null" json:"transaction_type"` // DEPOSIT, PAYOUT, TRANSFER
	Amount          decimal.Decimal `gorm:"type:decimal(18,8);not null" json:"amount"`
	TokenSymbol     string          `gorm:"size:20;default:PREDICT" json:"token_symbol"`
	TransactionHash string          `gorm:"size:255" json:"transaction_hash"`
	Status          string          `gorm:"size:20;default:PENDING;index" json:"status"` // PENDING, CONFIRMED, FAILED
	Confirmations   int             `gorm:"default:0" json:"confirmations"`
	CreatedAt       time.Time       `json:"created_at"`
	ConfirmedAt     *time.Time      `json:"confirmed_at,omitempty"`
}

func (EscrowTransaction) TableName() string {
	return "escrow_transactions"
}

// DuelEscrowHold tracks tokens locked in escrow for a duel
type DuelEscrowHold struct {
	ID           uint            `gorm:"primaryKey" json:"id"`
	DuelID       uint            `gorm:"not null;index" json:"duel_id"`
	UserID       uint            `gorm:"not null;index" json:"user_id"`
	User         *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	AmountLocked decimal.Decimal `gorm:"type:decimal(18,8);not null" json:"amount_locked"`
	TokenSymbol  string          `gorm:"size:20;default:PREDICT" json:"token_symbol"`
	Status       string          `gorm:"size:20;default:LOCKED;index" json:"status"` // LOCKED, RELEASED, TRANSFERRED
	LockedAt     time.Time       `gorm:"autoCreateTime" json:"locked_at"`
	ReleasedAt   *time.Time      `json:"released_at,omitempty"`
}

func (DuelEscrowHold) TableName() string {
	return "duel_escrow_holds"
}

// TokenConfig stores configuration for supported tokens
type TokenConfig struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	TokenSymbol           string    `gorm:"uniqueIndex;size:20;not null" json:"token_symbol"`
	TokenMintAddress      string    `gorm:"size:255;not null" json:"token_mint_address"`
	EscrowContractAddress string    `gorm:"size:255;not null" json:"escrow_contract_address"`
	Decimals              int       `gorm:"default:6" json:"decimals"`
	IsActive              bool      `gorm:"default:true" json:"is_active"`
	CreatedAt             time.Time `json:"created_at"`
}

func (TokenConfig) TableName() string {
	return "token_config"
}
