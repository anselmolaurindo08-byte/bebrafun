package services

import (
	"fmt"
	"log"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"prediction-market/internal/models"
)

type SocialShareService struct {
	db *gorm.DB
}

func NewSocialShareService(db *gorm.DB) *SocialShareService {
	return &SocialShareService{
		db: db,
	}
}

// ShareWinOnTwitter creates a social share record and applies bonus
func (s *SocialShareService) ShareWinOnTwitter(userID uint, marketID uint, pnlAmount decimal.Decimal, shareURL string) (*models.SocialShare, error) {
	// Only apply bonus if PnL is positive
	var bonusAmount decimal.Decimal
	if pnlAmount.GreaterThan(decimal.Zero) {
		// 5% bonus on positive PnL
		bonusAmount = pnlAmount.Mul(decimal.NewFromFloat(0.05))
	} else {
		bonusAmount = decimal.Zero
	}

	socialShare := models.SocialShare{
		UserID:      userID,
		MarketID:    marketID,
		ShareType:   "TWITTER",
		PnLAmount:   pnlAmount,
		BonusAmount: bonusAmount,
		ShareURL:    shareURL,
		Verified:    false,
	}

	if err := s.db.Create(&socialShare).Error; err != nil {
		return nil, fmt.Errorf("failed to create social share: %w", err)
	}

	// Apply bonus immediately if positive
	if bonusAmount.GreaterThan(decimal.Zero) {
		if err := s.db.Model(&models.User{}).Where("id = ?", userID).
			Update("virtual_balance", gorm.Expr("virtual_balance + ?", bonusAmount)).Error; err != nil {
			log.Printf("Error applying bonus: %v", err)
		} else {
			log.Printf("Social share bonus applied: %s to user %d", bonusAmount, userID)
		}
	}

	log.Printf("Social share created for user %d: bonus=%s", userID, bonusAmount)
	return &socialShare, nil
}

// VerifyTwitterShare verifies a Twitter share
func (s *SocialShareService) VerifyTwitterShare(shareID uint) error {
	var share models.SocialShare
	if err := s.db.Where("id = ?", shareID).First(&share).Error; err != nil {
		return err
	}

	// In production, verify the tweet actually exists on Twitter
	// For now, just mark as verified
	return s.db.Model(&share).Update("verified", true).Error
}

// GetUserSocialShares returns all social shares for a user
func (s *SocialShareService) GetUserSocialShares(userID uint) ([]models.SocialShare, error) {
	var shares []models.SocialShare
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&shares).Error; err != nil {
		return nil, err
	}
	return shares, nil
}

// GetTotalSocialBonus calculates total bonus earned from social shares
func (s *SocialShareService) GetTotalSocialBonus(userID uint) (decimal.Decimal, error) {
	var totalBonus decimal.Decimal
	row := s.db.Model(&models.SocialShare{}).Where("user_id = ?", userID).
		Select("COALESCE(SUM(bonus_amount), 0)").Row()
	if err := row.Scan(&totalBonus); err != nil {
		return decimal.Zero, err
	}
	return totalBonus, nil
}
