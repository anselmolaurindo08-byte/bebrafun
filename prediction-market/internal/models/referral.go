package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// ReferralCode represents a unique referral code for a user
type ReferralCode struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"not null;index" json:"user_id"`
	User      *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Code      string     `gorm:"uniqueIndex;size:20;not null" json:"code"`
	IsActive  bool       `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

func (ReferralCode) TableName() string {
	return "referral_codes"
}

// Referral represents a referral relationship between users
type Referral struct {
	ID             uint          `gorm:"primaryKey" json:"id"`
	ReferrerID     uint          `gorm:"not null;index" json:"referrer_id"`
	Referrer       *User         `gorm:"foreignKey:ReferrerID" json:"referrer,omitempty"`
	ReferredUserID uint          `gorm:"not null;index" json:"referred_user_id"`
	ReferredUser   *User         `gorm:"foreignKey:ReferredUserID" json:"referred_user,omitempty"`
	ReferralCodeID *uint         `gorm:"index" json:"referral_code_id,omitempty"`
	ReferralCode   *ReferralCode `gorm:"foreignKey:ReferralCodeID" json:"referral_code,omitempty"`
	Status         string        `gorm:"size:20;default:ACTIVE" json:"status"` // ACTIVE, INACTIVE
	ReferredAt     time.Time     `gorm:"autoCreateTime" json:"referred_at"`
}

func (Referral) TableName() string {
	return "referrals"
}

// ReferralRebate represents a rebate earned from a referred user's trade
type ReferralRebate struct {
	ID               uint            `gorm:"primaryKey" json:"id"`
	ReferrerID       uint            `gorm:"not null;index" json:"referrer_id"`
	Referrer         *User           `gorm:"foreignKey:ReferrerID" json:"referrer,omitempty"`
	ReferredUserID   uint            `gorm:"not null" json:"referred_user_id"`
	ReferredUser     *User           `gorm:"foreignKey:ReferredUserID" json:"referred_user,omitempty"`
	TradeID          uint            `gorm:"not null" json:"trade_id"`
	RebatePercentage decimal.Decimal `gorm:"type:decimal(5,2);not null" json:"rebate_percentage"`
	RebateAmount     decimal.Decimal `gorm:"type:decimal(18,8);not null" json:"rebate_amount"`
	Status           string          `gorm:"size:20;default:PENDING;index" json:"status"` // PENDING, PAID
	CreatedAt        time.Time       `json:"created_at"`
	PaidAt           *time.Time      `json:"paid_at,omitempty"`
}

func (ReferralRebate) TableName() string {
	return "referral_rebates"
}

// SocialShare tracks social media shares for bonus rewards
type SocialShare struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	UserID      uint            `gorm:"not null;index" json:"user_id"`
	User        *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	MarketID    uint            `gorm:"not null" json:"market_id"`
	Market      *Market         `gorm:"foreignKey:MarketID" json:"market,omitempty"`
	ShareType   string          `gorm:"size:20;not null" json:"share_type"` // TWITTER
	PnLAmount   decimal.Decimal `gorm:"type:decimal(18,8);not null" json:"pnl_amount"`
	BonusAmount decimal.Decimal `gorm:"type:decimal(18,8);not null" json:"bonus_amount"`
	ShareURL    string          `gorm:"size:500" json:"share_url"`
	Verified    bool            `gorm:"default:false" json:"verified"`
	CreatedAt   time.Time       `json:"created_at"`
}

func (SocialShare) TableName() string {
	return "social_shares"
}

// ReferralStats holds aggregated referral statistics for a user
type ReferralStats struct {
	ID                 uint            `gorm:"primaryKey" json:"id"`
	UserID             uint            `gorm:"uniqueIndex;not null" json:"user_id"`
	User               *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	TotalReferrals     int             `gorm:"default:0" json:"total_referrals"`
	ActiveReferrals    int             `gorm:"default:0" json:"active_referrals"`
	TotalRebatesEarned decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"total_rebates_earned"`
	TotalRebatesPaid   decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"total_rebates_paid"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

func (ReferralStats) TableName() string {
	return "referral_stats"
}
