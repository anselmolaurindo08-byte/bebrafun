package services

import (
	"fmt"
	"math/rand"
	"testing"
	"time"

	"prediction-market/internal/models"
	"prediction-market/internal/polymarket"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func BenchmarkStoreMarket(b *testing.B) {
	// Setup in-memory DB with WAL for better concurrency simulation
	// Note: SQLite still has single-writer limitation, but reads can be concurrent
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared&_journal_mode=WAL"), &gorm.Config{
		Logger: logger.Discard,
	})
	if err != nil {
		b.Fatalf("failed to connect database: %v", err)
	}

	// Migrate schema
	err = db.AutoMigrate(&models.Market{}, &models.MarketEvent{}, &models.User{})
	if err != nil {
		b.Fatalf("failed to migrate database: %v", err)
	}

	service := NewMarketParserService(db, "key", "secret", "pass")

	b.ResetTimer()

	b.RunParallel(func(pb *testing.PB) {
		// Seed RNG per goroutine to avoid lock contention on global rand
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))

		// Use a local random source or just a counter to generate variance
		// For simplicity, we just use a counter.
		i := 0
		for pb.Next() {
			i++
			// Generate a somewhat unique ID to mix inserts and updates
			// We append a random number to reduce collisions to simulate 'New' markets
			r := rng.Intn(1000)
			marketID := fmt.Sprintf("market-%d-%d", r, i)

			pmMarket := polymarket.PolymarketMarket{
				ID:          marketID,
				Question:    fmt.Sprintf("Question %s", marketID),
				Description: "Description",
				Volume:      "1000",
			}

			// We use a fixed category.
			err := service.storeMarket(pmMarket, "Politics")
			if err != nil {
				b.Errorf("storeMarket failed: %v", err)
			}
		}
	})
}
