package services

import (
	"context"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"prediction-market/internal/models"
	"prediction-market/internal/polymarket"

	"gorm.io/gorm"
)

type MarketParserService struct {
	db               *gorm.DB
	polymarketClient *polymarket.PolymarketClient
}

const (
	TopMarketsLimit  = 10
	CategoryPolitics = "Politics"
	CategorySports   = "Sports"
	CategoryCrypto   = "Crypto"
)

var Categories = []string{CategoryPolitics, CategorySports, CategoryCrypto}

func NewMarketParserService(db *gorm.DB, apiKey, secret, passphrase string) *MarketParserService {
	return &MarketParserService{
		db:               db,
		polymarketClient: polymarket.NewPolymarketClient(apiKey, secret, passphrase),
	}
}

// ParseTopMarkets fetches and stores top markets from each category
func (s *MarketParserService) ParseTopMarkets(ctx context.Context) error {
	log.Println("Starting market parsing...")

	// Use goroutines to fetch markets from multiple categories concurrently
	errChan := make(chan error, len(Categories))
	var wg sync.WaitGroup

	for _, category := range Categories {
		wg.Add(1)
		go func(cat string) {
			defer wg.Done()
			if err := s.parseAndStoreCategory(ctx, cat); err != nil {
				errChan <- fmt.Errorf("error parsing %s: %w", cat, err)
			}
		}(category)
	}

	wg.Wait()
	close(errChan)

	// Collect errors
	var errors []error
	for err := range errChan {
		if err != nil {
			errors = append(errors, err)
			log.Printf("Parse error: %v", err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("parsing completed with errors: %v", errors)
	}

	log.Println("Market parsing completed successfully")
	return nil
}

// parseAndStoreCategory parses markets for a specific category
func (s *MarketParserService) parseAndStoreCategory(ctx context.Context, category string) error {
	log.Printf("Parsing category: %s", category)

	// Fetch markets from Polymarket
	markets, err := s.polymarketClient.GetMarketsByTag(category, 50)
	if err != nil {
		return fmt.Errorf("failed to fetch markets from Polymarket: %w", err)
	}

	if len(markets) == 0 {
		log.Printf("No markets found for category: %s", category)
		return nil
	}

	// Sort by volume and take top 10
	topMarkets := s.getTopMarketsByVolume(markets, TopMarketsLimit)

	// Store in database
	for _, pmMarket := range topMarkets {
		if err := s.storeMarket(pmMarket, category); err != nil {
			log.Printf("Failed to store market %s: %v", pmMarket.ID, err)
			continue
		}
	}

	log.Printf("Successfully stored %d markets for category %s", len(topMarkets), category)
	return nil
}

// storeMarket stores a Polymarket market in our database
func (s *MarketParserService) storeMarket(pmMarket polymarket.PolymarketMarket, category string) error {
	// Check if market already exists
	var existingMarket models.Market
	if err := s.db.Where("title = ? AND category = ?", pmMarket.Question, category).First(&existingMarket).Error; err == nil {
		// Market already exists, update it
		return s.db.Model(&existingMarket).Updates(map[string]interface{}{
			"description": pmMarket.Description,
			"status":      "active",
		}).Error
	}

	// Create new market
	market := models.Market{
		Title:       pmMarket.Question,
		Description: pmMarket.Description,
		Category:    category,
		Status:      "active",
		CreatedAt:   time.Now(),
	}

	if err := s.db.Create(&market).Error; err != nil {
		return fmt.Errorf("failed to create market: %w", err)
	}

	// Create market events (outcomes)
	outcomes := pmMarket.ParseOutcomes()
	if len(outcomes) > 0 {
		marketEvents := make([]models.MarketEvent, 0, len(outcomes))
		for _, outcome := range outcomes {
			marketEvents = append(marketEvents, models.MarketEvent{
				MarketID:         market.ID,
				EventTitle:       outcome,
				EventDescription: fmt.Sprintf("Outcome: %s", outcome),
				OutcomeType:      "binary",
			})
		}

		if err := s.db.Create(&marketEvents).Error; err != nil {
			log.Printf("Failed to create market events: %v", err)
		}
	}

	log.Printf("Stored market: %s (ID: %d)", market.Title, market.ID)
	return nil
}

// getTopMarketsByVolume sorts markets by volume and returns top N
func (s *MarketParserService) getTopMarketsByVolume(markets []polymarket.PolymarketMarket, limit int) []polymarket.PolymarketMarket {
	// Pre-calculate volume floats to avoid repeated parsing
	for i := range markets {
		markets[i].VolumeNum = markets[i].GetVolumeFloat()
	}

	// Sort by volume descending using O(n log n) sort
	sort.Slice(markets, func(i, j int) bool {
		return markets[i].VolumeNum > markets[j].VolumeNum
	})

	if len(markets) > limit {
		return markets[:limit]
	}
	return markets
}

// CheckAndUpdateMarkets checks if markets need updating
func (s *MarketParserService) CheckAndUpdateMarkets(ctx context.Context) error {
	log.Println("Checking and updating markets...")

	for _, category := range Categories {
		// Get current markets in this category
		var currentMarkets []models.Market
		if err := s.db.Where("category = ? AND status = ?", category, "active").Find(&currentMarkets).Error; err != nil {
			return err
		}

		// If less than 10 markets, fetch new ones
		if len(currentMarkets) < TopMarketsLimit {
			log.Printf("Category %s has only %d markets, fetching new ones...", category, len(currentMarkets))
			if err := s.parseAndStoreCategory(ctx, category); err != nil {
				log.Printf("Error updating category %s: %v", category, err)
			}
		}
	}

	return nil
}
