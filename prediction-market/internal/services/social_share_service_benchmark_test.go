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

func setupSocialBenchmarkDB(b *testing.B) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		b.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Market{},
		&models.SocialShare{},
	)
	if err != nil {
		b.Fatalf("failed to migrate database: %v", err)
	}

	// Manually add virtual_balance column since it seems missing from User struct but used in service
	if err := db.Exec("ALTER TABLE users ADD COLUMN virtual_balance DECIMAL(18,8) DEFAULT 0").Error; err != nil {
		b.Fatalf("failed to add virtual_balance column: %v", err)
	}

	// Ensure we use a single connection to keep the in-memory DB alive and consistent
	sqlDB, err := db.DB()
	if err != nil {
		b.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	return db
}

func BenchmarkShareWinOnTwitter(b *testing.B) {
	db := setupSocialBenchmarkDB(b)
	service := NewSocialShareService(db)

	// Seed users
	numUsers := 10
	users := make([]models.User, numUsers)
	for i := 0; i < numUsers; i++ {
		users[i] = models.User{
			WalletAddress: fmt.Sprintf("wallet_%d", i),
		}
	}
	db.CreateInBatches(users, numUsers)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			userID := uint((i % numUsers) + 1)
			marketID := uint(100 + i) // distinct markets or reusing them doesn't matter much for this lock
			pnl := decimal.NewFromFloat(100.0)
			shareURL := fmt.Sprintf("https://twitter.com/share/%d", i)

			_, err := service.ShareWinOnTwitter(userID, marketID, pnl, shareURL)
			if err != nil {
				b.Errorf("ShareWinOnTwitter failed: %v", err)
			}
			i++
		}
	})
}
