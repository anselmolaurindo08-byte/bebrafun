package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// User represents a user in the system
type User struct {
	ID             uint            `gorm:"primaryKey" json:"id"`
	XUsername      string          `gorm:"uniqueIndex;not null" json:"x_username"`
	XID            string          `gorm:"uniqueIndex;not null" json:"x_id"`
	XAvatarURL     *string         `json:"x_avatar_url,omitempty"`
	FollowersCount int             `gorm:"default:0" json:"followers_count"`
	VirtualBalance decimal.Decimal `gorm:"type:decimal(18,8);default:1000.00" json:"virtual_balance"`
	WalletAddress  *string         `gorm:"uniqueIndex" json:"wallet_address,omitempty"`
	ReferrerID     *uint           `gorm:"index" json:"referrer_id,omitempty"`
	Referrer       *User           `gorm:"foreignKey:ReferrerID" json:"referrer,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}
