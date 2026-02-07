package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// PriceService tracks real-time prices for duels
// Uses CoinGecko API (not geo-blocked like Binance from Railway)
type PriceService struct {
	pricesMux sync.RWMutex
	prices    map[string]float64 // symbol -> price
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

// prefetchPrices loads initial prices from CoinGecko
func (ps *PriceService) prefetchPrices() {
	log.Printf("[PriceService] Pre-fetching prices from CoinGecko...")
	ps.fetchCoinGeckoPrices()
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

	if hasPrice && hasFetch && time.Since(lastFetch) < 5*time.Second {
		return price, nil
	}

	// Fetch fresh prices from CoinGecko
	log.Printf("[PriceService] Fetching fresh price for %s from CoinGecko...", pair)
	ps.fetchCoinGeckoPrices()

	// Read from cache again
	ps.pricesMux.RLock()
	price, hasPrice = ps.prices[cacheKey]
	ps.pricesMux.RUnlock()

	if !hasPrice || price == 0 {
		// Fallback: try CryptoCompare
		log.Printf("[PriceService] CoinGecko failed for %s, trying CryptoCompare...", pair)
		return ps.fetchCryptoComparePrice(pair)
	}

	return price, nil
}

// fetchCoinGeckoPrices fetches SOL and PUMP prices from CoinGecko
// CoinGecko is NOT geo-blocked from Railway (unlike Binance which returns 451)
// Example: GET https://api.coingecko.com/api/v3/simple/price?ids=solana,pump-fun&vs_currencies=usd
// Response: {"solana":{"usd":195.83},"pump-fun":{"usd":0.002003}}
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

	// Parse response: {"solana":{"usd":195.83},"pump-fun":{"usd":0.002003}}
	var result map[string]map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("[PriceService] ❌ CoinGecko parse error: %v", err)
		return
	}

	now := time.Now()
	ps.pricesMux.Lock()
	defer ps.pricesMux.Unlock()

	if solData, ok := result["solana"]; ok {
		if usdPrice, ok := solData["usd"]; ok {
			ps.prices["solana"] = usdPrice
			ps.lastFetch["solana"] = now
			log.Printf("[PriceService] ✅ SOL price: $%.2f (CoinGecko)", usdPrice)
		}
	}

	if pumpData, ok := result["pump-fun"]; ok {
		if usdPrice, ok := pumpData["usd"]; ok {
			ps.prices["pump-fun"] = usdPrice
			ps.lastFetch["pump-fun"] = now
			log.Printf("[PriceService] ✅ PUMP price: $%.6f (CoinGecko)", usdPrice)
		}
	}
}

// fetchCryptoComparePrice fetches price from CryptoCompare as fallback
// CryptoCompare is also globally available
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

	// Response: {"USD": 195.83}
	var result map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("CryptoCompare parse error: %w", err)
	}

	price, ok := result["USD"]
	if !ok || price == 0 {
		return 0, fmt.Errorf("CryptoCompare returned no USD price for %s", fsym)
	}

	log.Printf("[PriceService] ✅ %s price: $%.6f (CryptoCompare fallback)", fsym, price)

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

// GetCurrentPrice returns cached price for internal use (e.g., by symbol like "SOLUSDT")
func (ps *PriceService) GetCurrentPrice(symbol string) (float64, error) {
	// Map Binance-style symbols to our cache keys for backwards compat
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

// Ensure strconv is used (needed for potential future use)
var _ = strconv.ParseFloat

func (ps *PriceService) Close() {
	ps.cancel()
}
