package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// Order represents a buy/sell order in the market
type Order struct {
	ID             uint            `gorm:"primaryKey" json:"id"`
	UserID         uint            `json:"user_id"`
	MarketID       uint            `json:"market_id"`
	MarketEventID  uint            `json:"market_event_id"`
	OrderType      string          `json:"order_type"` // BUY or SELL
	Quantity       decimal.Decimal `json:"quantity" gorm:"type:decimal(18,8)"`
	Price          decimal.Decimal `json:"price" gorm:"type:decimal(18,8)"`
	TotalCost      decimal.Decimal `json:"total_cost" gorm:"type:decimal(18,8)"`
	Status         string          `json:"status"` // OPEN, PARTIALLY_FILLED, FILLED, CANCELLED
	FilledQuantity decimal.Decimal `json:"filled_quantity" gorm:"type:decimal(18,8);default:0"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// TableName specifies the table name for Order model
func (Order) TableName() string {
	return "orders"
}

// Trade represents an executed match between buyer and seller
type Trade struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	BuyerID       uint            `json:"buyer_id"`
	SellerID      uint            `json:"seller_id"`
	MarketID      uint            `json:"market_id"`
	MarketEventID uint            `json:"market_event_id"`
	Quantity      decimal.Decimal `json:"quantity" gorm:"type:decimal(18,8)"`
	Price         decimal.Decimal `json:"price" gorm:"type:decimal(18,8)"`
	TotalAmount   decimal.Decimal `json:"total_amount" gorm:"type:decimal(18,8)"`
	BuyerOrderID  *uint           `json:"buyer_order_id"`
	SellerOrderID *uint           `json:"seller_order_id"`
	CreatedAt     time.Time       `json:"created_at"`
}

// TableName specifies the table name for Trade model
func (Trade) TableName() string {
	return "trades"
}

// UserPosition represents a user's holdings in a specific market outcome
type UserPosition struct {
	ID            uint            `gorm:"primaryKey" json:"id"`
	UserID        uint            `json:"user_id"`
	MarketID      uint            `json:"market_id"`
	MarketEventID uint            `json:"market_event_id"`
	Quantity      decimal.Decimal `json:"quantity" gorm:"type:decimal(18,8);default:0"`
	AveragePrice  decimal.Decimal `json:"average_price" gorm:"type:decimal(18,8);default:0"`
	UnrealizedPnL decimal.Decimal `json:"unrealized_pnl" gorm:"type:decimal(18,8);default:0"`
	RealizedPnL   decimal.Decimal `json:"realized_pnl" gorm:"type:decimal(18,8);default:0"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// TableName specifies the table name for UserPosition model
func (UserPosition) TableName() string {
	return "user_positions"
}

// OrderBookLevel represents a price level in the order book
type OrderBookLevel struct {
	Price    decimal.Decimal `json:"price"`
	Quantity decimal.Decimal `json:"quantity"`
	Orders   int             `json:"orders"`
}

// OrderBook represents the complete order book for a market outcome
type OrderBook struct {
	MarketID      uint             `json:"market_id"`
	MarketEventID uint             `json:"market_event_id"`
	BidLevels     []OrderBookLevel `json:"bid_levels"`
	AskLevels     []OrderBookLevel `json:"ask_levels"`
	MidPrice      decimal.Decimal  `json:"mid_price"`
	Spread        decimal.Decimal  `json:"spread"`
}

// MarketResolution represents the resolution of a market
type MarketResolution struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	MarketID         uint      `json:"market_id"`
	WinningEventID   uint      `json:"winning_event_id"`
	ResolvedAt       time.Time `json:"resolved_at"`
	PayoutCalculated bool      `json:"payout_calculated" gorm:"default:false"`
}

// TableName specifies the table name for MarketResolution model
func (MarketResolution) TableName() string {
	return "market_resolutions"
}

// UserPayout represents the payout for a user after market resolution
type UserPayout struct {
	ID           uint            `gorm:"primaryKey" json:"id"`
	UserID       uint            `json:"user_id"`
	MarketID     uint            `json:"market_id"`
	PayoutAmount decimal.Decimal `json:"payout_amount" gorm:"type:decimal(18,8)"`
	PnL          decimal.Decimal `json:"pnl" gorm:"type:decimal(18,8)"`
	CreatedAt    time.Time       `json:"created_at"`
}

// TableName specifies the table name for UserPayout model
func (UserPayout) TableName() string {
	return "user_payouts"
}
