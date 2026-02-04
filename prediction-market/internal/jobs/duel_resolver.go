package jobs

import (
	"context"
	"log"
	"time"

	"prediction-market/internal/models"
	"prediction-market/internal/services"
)

// DuelResolver automatically resolves expired duels
type DuelResolver struct {
	duelService *services.DuelService
	interval    time.Duration
	stopChan    chan struct{}
}

// NewDuelResolver creates a new duel resolver job
func NewDuelResolver(duelService *services.DuelService, interval time.Duration) *DuelResolver {
	return &DuelResolver{
		duelService: duelService,
		interval:    interval,
		stopChan:    make(chan struct{}),
	}
}

// Start begins the duel resolution loop
func (dr *DuelResolver) Start() {
	log.Printf("[DuelResolver] Starting duel resolution job (interval: %v)", dr.interval)

	ticker := time.NewTicker(dr.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			dr.resolveExpiredDuels()
		case <-dr.stopChan:
			log.Println("[DuelResolver] Stopping duel resolution job")
			return
		}
	}
}

// Stop stops the duel resolution loop
func (dr *DuelResolver) Stop() {
	close(dr.stopChan)
}

// resolveExpiredDuels finds and resolves all expired duels
func (dr *DuelResolver) resolveExpiredDuels() {
	ctx := context.Background()

	// Get all active duels
	duels, err := dr.duelService.GetActiveDuels(ctx, 100)
	if err != nil {
		log.Printf("[DuelResolver] Error fetching active duels: %v", err)
		return
	}

	if len(duels) == 0 {
		return
	}

	log.Printf("[DuelResolver] Checking %d active duels", len(duels))

	now := time.Now()
	resolvedCount := 0

	for _, duel := range duels {
		// Check if duel has expired (started_at + 1 minute)
		if duel.StartedAt == nil {
			continue
		}

		expiryTime := duel.StartedAt.Add(1 * time.Minute)
		if now.Before(expiryTime) {
			continue // Not expired yet
		}

		log.Printf("[DuelResolver] Resolving expired duel: %s (started: %v)", duel.ID, duel.StartedAt)

		// Get exit price from determineWinner (uses mock price for now)
		_, exitPrice, err := dr.determineWinner(ctx, duel)
		if err != nil {
			log.Printf("[DuelResolver] Error determining exit price for duel %s: %v", duel.ID, err)
			continue
		}

		// Use AutoResolveDuel which doesn't require on-chain call
		_, err = dr.duelService.AutoResolveDuel(ctx, duel.ID, exitPrice)
		if err != nil {
			log.Printf("[DuelResolver] Error resolving duel %s: %v", duel.ID, err)
			continue
		}

		resolvedCount++
		log.Printf("[DuelResolver] Successfully resolved duel %s", duel.ID)
	}

	if resolvedCount > 0 {
		log.Printf("[DuelResolver] Resolved %d duels", resolvedCount)
	}
}

// determineWinner determines the winner based on price movement
func (dr *DuelResolver) determineWinner(ctx context.Context, duel *models.Duel) (uint, float64, error) {
	// TODO: Get actual price data from oracle/price service
	// For now, use a simple mock - in production, fetch real SOL/USDC price

	// Mock price data
	entryPrice := 100.0 // Price when duel started
	exitPrice := 101.0  // Price when duel ended (1 minute later)

	// Determine winner based on prediction
	// Player 1 prediction is stored in duel.PredictedOutcome
	// Player 2 has opposite prediction

	priceWentUp := exitPrice > entryPrice

	var winnerID uint

	// Check if PredictedOutcome is nil
	if duel.PredictedOutcome == nil {
		winnerID = duel.Player1ID
		return winnerID, exitPrice, nil
	}

	// Dereference pointer
	prediction := *duel.PredictedOutcome

	if prediction == "UP" {
		if priceWentUp {
			winnerID = duel.Player1ID
		} else {
			if duel.Player2ID != nil {
				winnerID = *duel.Player2ID
			} else {
				winnerID = duel.Player1ID
			}
		}
	} else { // DOWN
		if priceWentUp {
			if duel.Player2ID != nil {
				winnerID = *duel.Player2ID
			} else {
				winnerID = duel.Player1ID
			}
		} else {
			winnerID = duel.Player1ID
		}
	}

	return winnerID, exitPrice, nil
}
