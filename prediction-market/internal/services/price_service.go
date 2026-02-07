package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sync"
	"time"
)

// Pyth price feed IDs (hex without 0x prefix)
const (
	PythSOLUSDFeedID  = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
	PythPUMPUSDFeedID = "7a01fc2c1ed29b88c70e4a30a66c48c6e17c3a93c3b9cb2f0e78c3e0d6c3b9c0" // PUMP/USD
	PythHermesBaseURL = "https://hermes.pyth.network"
)

// PriceService tracks real-time prices for duels
// Priority: Pyth Hermes (primary) → CoinGecko (fallback) → CryptoCompare (fallback)
type PriceService struct {
	pricesMux sync.RWMutex
	prices    map[string]float64 // cacheKey -> price
	lastFetch map[string]time.Time

	ctx    context.Context
	cancel context.CancelFunc
	client *http.Client
}

func NewPriceService() *PriceService {
	ctx, cancel := context.WithCancel(context.Background())
	ps := &PriceService{
		prices:    make(map[string]float64),
		lastFetch: make(map[string]time.Time),
		ctx:       ctx,
		cancel:    cancel,
		client:    &http.Client{Timeout: 10 * time.Second},
	}

	// Pre-fetch prices on startup
	go ps.prefetchPrices()

	return ps
}

// prefetchPrices loads initial prices from all providers
func (ps *PriceService) prefetchPrices() {
	log.Printf("[PriceService] Pre-fetching prices (Pyth → CoinGecko → CryptoCompare)...")
	ps.fetchPythPrices()
	ps.fetchCoinGeckoPrices() // Also warm CoinGecko cache
}

// GetPrice returns the latest price for a price pair (e.g., "SOL/USD", "PUMP/USD")
func (ps *PriceService) GetPrice(pair string) (float64, error) {
	var cacheKey string

	switch pair {
	case "SOL/USD":
		cacheKey = "solana"
	case "PUMP/USD":
		cacheKey = "pump-fun"
	default:
		return 0, fmt.Errorf("unsupported price pair: %s", pair)
	}

	// Check cache (valid for 5 seconds)
	ps.pricesMux.RLock()
	price, hasPrice := ps.prices[cacheKey]
	lastFetch, hasFetch := ps.lastFetch[cacheKey]
	ps.pricesMux.RUnlock()

	if hasPrice && hasFetch && time.Since(lastFetch) < 5*time.Second && price > 0 {
		return price, nil
	}

	// Try Pyth first (primary oracle)
	log.Printf("[PriceService] Fetching price for %s...", pair)
	ps.fetchPythPrices()

	// Check if Pyth succeeded
	ps.pricesMux.RLock()
	price, hasPrice = ps.prices[cacheKey]
	ps.pricesMux.RUnlock()

	if hasPrice && price > 0 {
		return price, nil
	}

	// Fallback: CoinGecko
	log.Printf("[PriceService] Pyth failed for %s, trying CoinGecko...", pair)
	ps.fetchCoinGeckoPrices()

	ps.pricesMux.RLock()
	price, hasPrice = ps.prices[cacheKey]
	ps.pricesMux.RUnlock()

	if hasPrice && price > 0 {
		return price, nil
	}

	// Fallback: CryptoCompare
	log.Printf("[PriceService] CoinGecko also failed, trying CryptoCompare...")
	return ps.fetchCryptoComparePrice(pair)
}

// ============================================================
// PYTH HERMES API (Primary - Oracle-grade pricing)
// ============================================================

// PythHermesResponse represents the Pyth Hermes v2 API response
type PythHermesResponse struct {
	Parsed []PythParsedPrice `json:"parsed"`
}

type PythParsedPrice struct {
	ID       string          `json:"id"`
	Price    PythPriceDetail `json:"price"`
	EMAPrice PythPriceDetail `json:"ema_price"`
}

type PythPriceDetail struct {
	Price       string `json:"price"`
	Conf        string `json:"conf"`
	Expo        int    `json:"expo"`
	PublishTime int64  `json:"publish_time"`
}

