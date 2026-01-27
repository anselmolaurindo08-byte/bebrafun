package models

import (
	"time"
)

// InviteCode represents an invite code for the referral system
type InviteCode struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	UserID       uint       `gorm:"not null;index" json:"user_id"`
	User         User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Code         string     `gorm:"uniqueIndex;not null;size:50" json:"code"`
	UsedByUserID *uint      `json:"used_by_user_id,omitempty"`
	UsedByUser   *User      `gorm:"foreignKey:UsedByUserID" json:"used_by_user,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UsedAt       *time.Time `json:"used_at,omitempty"`
}

// TableName specifies the table name for InviteCode model
func (InviteCode) TableName() string {
	return "invite_codes"
}
