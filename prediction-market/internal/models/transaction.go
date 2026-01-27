package models

import (
	"time"
)

// Transaction represents a virtual currency transaction
type Transaction struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"not null;index" json:"user_id"`
	User        User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Type        string    `gorm:"size:50;not null;index" json:"type"` // deposit, withdrawal, bet_placed, bet_won, bet_lost, referral_bonus, social_bonus
	Amount      float64   `gorm:"type:decimal(15,2);not null" json:"amount"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"index" json:"created_at"`
}

// TableName specifies the table name for Transaction model
func (Transaction) TableName() string {
	return "transactions"
}