// fetchPythPrices fetches SOL/USD and PUMP/USD prices from Pyth Hermes REST API
// Pyth Hermes is globally available and provides oracle-grade pricing
func (ps *PriceService) fetchPythPrices() {
	url := fmt.Sprintf("%s/v2/updates/price/latest?ids[]=%s&ids[]=%s",
		PythHermesBaseURL, PythSOLUSDFeedID, PythPUMPUSDFeedID)

	resp, err := ps.client.Get(url)
	if err != nil {
		log.Printf("[PriceService] ❌ Pyth Hermes request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[PriceService] ❌ Pyth Hermes returned %d: %s", resp.StatusCode, string(body))
		return
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[PriceService] ❌ Pyth Hermes read error: %v", err)
		return
	}

	var result PythHermesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		log.Printf("[PriceService] ❌ Pyth Hermes parse error: %v (body: %s)", err, string(body[:min(len(body), 200)]))
		return
	}

	now := time.Now()
	ps.pricesMux.Lock()
	defer ps.pricesMux.Unlock()

	for _, parsed := range result.Parsed {
		var priceFloat float64
		var cacheKey string

		switch parsed.ID {
		case PythSOLUSDFeedID:
			cacheKey = "solana"
		case PythPUMPUSDFeedID:
			cacheKey = "pump-fun"
		default:
			continue
		}

		// Parse Pyth price: price * 10^expo
		var priceInt int64
		fmt.Sscanf(parsed.Price.Price, "%d", &priceInt)
		priceFloat = float64(priceInt) * math.Pow10(parsed.Price.Expo)

		if priceFloat > 0 {
			ps.prices[cacheKey] = priceFloat
			ps.lastFetch[cacheKey] = now
			log.Printf("[PriceService] ✅ %s price: $%.6f (Pyth Oracle)", cacheKey, priceFloat)
		}
	}
}

// ============================================================
// COINGECKO API (Fallback #1)
// ============================================================

// fetchCoinGeckoPrices fetches SOL and PUMP prices from CoinGecko
func (ps *PriceService) fetchCoinGeckoPrices() {
	url := "https://api.coingecko.com/api/v3/simple/price?ids=solana,pump-fun&vs_currencies=usd"

	resp, err := ps.client.Get(url)
	if err != nil {
		log.Printf("[PriceService] ❌ CoinGecko request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[PriceService] ❌ CoinGecko returned %d: %s", resp.StatusCode, string(body))
		return
	}

	var result map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[PriceService] ❌ CoinGecko parse error: %v", err)
		return
	}

	now := time.Now()
	ps.pricesMux.Lock()
	defer ps.pricesMux.Unlock()

	if solData, ok := result["solana"]; ok {
		if usdPrice, ok := solData["usd"]; ok && usdPrice > 0 {
			ps.prices["solana"] = usdPrice
			ps.lastFetch["solana"] = now
			log.Printf("[PriceService] ✅ SOL price: $%.2f (CoinGecko)", usdPrice)
		}
	}

	if pumpData, ok := result["pump-fun"]; ok {
		if usdPrice, ok := pumpData["usd"]; ok && usdPrice > 0 {
			ps.prices["pump-fun"] = usdPrice
			ps.lastFetch["pump-fun"] = now
			log.Printf("[PriceService] ✅ PUMP price: $%.6f (CoinGecko)", usdPrice)
		}
	}
}

// ============================================================
// CRYPTOCOMPARE API (Fallback #2)
// ============================================================

// fetchCryptoComparePrice fetches price from CryptoCompare as last resort
func (ps *PriceService) fetchCryptoComparePrice(pair string) (float64, error) {
	var fsym string
	switch pair {
	case "SOL/USD":
		fsym = "SOL"
	case "PUMP/USD":
		fsym = "PUMP"
	default:
		return 0, fmt.Errorf("unsupported pair for CryptoCompare: %s", pair)
	}

	url := fmt.Sprintf("https://min-api.cryptocompare.com/data/price?fsym=%s&tsyms=USD", fsym)

	resp, err := ps.client.Get(url)
	if err != nil {
		return 0, fmt.Errorf("CryptoCompare request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("CryptoCompare returned %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("CryptoCompare parse error: %w", err)
	}

	price, ok := result["USD"]
	if !ok || price == 0 {
		return 0, fmt.Errorf("CryptoCompare returned no USD price for %s", fsym)
	}

	log.Printf("[PriceService] ✅ %s price: $%.6f (CryptoCompare)", fsym, price)

	// Cache it
	var cacheKey string
	switch pair {
	case "SOL/USD":
		cacheKey = "solana"
	case "PUMP/USD":
		cacheKey = "pump-fun"
	}
	ps.pricesMux.Lock()
	ps.prices[cacheKey] = price
	ps.lastFetch[cacheKey] = time.Now()
	ps.pricesMux.Unlock()

	return price, nil
}

// GetCurrentPrice returns cached price for internal use (by symbol like "SOLUSDT")
func (ps *PriceService) GetCurrentPrice(symbol string) (float64, error) {
	var cacheKey string
	switch symbol {
	case "SOLUSDT":
		cacheKey = "solana"
	case "PUMPUSDT":
		cacheKey = "pump-fun"
	default:
		return 0, fmt.Errorf("unknown symbol: %s", symbol)
	}

	ps.pricesMux.RLock()
	defer ps.pricesMux.RUnlock()

	price, ok := ps.prices[cacheKey]
	if !ok || price == 0 {
		return 0, fmt.Errorf("price not available for %s", symbol)
	}
	return price, nil
}

func (ps *PriceService) Close() {
	ps.cancel()
}

// min helper for Go versions < 1.21
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
