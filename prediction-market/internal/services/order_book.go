package services

import (
	"encoding/json"
	"sync"

	"prediction-market/internal/models"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type OrderBookService struct {
	db *gorm.DB
	mu sync.RWMutex
}

func NewOrderBookService(db *gorm.DB) *OrderBookService {
	return &OrderBookService{
		db: db,
	}
}

// GetOrderBook returns the current order book for a market outcome
func (s *OrderBookService) GetOrderBook(marketID uint, marketEventID uint) (*models.OrderBook, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var buyOrders []models.Order
	var sellOrders []models.Order

	// Get buy orders (sorted by price descending)
	if err := s.db.Where("market_id = ? AND market_event_id = ? AND order_type = ? AND status IN ?",
		marketID, marketEventID, "BUY", []string{"OPEN", "PARTIALLY_FILLED"}).
		Order("price DESC").Find(&buyOrders).Error; err != nil {
		return nil, err
	}

	// Get sell orders (sorted by price ascending)
	if err := s.db.Where("market_id = ? AND market_event_id = ? AND order_type = ? AND status IN ?",
		marketID, marketEventID, "SELL", []string{"OPEN", "PARTIALLY_FILLED"}).
		Order("price ASC").Find(&sellOrders).Error; err != nil {
		return nil, err
	}

	// Aggregate orders by price level
	bidLevels := s.aggregateOrderLevels(buyOrders)
	askLevels := s.aggregateOrderLevels(sellOrders)

	// Calculate mid price and spread
	var midPrice, spread decimal.Decimal
	if len(bidLevels) > 0 && len(askLevels) > 0 {
		midPrice = bidLevels[0].Price.Add(askLevels[0].Price).Div(decimal.NewFromInt(2))
		spread = askLevels[0].Price.Sub(bidLevels[0].Price)
	}

	return &models.OrderBook{
		MarketID:      marketID,
		MarketEventID: marketEventID,
		BidLevels:     bidLevels,
		AskLevels:     askLevels,
		MidPrice:      midPrice,
		Spread:        spread,
	}, nil
}

// aggregateOrderLevels aggregates orders by price level
func (s *OrderBookService) aggregateOrderLevels(orders []models.Order) []models.OrderBookLevel {
	levelMap := make(map[string]*models.OrderBookLevel)

	for _, order := range orders {
		priceStr := order.Price.String()
		remainingQty := order.Quantity.Sub(order.FilledQuantity)

		if level, exists := levelMap[priceStr]; exists {
			level.Quantity = level.Quantity.Add(remainingQty)
			level.Orders++
		} else {
			levelMap[priceStr] = &models.OrderBookLevel{
				Price:    order.Price,
				Quantity: remainingQty,
				Orders:   1,
			}
		}
	}

	// Convert map to slice
	var levels []models.OrderBookLevel
	for _, level := range levelMap {
		levels = append(levels, *level)
	}

	return levels
}

// SaveOrderBookSnapshot saves a snapshot of the order book for analytics
func (s *OrderBookService) SaveOrderBookSnapshot(marketID uint, marketEventID uint) error {
	orderBook, err := s.GetOrderBook(marketID, marketEventID)
	if err != nil {
		return err
	}

	bidJSON, _ := json.Marshal(orderBook.BidLevels)
	askJSON, _ := json.Marshal(orderBook.AskLevels)

	snapshot := map[string]interface{}{
		"market_id":       marketID,
		"market_event_id": marketEventID,
		"buy_orders":      bidJSON,
		"sell_orders":     askJSON,
		"mid_price":       orderBook.MidPrice,
		"spread":          orderBook.Spread,
	}

	return s.db.Table("order_book_snapshots").Create(snapshot).Error
}
