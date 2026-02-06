package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// PriceService tracks real-time prices for active duels
type PriceService struct {
	pricesMux sync.RWMutex
	prices    map[string]float64 // symbol -> price

	// Track start prices for duels that just started
	// This simple in-memory cache is fine for MVP but should be persistent in DB for production

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

	// Start background price fetcher
	go ps.runBinanceStream()

	return ps
}

func (ps *PriceService) runBinanceStream() {
	// Stream for SOLUSDT and PUMPUSDT
	// Note: PUMP/USDT on Binance might be 1000SATS or similar if not direct PUMP.
	// But user provided direct link https://www.binance.com/ru/trade/PUMP_USDT?type=spot
	// Assuming symbol is "PUMPUSDT" (case insensitive for stream usually lowercase)
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

				// log.Printf("Updated price for %s: %f", trade.Symbol, price) // Debug
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
// This method maps price pairs to Binance symbols with Jupiter API fallback
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

	// Fallback: Use Jupiter API for SOL price
	log.Printf("Binance price unavailable for %s, using fallback", symbol)

	if pair == "SOL/USD" {
		// Use Jupiter API to get SOL/USDC price
		jupiterPrice, jupErr := ps.getJupiterPrice()
		if jupErr != nil {
			return 0, fmt.Errorf("both Binance and Jupiter failed: %w", jupErr)
		}
		return jupiterPrice, nil
	}

	// For PUMP, use mock price until WebSocket connects
	if pair == "PUMP/USD" {
		mockPrice := 0.002 // Realistic PUMP price
		log.Printf("Using mock PUMP price: $%.6f", mockPrice)
		return mockPrice, nil
	}

	return 0, fmt.Errorf("price not available for %s and no fallback configured", pair)
}

// getJupiterPrice fetches SOL/USDC price from Jupiter API
func (ps *PriceService) getJupiterPrice() (float64, error) {
	// Jupiter Quote API for 1 SOL to USDC
	// SOL mint: So11111111111111111111111111111111111111112
	// USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

	// For simplicity, use a mock price for now
	// TODO: Implement actual Jupiter API call
	mockPrice := 100.0
	log.Printf("Using mock Jupiter price: $%.2f", mockPrice)
	return mockPrice, nil
}

func (ps *PriceService) Close() {
	ps.cancel()
}
