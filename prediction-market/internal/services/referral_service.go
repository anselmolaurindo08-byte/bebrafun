package services

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"prediction-market/internal/models"
)

type ReferralService struct {
	db *gorm.DB
	mu sync.Mutex
}

func NewReferralService(db *gorm.DB) *ReferralService {
	return &ReferralService{
		db: db,
	}
}

// RebateTier defines the rebate percentage based on follower count
type RebateTier struct {
	MinFollowers  int
	RebatePercent decimal.Decimal
}

// RebateTiers defines the rebate tiers based on X.com followers
var RebateTiers = []RebateTier{
	{100000, decimal.NewFromInt(50)},
	{50000, decimal.NewFromInt(40)},
	{25000, decimal.NewFromInt(30)},
	{10000, decimal.NewFromInt(25)},
	{5000, decimal.NewFromInt(20)},
	{1000, decimal.NewFromInt(15)},
	{0, decimal.Zero},
}

// GenerateReferralCode generates a unique referral code for a user
func (s *ReferralService) GenerateReferralCode(userID uint) (*models.ReferralCode, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Generate random code
	code, err := s.generateRandomCode()
	if err != nil {
		return nil, err
	}

	referralCode := models.ReferralCode{
		UserID:   userID,
		Code:     code,
		IsActive: true,
	}

	if err := s.db.Create(&referralCode).Error; err != nil {
		return nil, fmt.Errorf("failed to create referral code: %w", err)
	}

	log.Printf("Generated referral code %s for user %d", code, userID)
	return &referralCode, nil
}

// generateRandomCode generates a random 8-character code
func (s *ReferralService) generateRandomCode() (string, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b)[:8], nil
}

// GetUserReferralCode gets or creates a referral code for a user
func (s *ReferralService) GetUserReferralCode(userID uint) (*models.ReferralCode, error) {
	var code models.ReferralCode
	result := s.db.Where("user_id = ? AND is_active = ?", userID, true).First(&code)

	if result.Error == gorm.ErrRecordNotFound {
		return s.GenerateReferralCode(userID)
	}

	if result.Error != nil {
		return nil, result.Error
	}

	return &code, nil
}

// ValidateAndApplyReferralCode validates a referral code and creates referral relationship
func (s *ReferralService) ValidateAndApplyReferralCode(referredUserID uint, code string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find referral code
	var referralCode models.ReferralCode
	if err := s.db.Where("code = ? AND is_active = ?", code, true).First(&referralCode).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("invalid referral code")
		}
		return err
	}

	// Cannot refer yourself
	if referralCode.UserID == referredUserID {
		return fmt.Errorf("cannot use your own referral code")
	}

	// Check if already referred
	var existingReferral models.Referral
	if err := s.db.Where("referred_user_id = ?", referredUserID).First(&existingReferral).Error; err == nil {
		return fmt.Errorf("user already has a referrer")
	}

	// Create referral relationship
	referral := models.Referral{
		ReferrerID:     referralCode.UserID,
		ReferredUserID: referredUserID,
		ReferralCodeID: &referralCode.ID,
		Status:         "ACTIVE",
	}

	if err := s.db.Create(&referral).Error; err != nil {
		return fmt.Errorf("failed to create referral: %w", err)
	}

	// Update user's referrer
	if err := s.db.Model(&models.User{}).Where("id = ?", referredUserID).
		Update("referrer_id", referralCode.UserID).Error; err != nil {
		return err
	}

	// Update referral stats
	s.updateReferralStats(referralCode.UserID)

	log.Printf("Applied referral code %s: user %d referred by user %d", code, referredUserID, referralCode.UserID)
	return nil
}

// CalculateRebatePercentage calculates rebate percentage based on referrer's followers
func (s *ReferralService) CalculateRebatePercentage(referrerID uint) (decimal.Decimal, error) {
	var user models.User
	if err := s.db.Where("id = ?", referrerID).First(&user).Error; err != nil {
		return decimal.Zero, err
	}

	// Find appropriate tier
	for _, tier := range RebateTiers {
		if user.FollowersCount >= tier.MinFollowers {
			return tier.RebatePercent, nil
		}
	}

	return decimal.Zero, nil
}

// ProcessTradeRebate processes rebate for a trade
func (s *ReferralService) ProcessTradeRebate(tradeID uint, traderID uint, tradeAmount decimal.Decimal) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if trader has a referrer
	var trader models.User
	if err := s.db.Where("id = ?", traderID).First(&trader).Error; err != nil {
		return err
	}

	if trader.ReferrerID == nil {
		return nil // No referrer, no rebate
	}

	// Calculate rebate
	rebatePercent, err := s.CalculateRebatePercentage(*trader.ReferrerID)
	if err != nil {
		return err
	}

	if rebatePercent.IsZero() {
		return nil // No rebate for this tier
	}

	rebateAmount := tradeAmount.Mul(rebatePercent).Div(decimal.NewFromInt(100))

	// Create rebate record
	rebate := models.ReferralRebate{
		ReferrerID:       *trader.ReferrerID,
		ReferredUserID:   traderID,
		TradeID:          tradeID,
		RebatePercentage: rebatePercent,
		RebateAmount:     rebateAmount,
		Status:           "PENDING",
	}

	if err := s.db.Create(&rebate).Error; err != nil {
		return fmt.Errorf("failed to create rebate: %w", err)
	}

	// Immediately pay the rebate
	if err := s.PayRebate(rebate.ID); err != nil {
		log.Printf("Error paying rebate: %v", err)
	}

	log.Printf("Rebate created: %s for referrer %d from trade %d", rebateAmount, *trader.ReferrerID, tradeID)
	return nil
}

