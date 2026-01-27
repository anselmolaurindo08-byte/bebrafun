package models

// MarketEvent represents an event within a market
type MarketEvent struct {
	ID               uint   `gorm:"primaryKey" json:"id"`
	MarketID         uint   `gorm:"not null;index" json:"market_id"`
	Market           Market `gorm:"foreignKey:MarketID" json:"market,omitempty"`
	EventTitle       string `gorm:"size:500;not null" json:"event_title"`
	EventDescription string `gorm:"type:text" json:"event_description"`
	OutcomeType      string `gorm:"size:50;not null" json:"outcome_type"` // binary, multiple
}

// TableName specifies the table name for MarketEvent model
func (MarketEvent) TableName() string {
	return "market_events"
}
