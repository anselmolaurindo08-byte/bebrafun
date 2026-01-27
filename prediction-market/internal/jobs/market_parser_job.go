package jobs

import (
	"context"
	"log"
	"time"

	"prediction-market/internal/services"

	"gorm.io/gorm"
)

type MarketParserJob struct {
	db      *gorm.DB
	service *services.MarketParserService
}

func NewMarketParserJob(db *gorm.DB, apiKey, secret, passphrase string) *MarketParserJob {
	return &MarketParserJob{
		db:      db,
		service: services.NewMarketParserService(db, apiKey, secret, passphrase),
	}
}

// Start begins the periodic market parsing job
func (j *MarketParserJob) Start(interval time.Duration) {
	go func() {
		// Run immediately on start
		ctx := context.Background()
		if err := j.service.ParseTopMarkets(ctx); err != nil {
			log.Printf("Initial parse error: %v", err)
		}

		// Then run periodically
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			if err := j.service.ParseTopMarkets(ctx); err != nil {
				log.Printf("Parse error: %v", err)
			}

			// Also check if markets need updating
			if err := j.service.CheckAndUpdateMarkets(ctx); err != nil {
				log.Printf("Update check error: %v", err)
			}
		}
	}()
}
