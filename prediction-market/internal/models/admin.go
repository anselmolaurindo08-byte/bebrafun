package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/shopspring/decimal"
)

// JSONB for PostgreSQL JSON support
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, &j)
}

// AdminUser represents an admin user with special permissions
type AdminUser struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	User        *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Role        string    `gorm:"size:20;not null" json:"role"` // SUPER_ADMIN, MODERATOR, ANALYST
	Permissions JSONB     `gorm:"type:jsonb" json:"permissions"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (AdminUser) TableName() string {
	return "admin_users"
}

// Contest represents a trading contest
type Contest struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	Name        string          `gorm:"size:255;not null" json:"name"`
	Description string          `gorm:"type:text" json:"description"`
	StartDate   time.Time       `gorm:"not null" json:"start_date"`
	EndDate     time.Time       `gorm:"not null" json:"end_date"`
	PrizePool   decimal.Decimal `gorm:"type:decimal(18,8);not null" json:"prize_pool"`
	Status      string          `gorm:"size:20;default:PENDING;index" json:"status"` // PENDING, ACTIVE, ENDED, DISTRIBUTED
	Rules       string          `gorm:"type:text" json:"rules"`
	CreatedBy   uint            `gorm:"not null" json:"created_by"`
	Creator     *AdminUser      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

func (Contest) TableName() string {
	return "contests"
}

// ContestParticipant represents a user participating in a contest
type ContestParticipant struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	ContestID   uint            `gorm:"not null;index" json:"contest_id"`
	Contest     *Contest        `gorm:"foreignKey:ContestID" json:"contest,omitempty"`
	UserID      uint            `gorm:"not null;index" json:"user_id"`
	User        *User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	EntryPnL    decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"entry_pnl"`
	FinalPnL    decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"final_pnl"`
	Rank        *int            `json:"rank"`
	PrizeAmount decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"prize_amount"`
	JoinedAt    time.Time       `gorm:"autoCreateTime" json:"joined_at"`
}

func (ContestParticipant) TableName() string {
	return "contest_participants"
}

// ContestLeaderboardSnapshot stores periodic snapshots of contest standings
type ContestLeaderboardSnapshot struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ContestID    uint      `gorm:"not null;index" json:"contest_id"`
	Contest      *Contest  `gorm:"foreignKey:ContestID" json:"contest,omitempty"`
	SnapshotData JSONB     `gorm:"type:jsonb;not null" json:"snapshot_data"`
	CreatedAt    time.Time `json:"created_at"`
}

func (ContestLeaderboardSnapshot) TableName() string {
	return "contest_leaderboard_snapshots"
}

// PlatformStats stores daily platform statistics
type PlatformStats struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	Date          time.Time       `gorm:"uniqueIndex;not null" json:"date"`
	TotalUsers    int             `gorm:"default:0" json:"total_users"`
	ActiveUsers   int             `gorm:"default:0" json:"active_users"`
	TotalTrades   int             `gorm:"default:0" json:"total_trades"`
	TotalVolume   decimal.Decimal `gorm:"type:decimal(18,8);default:0" json:"total_volume"`
	TotalMarkets  int             `gorm:"default:0" json:"total_markets"`
	ActiveMarkets int             `gorm:"default:0" json:"active_markets"`
	CreatedAt     time.Time       `json:"created_at"`
}

func (PlatformStats) TableName() string {
	return "platform_stats"
}

// AdminLog records admin actions for audit trail
type AdminLog struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	AdminID      uint      `gorm:"not null;index" json:"admin_id"`
	Admin        *AdminUser `gorm:"foreignKey:AdminID" json:"admin,omitempty"`
	Action       string    `gorm:"size:100;not null" json:"action"`
	ResourceType string    `gorm:"size:50" json:"resource_type"`
	ResourceID   *uint     `json:"resource_id"`
	Details      JSONB     `gorm:"type:jsonb" json:"details"`
	CreatedAt    time.Time `json:"created_at"`
}

func (AdminLog) TableName() string {
	return "admin_logs"
}

// UserRestriction represents bans, suspensions, and other restrictions
type UserRestriction struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	UserID          uint       `gorm:"not null;index" json:"user_id"`
	User            *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	RestrictionType string     `gorm:"size:50;not null" json:"restriction_type"` // BAN, SUSPEND, TRADING_DISABLED
	Reason          string     `gorm:"type:text" json:"reason"`
	DurationDays    *int       `json:"duration_days"`
	CreatedBy       uint       `gorm:"not null" json:"created_by"`
	Creator         *AdminUser `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	ExpiresAt       *time.Time `json:"expires_at"`
	IsActive        bool       `gorm:"default:true;index" json:"is_active"`
}

func (UserRestriction) TableName() string {
	return "user_restrictions"
}
