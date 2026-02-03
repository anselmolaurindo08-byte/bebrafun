package models

import (
	"time"

	"github.com/google/uuid"
)

// UserPosition represents a virtual position in a prediction market pool
type UserPosition struct {
	ID          uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserAddress string    `gorm:"not null;index" json:"user_address"`
	PoolID      uuid.UUID `gorm:"type:uuid;not null;index" json:"pool_id"`
	Outcome     string    `gorm:"not null;check:outcome IN ('YES', 'NO')" json:"outcome"`
	Amount      int64     `gorm:"not null;check:amount > 0" json:"amount"`
	EntryPrice  float64   `gorm:"type:decimal(10,6);not null" json:"entry_price"`
	SolInvested int64     `gorm:"not null;check:sol_invested > 0" json:"sol_invested"`
	Status      string    `gorm:"not null;default:'OPEN';check:status IN ('OPEN', 'CLOSED')" json:"status"`
	CreatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

// TableName specifies the table name for UserPosition
func (UserPosition) TableName() string {
	return "user_positions"
}

// CreatePositionRequest represents the request to create a new position
type CreatePositionRequest struct {
	UserAddress string  `json:"user_address" binding:"required"`
	PoolID      string  `json:"pool_id" binding:"required"`
	Outcome     string  `json:"outcome" binding:"required,oneof=YES NO"`
	Amount      int64   `json:"amount" binding:"required,min=1"`
	EntryPrice  float64 `json:"entry_price" binding:"required,min=0"`
	SolInvested int64   `json:"sol_invested" binding:"required,min=1"`
}

// PositionResponse represents the API response for a position
type PositionResponse struct {
	ID          string    `json:"id"`
	UserAddress string    `json:"user_address"`
	PoolID      string    `json:"pool_id"`
	Outcome     string    `json:"outcome"`
	Amount      int64     `json:"amount"`
	EntryPrice  float64   `json:"entry_price"`
	SolInvested int64     `json:"sol_invested"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ClosePositionRequest represents the request to close a position
type ClosePositionRequest struct {
	ExitPrice   float64 `json:"exit_price" binding:"required,min=0"`
	SolReceived int64   `json:"sol_received" binding:"required,min=0"`
}
