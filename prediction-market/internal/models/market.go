package models

import (
	"time"
)

// Market represents a prediction market
type Market struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Title             string         `gorm:"size:500;not null" json:"title"`
	Description       string         `gorm:"type:text" json:"description"`
	Category          string         `gorm:"size:50;not null;index" json:"category"`     // Politics, Sports, Crypto, Solana
	Status            string         `gorm:"size:50;default:active;index" json:"status"` // active, closed, resolved, cancelled
	ResolutionOutcome string         `gorm:"size:50" json:"resolution_outcome,omitempty"`
	CreatedBy         *uint          `gorm:"index" json:"created_by,omitempty"`
	Creator           *User          `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	Events            []MarketEvent  `gorm:"foreignKey:MarketID" json:"events,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	ResolvedAt        *time.Time     `json:"resolved_at,omitempty"`
}

// TableName specifies the table name for Market model
func (Market) TableName() string {
	return "markets"
}
