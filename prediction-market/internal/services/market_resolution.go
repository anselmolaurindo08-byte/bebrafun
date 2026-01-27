package services

import (
	"fmt"
	"log"
	"sync"

	"prediction-market/internal/models"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type MarketResolutionService struct {
	db *gorm.DB
	mu sync.Mutex
}

func NewMarketResolutionService(db *gorm.DB) *MarketResolutionService {
	return &MarketResolutionService{
		db: db,
	}
}

// ResolveMarket resolves a market with a winning outcome
func (s *MarketResolutionService) ResolveMarket(marketID uint, winningEventID uint) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Create resolution record
	resolution := models.MarketResolution{
		MarketID:       marketID,
		WinningEventID: winningEventID,
	}

	if err := s.db.Create(&resolution).Error; err != nil {
		return fmt.Errorf("failed to create resolution: %w", err)
	}

	// Calculate and distribute payouts
	if err := s.calculatePayouts(marketID, winningEventID); err != nil {
		return fmt.Errorf("failed to calculate payouts: %w", err)
	}

	// Mark resolution as complete
	return s.db.Model(&resolution).Update("payout_calculated", true).Error
}

// calculatePayouts calculates and distributes payouts for all users
func (s *MarketResolutionService) calculatePayouts(marketID uint, winningEventID uint) error {
	// Get all positions for this market
	var positions []models.UserPosition
	if err := s.db.Where("market_id = ?", marketID).Find(&positions).Error; err != nil {
		return err
	}

	// Calculate payouts for each position
	for _, position := range positions {
		var payout decimal.Decimal
		var pnl decimal.Decimal

		if position.MarketEventID == winningEventID {
			// User had winning position
			// Payout = quantity (shares owned)
			payout = position.Quantity
			// PnL = payout - cost basis
			costBasis := position.Quantity.Mul(position.AveragePrice)
			pnl = payout.Sub(costBasis)
		} else {
			// User had losing position
			payout = decimal.Zero
			costBasis := position.Quantity.Mul(position.AveragePrice)
			pnl = decimal.Zero.Sub(costBasis)
		}

		// Create payout record
		userPayout := models.UserPayout{
			UserID:       position.UserID,
			MarketID:     marketID,
			PayoutAmount: payout,
			PnL:          pnl,
		}

		if err := s.db.Create(&userPayout).Error; err != nil {
			log.Printf("Failed to create payout for user %d: %v", position.UserID, err)
			continue
		}

		// Update user balance
		if payout.GreaterThan(decimal.Zero) {
			if err := s.db.Model(&models.User{}).Where("id = ?", position.UserID).
				Update("virtual_balance", gorm.Expr("virtual_balance + ?", payout)).Error; err != nil {
				log.Printf("Failed to update balance for user %d: %v", position.UserID, err)
			}
		}

		log.Printf("Payout calculated for user %d: payout=%s, pnl=%s", position.UserID, payout.String(), pnl.String())
	}

	return nil
}

// GetUserMarketPnL calculates user's PnL for a specific market
func (s *MarketResolutionService) GetUserMarketPnL(userID uint, marketID uint) (decimal.Decimal, error) {
	var totalPnL decimal.Decimal

	// Get all positions for this user in this market
	var positions []models.UserPosition
	if err := s.db.Where("user_id = ? AND market_id = ?", userID, marketID).
		Find(&positions).Error; err != nil {
		return decimal.Zero, err
	}

	orderBookService := NewOrderBookService(s.db)

	// Get current order book prices for each position
	for _, position := range positions {
		orderBook, err := orderBookService.GetOrderBook(marketID, position.MarketEventID)
		if err != nil {
			continue
		}

		// Calculate unrealized PnL based on mid price
		currentValue := position.Quantity.Mul(orderBook.MidPrice)
		costBasis := position.Quantity.Mul(position.AveragePrice)
		positionPnL := currentValue.Sub(costBasis)

		totalPnL = totalPnL.Add(positionPnL)
	}

	return totalPnL, nil
}

// GetUserPortfolio returns user's portfolio for a specific market
func (s *MarketResolutionService) GetUserPortfolio(userID uint, marketID uint) ([]models.UserPosition, error) {
	var positions []models.UserPosition
	if err := s.db.Where("user_id = ? AND market_id = ?", userID, marketID).
		Find(&positions).Error; err != nil {
		return nil, err
	}

	orderBookService := NewOrderBookService(s.db)

	// Calculate unrealized PnL for each position
	for i, position := range positions {
		orderBook, err := orderBookService.GetOrderBook(marketID, position.MarketEventID)
		if err != nil {
			continue
		}

		currentValue := position.Quantity.Mul(orderBook.MidPrice)
		costBasis := position.Quantity.Mul(position.AveragePrice)
		positions[i].UnrealizedPnL = currentValue.Sub(costBasis)
	}

	return positions, nil
}
