package models

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	WalletAddress  string    `gorm:"uniqueIndex;not null" json:"wallet_address"`
	Nickname       string    `gorm:"uniqueIndex;not null" json:"nickname"`
	XUsername      *string   `gorm:"uniqueIndex" json:"x_username,omitempty"`
	XID            *string   `gorm:"uniqueIndex" json:"x_id,omitempty"`
	XAvatarURL     *string   `json:"x_avatar_url,omitempty"`
	FollowersCount int       `gorm:"default:0" json:"followers_count"`
	ReferrerID     *uint     `gorm:"index" json:"referrer_id,omitempty"`
	Referrer       *User     `gorm:"foreignKey:ReferrerID" json:"referrer,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}
