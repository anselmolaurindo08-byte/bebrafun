package services

import (
	"testing"

	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"prediction-market/internal/models"
)

func setupTestDB(t *testing.T) *gorm.DB {
	// Use a shared connection for memory DB to persist across calls if needed,
	// but here we just return a new handle to the same DB if we used a shared name.
	// :memory: is unique per connection unless using cache=shared.
	// But we keep `db` open in the test function.
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info), // Turn on logging to see SQL
	})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.ReferralCode{},
		&models.Referral{},
		&models.ReferralRebate{},
		&models.ReferralStats{},
	)
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

func TestIncrementReferralStats(t *testing.T) {
	db := setupTestDB(t)
	// Clean all tables
	db.Exec("DELETE FROM referral_stats")
	db.Exec("DELETE FROM referrals")
	db.Exec("DELETE FROM referral_rebates")
	db.Exec("DELETE FROM users")

	service := NewReferralService(db)
	userID := uint(1)

	// Create user
	user := models.User{ID: userID, WalletAddress: "test"}
	db.Create(&user)

	// Pre-create stats to test the Increment path (Optimization)
	initialStats := models.ReferralStats{
		UserID:          userID,
		TotalReferrals:  0,
		ActiveReferrals: 0,
		TotalRebatesEarned: decimal.NewFromInt(0),
		TotalRebatesPaid:   decimal.NewFromInt(0),
	}
	if err := db.Create(&initialStats).Error; err != nil {
		t.Fatalf("Failed to create initial stats: %v", err)
	}

	// 1. Test IncrementReferralCount (New Active)
	err := service.IncrementReferralCount(userID, true)
	if err != nil {
		t.Fatalf("IncrementReferralCount failed: %v", err)
	}

	var stats models.ReferralStats
	err = db.Where("user_id = ?", userID).First(&stats).Error
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}

	if stats.TotalReferrals != 1 {
		t.Errorf("expected total referrals 1, got %d", stats.TotalReferrals)
	}

	// 2. Test IncrementReferralCount (Existing)
	err = service.IncrementReferralCount(userID, true)
	if err != nil {
		t.Fatalf("IncrementReferralCount failed: %v", err)
	}

	stats = models.ReferralStats{} // Reset struct to avoid ID pollution
	err = db.Where("user_id = ?", userID).First(&stats).Error
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	if stats.TotalReferrals != 2 {
		t.Errorf("expected total referrals 2, got %d", stats.TotalReferrals)
	}

	// Test Fallback (Record missing)
	if err := db.Unscoped().Delete(&stats).Error; err != nil {
		t.Fatalf("Failed to delete stats: %v", err)
	}

	// We need a referral in DB for Recalculate to find it
	// Clear referrals first
	db.Exec("DELETE FROM referrals")
	db.Create(&models.Referral{ReferrerID: userID, ReferredUserID: 999, Status: "ACTIVE"})

	err = service.IncrementReferralCount(userID, true)
	if err != nil {
		t.Fatalf("IncrementReferralCount fallback failed: %v", err)
	}

	stats = models.ReferralStats{} // Reset struct
	err = db.Where("user_id = ?", userID).First(&stats).Error
	if err != nil {
		t.Fatalf("failed to get fallback stats: %v", err)
	}
	if stats.TotalReferrals != 1 {
		t.Errorf("fallback total referrals: expected 1, got %d", stats.TotalReferrals)
	}

	// 3. Test IncrementRebatesEarned
	// Current stats: Ref=1 (from fallback). Rebates=0.

	amount := decimal.NewFromFloat(10.5)
	err = service.IncrementRebatesEarned(userID, amount)
	if err != nil {
		t.Fatalf("IncrementRebatesEarned failed: %v", err)
	}

	stats = models.ReferralStats{}
	err = db.Where("user_id = ?", userID).First(&stats).Error
	if err != nil {
		t.Fatalf("failed to get stats after earned: %v", err)
	}
	if !stats.TotalRebatesEarned.Equal(amount) {
		t.Errorf("expected total rebates earned %s, got %s", amount, stats.TotalRebatesEarned)
	}

	// 4. Test IncrementRebatesPaid
	paidAmount := decimal.NewFromFloat(5.0)
	err = service.IncrementRebatesPaid(userID, paidAmount)
	if err != nil {
		t.Fatalf("IncrementRebatesPaid failed: %v", err)
	}

	stats = models.ReferralStats{}
	err = db.Where("user_id = ?", userID).First(&stats).Error
	if err != nil {
		t.Fatalf("failed to get stats after paid: %v", err)
	}
	if !stats.TotalRebatesPaid.Equal(paidAmount) {
		t.Errorf("expected total rebates paid %s, got %s", paidAmount, stats.TotalRebatesPaid)
	}

	// 5. Verify Recalculate overwrites correctly
	// Manually mess up the stats
	db.Model(&stats).Update("total_referrals", 999)

	// Prepare ground truth in DB
	db.Exec("DELETE FROM referrals")
	db.Exec("DELETE FROM referral_rebates")

	// Create 2 referrals
	db.Create(&models.Referral{ReferrerID: userID, ReferredUserID: 101, Status: "ACTIVE"})
	db.Create(&models.Referral{ReferrerID: userID, ReferredUserID: 102, Status: "ACTIVE"})

	// Create rebates: Earned=10.5 (5.0 Paid + 5.5 Pending)
	db.Create(&models.ReferralRebate{ReferrerID: userID, TradeID: 2, ReferredUserID: 101, RebateAmount: paidAmount, Status: "PAID"})
	remaining := amount.Sub(paidAmount)
	db.Create(&models.ReferralRebate{ReferrerID: userID, TradeID: 3, ReferredUserID: 101, RebateAmount: remaining, Status: "PENDING"})

	err = service.RecalculateReferralStats(userID)
	if err != nil {
		t.Fatalf("RecalculateReferralStats failed: %v", err)
	}

	stats = models.ReferralStats{}
	err = db.Where("user_id = ?", userID).First(&stats).Error
	if err != nil {
		t.Fatalf("failed to get recalculated stats: %v", err)
	}
	if stats.TotalReferrals != 2 {
		t.Errorf("recalculated total referrals: expected 2, got %d", stats.TotalReferrals)
	}
	if !stats.TotalRebatesPaid.Equal(paidAmount) {
		t.Errorf("recalculated paid: expected %s, got %s", paidAmount, stats.TotalRebatesPaid)
	}
	if !stats.TotalRebatesEarned.Equal(amount) {
		t.Errorf("recalculated earned: expected %s, got %s", amount, stats.TotalRebatesEarned)
	}
}
