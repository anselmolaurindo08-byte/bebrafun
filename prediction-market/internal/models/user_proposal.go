package models

import (
	"time"
)

// UserProposal represents a user-submitted market proposal
type UserProposal struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	UserID            uint      `gorm:"not null;index" json:"user_id"`
	User              User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	MarketTitle       string    `gorm:"size:500;not null" json:"market_title"`
	MarketDescription string    `gorm:"type:text" json:"market_description"`
	Category          string    `gorm:"size:50;not null" json:"category"`            // Politics, Sports, Crypto, Solana
	Status            string    `gorm:"size:50;default:pending;index" json:"status"` // pending, approved, rejected
	CreatedAt         time.Time `json:"created_at"`
}

// TableName specifies the table name for UserProposal model
func (UserProposal) TableName() string {
	return "user_proposals"
}
