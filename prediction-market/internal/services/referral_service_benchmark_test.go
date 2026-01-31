package services

import (
	"fmt"
	"testing"

	"github.com/shopspring/decimal"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"prediction-market/internal/models"
)

func setupBenchmarkDB(b *testing.B) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		b.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.ReferralCode{},
		&models.Referral{},
		&models.ReferralRebate{},
		&models.ReferralStats{},
	)
	if err != nil {
		b.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

func seedData(db *gorm.DB, userID uint, referralCount int) {
	// Create user
	user := models.User{
		ID:            userID,
		WalletAddress: "test_wallet",
	}
	db.Create(&user)

	// Create referrals
	referrals := make([]models.Referral, referralCount)
	for i := 0; i < referralCount; i++ {
		referrals[i] = models.Referral{
			ReferrerID:     userID,
			ReferredUserID: uint(1000 + i), // Arbitrary IDs
			Status:         "ACTIVE",
		}
	}
	db.CreateInBatches(referrals, 100)

	// Create rebates (let's say 1 rebate per referral)
	rebates := make([]models.ReferralRebate, referralCount)
	for i := 0; i < referralCount; i++ {
		rebates[i] = models.ReferralRebate{
			ReferrerID:       userID,
			ReferredUserID:   uint(1000 + i),
			TradeID:          uint(i),
			RebateAmount:     decimal.NewFromFloat(1.5),
			RebatePercentage: decimal.NewFromInt(10),
			Status:           "PAID",
		}
	}
	db.CreateInBatches(rebates, 100)
}

// BenchmarkRecalculateReferralStats measures the performance of the aggregation logic (formerly updateReferralStats)
func BenchmarkRecalculateReferralStats(b *testing.B) {
	counts := []int{10, 100, 1000}

	for _, count := range counts {
		b.Run(fmt.Sprintf("Count-%d", count), func(b *testing.B) {
			db := setupBenchmarkDB(b)
			service := NewReferralService(db)
			userID := uint(1)

			seedData(db, userID, count)

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				err := service.RecalculateReferralStats(userID)
				if err != nil {
					b.Fatalf("RecalculateReferralStats failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkIncrementReferralCount measures the performance of the new atomic increment logic
func BenchmarkIncrementReferralCount(b *testing.B) {
	counts := []int{10, 100, 1000}

	for _, count := range counts {
		b.Run(fmt.Sprintf("Count-%d", count), func(b *testing.B) {
			db := setupBenchmarkDB(b)
			service := NewReferralService(db)
			userID := uint(1)

			seedData(db, userID, count)
			// Ensure stats exist first so we hit the happy path (Increment) instead of fallback (Recalculate)
			service.RecalculateReferralStats(userID)

			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				err := service.IncrementReferralCount(userID, true)
				if err != nil {
					b.Fatalf("IncrementReferralCount failed: %v", err)
				}
			}
		})
	}
}
