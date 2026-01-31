package services

import (
	"fmt"
	"log"
	"testing"

	"prediction-market/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Discard,
	})
	if err != nil {
		panic("failed to connect database")
	}

	if err := db.AutoMigrate(&models.MarketEvent{}, &models.Market{}, &models.User{}); err != nil {
		panic("failed to migrate database")
	}
	return db
}

// BenchmarkInsertMarketEvents benchmarks the market event insertion
func BenchmarkInsertMarketEvents(b *testing.B) {
	db := setupTestDB()

	market := models.Market{
		Title:    "Test Market",
		Category: "Test",
	}
	if err := db.Create(&market).Error; err != nil {
		b.Fatalf("failed to create market: %v", err)
	}

	outcomes := []string{}
	for i := 0; i < 50; i++ {
		outcomes = append(outcomes, fmt.Sprintf("Outcome %d", i))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var events []models.MarketEvent
		for _, outcome := range outcomes {
			events = append(events, models.MarketEvent{
				MarketID:         market.ID,
				EventTitle:       outcome,
				EventDescription: fmt.Sprintf("Outcome: %s", outcome),
				OutcomeType:      "binary",
			})
		}

		if err := db.Create(&events).Error; err != nil {
			log.Printf("Failed to create market events: %v", err)
		}
	}
}

func TestBatchInsertCorrectness(t *testing.T) {
	db := setupTestDB()

	market := models.Market{
		Title:    "Test Market Correctness",
		Category: "Test",
	}
	db.Create(&market)

	outcomes := []string{"Yes", "No"}

	var events []models.MarketEvent
	for _, outcome := range outcomes {
		events = append(events, models.MarketEvent{
			MarketID:         market.ID,
			EventTitle:       outcome,
			EventDescription: fmt.Sprintf("Outcome: %s", outcome),
			OutcomeType:      "binary",
		})
	}

	if err := db.Create(&events).Error; err != nil {
		t.Fatalf("Failed to batch insert: %v", err)
	}

	var count int64
	db.Model(&models.MarketEvent{}).Where("market_id = ?", market.ID).Count(&count)
	if count != 2 {
		t.Errorf("Expected 2 events, got %d", count)
	}
}
