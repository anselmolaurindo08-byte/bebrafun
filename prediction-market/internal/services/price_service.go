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

	"github.com/gorilla/websocket"
)

// PriceService tracks real-time prices for active duels
type PriceService struct {
	pricesMux sync.RWMutex
	prices    map[string]float64 // symbol -> price

	ctx    context.Context
	cancel context.CancelFunc
}

func NewPriceService() *PriceService {
	ctx, cancel := context.WithCancel(context.Background())
	ps := &PriceService{
		prices: make(map[string]float64),
		ctx:    ctx,
		cancel: cancel,
	}

	// Start background price fetcher (WebSocket)
	go ps.runBinanceStream()

	return ps
}

func (ps *PriceService) runBinanceStream() {
	// Stream for SOLUSDT and PUMPUSDT
	url := "wss://stream.binance.com:9443/ws/solusdt@trade/pumpusdt@trade"

	for {
		select {
		case <-ps.ctx.Done():
			return
		default:
			c, _, err := websocket.DefaultDialer.Dial(url, nil)
			if err != nil {
				log.Printf("Error connecting to Binance WS: %v. Retrying in 5s...", err)
				time.Sleep(5 * time.Second)
				continue
			}

			log.Printf("Connected to Binance Price Stream")

			for {
				_, message, err := c.ReadMessage()
				if err != nil {
					log.Printf("Read error: %v", err)
					break
				}

				var trade struct {
					Symbol string `json:"s"`
					Price  string `json:"p"`
				}

				if err := json.Unmarshal(message, &trade); err != nil {
					continue
				}

				// Parse price
				var price float64

				if p, err := strconv.ParseFloat(trade.Price, 64); err == nil {
					price = p
				} else {
					log.Printf("Error parsing price for %s: %v", trade.Symbol, err)
					continue
				}

				ps.pricesMux.Lock()
				ps.prices[trade.Symbol] = price
				ps.pricesMux.Unlock()
			}
			c.Close()
		}
	}
}

// GetCurrentPrice returns the latest price for a symbol (e.g., "SOLUSDT")
func (ps *PriceService) GetCurrentPrice(symbol string) (float64, error) {
	ps.pricesMux.RLock()
	defer ps.pricesMux.RUnlock()

	price, ok := ps.prices[symbol]
	if !ok {
		return 0, fmt.Errorf("price not available for %s", symbol)
	}
	return price, nil
}

// GetPrice returns the latest price for a price pair (e.g., "SOL/USD", "PUMP/USD")
// This method maps price pairs to Binance symbols with REST API fallback
func (ps *PriceService) GetPrice(pair string) (float64, error) {
	var symbol string

	switch pair {
	case "SOL/USD":
		symbol = "SOLUSDT"
	case "PUMP/USD":
		symbol = "PUMPUSDT"
	default:
		return 0, fmt.Errorf("unsupported price pair: %s", pair)
	}

	// Try to get price from Binance WebSocket cache
	price, err := ps.GetCurrentPrice(symbol)
	if err == nil {
		return price, nil
	}

	// Fallback: Use Binance REST API
	log.Printf("Binance WS price unavailable for %s, using REST API fallback", symbol)
	restPrice, restErr := ps.getBinanceRESTPrice(symbol)
	if restErr != nil {
		return 0, fmt.Errorf("both Binance WS and REST API failed for %s: %w", symbol, restErr)
	}

	// Cache the REST price so subsequent calls within a few seconds are fast
	ps.pricesMux.Lock()
	ps.prices[symbol] = restPrice
	ps.pricesMux.Unlock()

	return restPrice, nil
}

// getBinanceRESTPrice fetches the current price from Binance REST API
// Example: GET https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT
// Returns: {"symbol":"SOLUSDT","price":"84.85000000"}
func (ps *PriceService) getBinanceRESTPrice(symbol string) (float64, error) {
	url := fmt.Sprintf("https://api.binance.com/api/v3/ticker/price?symbol=%s", symbol)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 0, fmt.Errorf("Binance REST API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("Binance REST API returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Symbol string `json:"symbol"`
		Price  string `json:"price"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to parse Binance REST response: %w", err)
	}

	price, err := strconv.ParseFloat(result.Price, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse price '%s': %w", result.Price, err)
	}

	log.Printf("✅ Binance REST API price for %s: $%.6f", symbol, price)
	return price, nil
}

func (ps *PriceService) Close() {
	ps.cancel()
}
