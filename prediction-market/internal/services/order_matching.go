package services

import (
	"fmt"
	"log"
	"sync"

	"prediction-market/internal/models"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type OrderMatchingService struct {
	db *gorm.DB
	mu sync.Mutex
}

func NewOrderMatchingService(db *gorm.DB) *OrderMatchingService {
	return &OrderMatchingService{
		db: db,
	}
}

// PlaceOrder places a new order and attempts to match it
func (s *OrderMatchingService) PlaceOrder(userID uint, marketID uint, marketEventID uint,
	orderType string, quantity decimal.Decimal, price decimal.Decimal) (*models.Order, error) {

	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate order
	if err := s.validateOrder(userID, orderType, quantity, price); err != nil {
		return nil, err
	}

	// Create order
	totalCost := quantity.Mul(price)
	order := models.Order{
		UserID:         userID,
		MarketID:       marketID,
		MarketEventID:  marketEventID,
		OrderType:      orderType,
		Quantity:       quantity,
		Price:          price,
		TotalCost:      totalCost,
		Status:         "OPEN",
		FilledQuantity: decimal.Zero,
	}

	if err := s.db.Create(&order).Error; err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	// Deduct balance for buy orders
	if orderType == "BUY" {
		if err := s.db.Model(&models.User{}).Where("id = ?", userID).
			Update("virtual_balance", gorm.Expr("virtual_balance - ?", totalCost)).Error; err != nil {
			return nil, err
		}
	}

	// Attempt to match the order
	if err := s.matchOrder(&order); err != nil {
		log.Printf("Error matching order: %v", err)
	}

	return &order, nil
}

// matchOrder attempts to match an order with existing orders
func (s *OrderMatchingService) matchOrder(order *models.Order) error {
	if order.OrderType == "BUY" {
		return s.matchBuyOrder(order)
	}
	return s.matchSellOrder(order)
}

// matchBuyOrder matches a buy order with sell orders
func (s *OrderMatchingService) matchBuyOrder(buyOrder *models.Order) error {
	var sellOrders []models.Order
	if err := s.db.Where(
		"market_id = ? AND market_event_id = ? AND order_type = ? AND status IN ? AND price <= ?",
		buyOrder.MarketID, buyOrder.MarketEventID, "SELL",
		[]string{"OPEN", "PARTIALLY_FILLED"}, buyOrder.Price).
		Order("price ASC, created_at ASC").
		Find(&sellOrders).Error; err != nil {
		return err
	}

	remainingQuantity := buyOrder.Quantity.Sub(buyOrder.FilledQuantity)

	for i := range sellOrders {
		if remainingQuantity.IsZero() {
			break
		}

		sellOrder := &sellOrders[i]
		sellOrderRemaining := sellOrder.Quantity.Sub(sellOrder.FilledQuantity)
		tradeQuantity := decimal.Min(remainingQuantity, sellOrderRemaining)

		if err := s.executeTrade(buyOrder, sellOrder, tradeQuantity, sellOrder.Price); err != nil {
			log.Printf("Error executing trade: %v", err)
			continue
		}

		remainingQuantity = remainingQuantity.Sub(tradeQuantity)
		buyOrder.FilledQuantity = buyOrder.FilledQuantity.Add(tradeQuantity)
	}

	// Update buy order status
	status := "OPEN"
	if buyOrder.FilledQuantity.Equal(buyOrder.Quantity) {
		status = "FILLED"
	} else if buyOrder.FilledQuantity.GreaterThan(decimal.Zero) {
		status = "PARTIALLY_FILLED"
	}

	return s.db.Model(buyOrder).Updates(map[string]interface{}{
		"filled_quantity": buyOrder.FilledQuantity,
		"status":          status,
	}).Error
}

// matchSellOrder matches a sell order with buy orders
func (s *OrderMatchingService) matchSellOrder(sellOrder *models.Order) error {
	var buyOrders []models.Order
	if err := s.db.Where(
		"market_id = ? AND market_event_id = ? AND order_type = ? AND status IN ? AND price >= ?",
		sellOrder.MarketID, sellOrder.MarketEventID, "BUY",
		[]string{"OPEN", "PARTIALLY_FILLED"}, sellOrder.Price).
		Order("price DESC, created_at ASC").
		Find(&buyOrders).Error; err != nil {
		return err
	}

	remainingQuantity := sellOrder.Quantity.Sub(sellOrder.FilledQuantity)

	for i := range buyOrders {
		if remainingQuantity.IsZero() {
			break
		}

		buyOrder := &buyOrders[i]
		buyOrderRemaining := buyOrder.Quantity.Sub(buyOrder.FilledQuantity)
		tradeQuantity := decimal.Min(remainingQuantity, buyOrderRemaining)

		if err := s.executeTrade(buyOrder, sellOrder, tradeQuantity, buyOrder.Price); err != nil {
			log.Printf("Error executing trade: %v", err)
			continue
		}

		remainingQuantity = remainingQuantity.Sub(tradeQuantity)
		sellOrder.FilledQuantity = sellOrder.FilledQuantity.Add(tradeQuantity)
	}

	// Update sell order status
	status := "OPEN"
	if sellOrder.FilledQuantity.Equal(sellOrder.Quantity) {
		status = "FILLED"
	} else if sellOrder.FilledQuantity.GreaterThan(decimal.Zero) {
		status = "PARTIALLY_FILLED"
	}

	return s.db.Model(sellOrder).Updates(map[string]interface{}{
		"filled_quantity": sellOrder.FilledQuantity,
		"status":          status,
	}).Error
}

// executeTrade executes a trade between buyer and seller
func (s *OrderMatchingService) executeTrade(buyOrder *models.Order, sellOrder *models.Order,
	quantity decimal.Decimal, price decimal.Decimal) error {

	// Create trade record
	trade := models.Trade{
		BuyerID:       buyOrder.UserID,
		SellerID:      sellOrder.UserID,
		MarketID:      buyOrder.MarketID,
		MarketEventID: buyOrder.MarketEventID,
		Quantity:      quantity,
		Price:         price,
		TotalAmount:   quantity.Mul(price),
		BuyerOrderID:  &buyOrder.ID,
		SellerOrderID: &sellOrder.ID,
	}

	if err := s.db.Create(&trade).Error; err != nil {
		return fmt.Errorf("failed to create trade: %w", err)
	}

	// Update buyer position
	if err := s.updatePosition(buyOrder.UserID, buyOrder.MarketID, buyOrder.MarketEventID,
		quantity, price, true); err != nil {
		return err
	}

	// Update seller position
	if err := s.updatePosition(sellOrder.UserID, buyOrder.MarketID, buyOrder.MarketEventID,
		quantity, price, false); err != nil {
		return err
	}

	// Update seller balance (add proceeds)
	totalAmount := quantity.Mul(price)
	if err := s.db.Model(&models.User{}).Where("id = ?", sellOrder.UserID).
		Update("virtual_balance", gorm.Expr("virtual_balance + ?", totalAmount)).Error; err != nil {
		return err
	}

	// Update buy order filled quantity
	if err := s.db.Model(buyOrder).Updates(map[string]interface{}{
		"filled_quantity": buyOrder.FilledQuantity.Add(quantity),
	}).Error; err != nil {
		return err
	}

	// Update sell order filled quantity and status
	newFilledQty := sellOrder.FilledQuantity.Add(quantity)
	newStatus := "PARTIALLY_FILLED"
	if newFilledQty.Equal(sellOrder.Quantity) {
		newStatus = "FILLED"
	}

	if err := s.db.Model(sellOrder).Updates(map[string]interface{}{
		"filled_quantity": newFilledQty,
		"status":          newStatus,
	}).Error; err != nil {
		return err
	}

	log.Printf("Trade executed: %s shares at %s between user %d and %d",
		quantity.String(), price.String(), buyOrder.UserID, sellOrder.UserID)

	// Process referral rebates for both buyer and seller
	s.processTradeRebates(trade.ID, buyOrder.UserID, sellOrder.UserID, trade.TotalAmount)

	return nil
}

// processTradeRebates processes referral rebates for a trade
func (s *OrderMatchingService) processTradeRebates(tradeID uint, buyerID uint, sellerID uint, tradeAmount decimal.Decimal) {
	referralService := NewReferralService(s.db)

	// Process rebate for buyer's referrer
	if err := referralService.ProcessTradeRebate(tradeID, buyerID, tradeAmount); err != nil {
		log.Printf("Error processing buyer rebate: %v", err)
	}

	// Process rebate for seller's referrer
	if err := referralService.ProcessTradeRebate(tradeID, sellerID, tradeAmount); err != nil {
		log.Printf("Error processing seller rebate: %v", err)
	}
}

// updatePosition updates user's position in a market outcome
func (s *OrderMatchingService) updatePosition(userID uint, marketID uint, marketEventID uint,
	quantity decimal.Decimal, price decimal.Decimal, isBuy bool) error {

	var position models.UserPosition
	result := s.db.Where("user_id = ? AND market_id = ? AND market_event_id = ?",
		userID, marketID, marketEventID).First(&position)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new position
		if isBuy {
			position = models.UserPosition{
				UserID:        userID,
				MarketID:      marketID,
				MarketEventID: marketEventID,
				Quantity:      quantity,
				AveragePrice:  price,
			}
		} else {
			position = models.UserPosition{
				UserID:        userID,
				MarketID:      marketID,
				MarketEventID: marketEventID,
				Quantity:      quantity.Neg(),
				AveragePrice:  price,
			}
		}
		return s.db.Create(&position).Error
	}

	// Update existing position
	if isBuy {
		totalCost := position.Quantity.Mul(position.AveragePrice).Add(quantity.Mul(price))
		newQuantity := position.Quantity.Add(quantity)
		var newAveragePrice decimal.Decimal
		if newQuantity.IsZero() {
			newAveragePrice = decimal.Zero
		} else {
			newAveragePrice = totalCost.Div(newQuantity)
		}

		return s.db.Model(&position).Updates(map[string]interface{}{
			"quantity":      newQuantity,
			"average_price": newAveragePrice,
		}).Error
	} else {
		newQuantity := position.Quantity.Sub(quantity)
		return s.db.Model(&position).Update("quantity", newQuantity).Error
	}
}