// PayRebate pays out a pending rebate
func (s *ReferralService) PayRebate(rebateID uint) error {
	var rebate models.ReferralRebate
	if err := s.db.Where("id = ?", rebateID).First(&rebate).Error; err != nil {
		return err
	}

	if rebate.Status != "PENDING" {
		return fmt.Errorf("rebate already paid or invalid status")
	}

	// Update referrer balance
	if err := s.db.Model(&models.User{}).Where("id = ?", rebate.ReferrerID).
		Update("virtual_balance", gorm.Expr("virtual_balance + ?", rebate.RebateAmount)).Error; err != nil {
		return err
	}

	// Update rebate status
	now := time.Now()
	if err := s.db.Model(&rebate).Updates(map[string]interface{}{
		"status":  "PAID",
		"paid_at": now,
	}).Error; err != nil {
		return err
	}

	// Update referral stats
	s.updateReferralStats(rebate.ReferrerID)

	log.Printf("Rebate paid: %s to user %d", rebate.RebateAmount, rebate.ReferrerID)
	return nil
}

// GetReferralStats returns referral statistics for a user
func (s *ReferralService) GetReferralStats(userID uint) (*models.ReferralStats, error) {
	var stats models.ReferralStats
	result := s.db.Where("user_id = ?", userID).First(&stats)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new stats
		stats = models.ReferralStats{
			UserID:             userID,
			TotalRebatesEarned: decimal.Zero,
			TotalRebatesPaid:   decimal.Zero,
		}
		if err := s.db.Create(&stats).Error; err != nil {
			return nil, err
		}
		return &stats, nil
	}

	if result.Error != nil {
		return nil, result.Error
	}

	return &stats, nil
}

// updateReferralStats updates referral statistics for a user
func (s *ReferralService) updateReferralStats(userID uint) error {
	// Count total referrals
	var totalReferrals int64
	if err := s.db.Model(&models.Referral{}).Where("referrer_id = ?", userID).
		Count(&totalReferrals).Error; err != nil {
		return err
	}

	// Count active referrals
	var activeReferrals int64
	if err := s.db.Model(&models.Referral{}).Where("referrer_id = ? AND status = ?", userID, "ACTIVE").
		Count(&activeReferrals).Error; err != nil {
		return err
	}

	// Sum total rebates earned
	var totalRebatesEarned decimal.Decimal
	row := s.db.Model(&models.ReferralRebate{}).Where("referrer_id = ?", userID).
		Select("COALESCE(SUM(rebate_amount), 0)").Row()
	if err := row.Scan(&totalRebatesEarned); err != nil {
		totalRebatesEarned = decimal.Zero
	}

	// Sum total rebates paid
	var totalRebatesPaid decimal.Decimal
	row = s.db.Model(&models.ReferralRebate{}).Where("referrer_id = ? AND status = ?", userID, "PAID").
		Select("COALESCE(SUM(rebate_amount), 0)").Row()
	if err := row.Scan(&totalRebatesPaid); err != nil {
		totalRebatesPaid = decimal.Zero
	}

	// Update or create stats
	var stats models.ReferralStats
	result := s.db.Where("user_id = ?", userID).First(&stats)

	if result.Error == gorm.ErrRecordNotFound {
		stats = models.ReferralStats{
			UserID:             userID,
			TotalReferrals:     int(totalReferrals),
			ActiveReferrals:    int(activeReferrals),
			TotalRebatesEarned: totalRebatesEarned,
			TotalRebatesPaid:   totalRebatesPaid,
		}
		return s.db.Create(&stats).Error
	}

	return s.db.Model(&stats).Updates(map[string]interface{}{
		"total_referrals":      totalReferrals,
		"active_referrals":     activeReferrals,
		"total_rebates_earned": totalRebatesEarned,
		"total_rebates_paid":   totalRebatesPaid,
		"updated_at":           time.Now(),
	}).Error
}

// GetUserReferrals returns all referrals for a user
func (s *ReferralService) GetUserReferrals(userID uint) ([]models.Referral, error) {
	var referrals []models.Referral
	if err := s.db.Where("referrer_id = ?", userID).Preload("ReferredUser").Find(&referrals).Error; err != nil {
		return nil, err
	}
	return referrals, nil
}

// GetReferralRebates returns all rebates for a user
func (s *ReferralService) GetReferralRebates(userID uint) ([]models.ReferralRebate, error) {
	var rebates []models.ReferralRebate
	if err := s.db.Where("referrer_id = ?", userID).Order("created_at DESC").Find(&rebates).Error; err != nil {
		return nil, err
	}
	return rebates, nil
}