// validateOrder validates an order before placing it
func (s *OrderMatchingService) validateOrder(userID uint, orderType string,
	quantity decimal.Decimal, price decimal.Decimal) error {

	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return fmt.Errorf("user not found")
	}

	// For buy orders, check if user has enough balance
	if orderType == "BUY" {
		requiredBalance := quantity.Mul(price)
		if user.VirtualBalance.LessThan(requiredBalance) {
			return fmt.Errorf("insufficient balance: required %s, available %s",
				requiredBalance.String(), user.VirtualBalance.String())
		}
	}

	// Validate price is between 0 and 1
	if price.LessThan(decimal.Zero) || price.GreaterThan(decimal.NewFromInt(1)) {
		return fmt.Errorf("price must be between 0 and 1")
	}

	// Validate quantity is positive
	if quantity.LessThanOrEqual(decimal.Zero) {
		return fmt.Errorf("quantity must be positive")
	}

	return nil
}

// CancelOrder cancels an open order
func (s *OrderMatchingService) CancelOrder(orderID uint, userID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var order models.Order
	if err := s.db.Where("id = ? AND user_id = ?", orderID, userID).First(&order).Error; err != nil {
		return fmt.Errorf("order not found")
	}

	if order.Status == "FILLED" || order.Status == "CANCELLED" {
		return fmt.Errorf("cannot cancel %s order", order.Status)
	}

	// Refund unfilled quantity for buy orders
	unfilledQuantity := order.Quantity.Sub(order.FilledQuantity)
	if order.OrderType == "BUY" && unfilledQuantity.GreaterThan(decimal.Zero) {
		refundAmount := unfilledQuantity.Mul(order.Price)
		if err := s.db.Model(&models.User{}).Where("id = ?", userID).
			Update("virtual_balance", gorm.Expr("virtual_balance + ?", refundAmount)).Error; err != nil {
			return err
		}
	}

	// Update order status
	return s.db.Model(&order).Update("status", "CANCELLED").Error
}
