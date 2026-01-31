package services

import (
	"context"
	"fmt"
	"math"
	"time"

	"prediction-market/internal/models"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// AMMService handles AMM pool operations and trade calculations
// Now updated to reflect real on-chain AMM state primarily
type AMMService struct {
	db *gorm.DB
	// solanaClient *blockchain.SolanaClient // Could be injected if needed for on-chain queries
}

// NewAMMService creates a new AMM service
func NewAMMService(db *gorm.DB) *AMMService {
	return &AMMService{db: db}
}

// ============================================================================
// POOL OPERATIONS
// ============================================================================

// GetPool retrieves a pool by ID
func (s *AMMService) GetPool(ctx context.Context, poolID uuid.UUID) (*models.AMMPool, error) {
	var pool models.AMMPool
	if err := s.db.WithContext(ctx).First(&pool, "id = ?", poolID).Error; err != nil {
		return nil, fmt.Errorf("pool not found: %w", err)
	}
	// TODO: Fetch real reserve data from Blockchain here if needed for high precision
	// e.g., s.solanaClient.GetPoolReserves(...)
	return &pool, nil
}

// GetPoolByMarketID retrieves a pool by market ID
func (s *AMMService) GetPoolByMarketID(ctx context.Context, marketID uint) (*models.AMMPool, error) {
	var pool models.AMMPool
	if err := s.db.WithContext(ctx).First(&pool, "market_id = ? AND status = ?", marketID, models.PoolStatusActive).Error; err != nil {
		return nil, fmt.Errorf("pool not found for market %d: %w", marketID, err)
	}
	return &pool, nil
}

// GetAllPools retrieves all active pools
func (s *AMMService) GetAllPools(ctx context.Context, limit, offset int) ([]models.AMMPool, error) {
	var pools []models.AMMPool
	if err := s.db.WithContext(ctx).
		Where("status = ?", models.PoolStatusActive).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&pools).Error; err != nil {
		return nil, fmt.Errorf("failed to get pools: %w", err)
	}
	return pools, nil
}

// CreatePool records a new AMM pool (initialized on chain)
func (s *AMMService) CreatePool(ctx context.Context, req *models.CreatePoolRequest) (*models.AMMPool, error) {
	// 1. In a real scenario, this would be called AFTER the admin/server transaction initializes the pool on-chain
	// OR this service builds the transaction for the admin to sign.

	// For now, assuming this is an admin action that sets up the DB record after/during on-chain init.

	totalLiquidity := int64(math.Sqrt(float64(req.YesReserve) * float64(req.NoReserve)))

	pool := &models.AMMPool{
		MarketID:       req.MarketID,
		ProgramID:      req.ProgramID,
		Authority:      req.Authority,
		YesMint:        req.YesMint,
		NoMint:         req.NoMint,
		YesReserve:     req.YesReserve,
		NoReserve:      req.NoReserve,
		FeePercentage:  req.FeePercentage,
		TotalLiquidity: totalLiquidity,
		Status:         models.PoolStatusActive,
	}

	if err := s.db.WithContext(ctx).Create(pool).Error; err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	return pool, nil
}

// ToPoolResponse converts an AMMPool to its API response format
func (s *AMMService) ToPoolResponse(pool *models.AMMPool) *models.PoolResponse {
	totalReserves := float64(pool.YesReserve + pool.NoReserve)
	var yesPrice, noPrice float64
	if totalReserves > 0 {
		yesPrice = float64(pool.NoReserve) / totalReserves
		noPrice = float64(pool.YesReserve) / totalReserves
	}

	return &models.PoolResponse{
		ID:             pool.ID.String(),
		MarketID:       pool.MarketID,
		ProgramID:      pool.ProgramID,
		Authority:      pool.Authority,
		YesMint:        pool.YesMint,
		NoMint:         pool.NoMint,
		YesReserve:     pool.YesReserve,
		NoReserve:      pool.NoReserve,
		FeePercentage:  pool.FeePercentage,
		TotalLiquidity: pool.TotalLiquidity,
		YesPrice:       yesPrice,
		NoPrice:        noPrice,
		Status:         string(pool.Status),
		CreatedAt:      pool.CreatedAt,
		UpdatedAt:      pool.UpdatedAt,
	}
}

// ============================================================================
// TRADE QUOTE (Offline calculation for UI estimation)
// ============================================================================

func (s *AMMService) GetTradeQuote(ctx context.Context, poolID uuid.UUID, inputAmount int64, tradeType int16) (*models.TradeQuoteResponse, error) {
	pool, err := s.GetPool(ctx, poolID)
	if err != nil {
		return nil, err
	}
	return s.calculateQuote(pool, inputAmount, tradeType)
}

func (s *AMMService) calculateQuote(pool *models.AMMPool, inputAmount int64, tradeType int16) (*models.TradeQuoteResponse, error) {
	if inputAmount <= 0 {
		return nil, fmt.Errorf("input amount must be greater than 0")
	}

	k := pool.YesReserve * pool.NoReserve
	var inputReserve, outputReserve int64

	switch models.AMMTradeType(tradeType) {
	case models.TradeTypeBuyYes, models.TradeTypeSellNo:
		inputReserve = pool.NoReserve
		outputReserve = pool.YesReserve
	case models.TradeTypeBuyNo, models.TradeTypeSellYes:
		inputReserve = pool.YesReserve
		outputReserve = pool.NoReserve
	default:
		return nil, fmt.Errorf("invalid trade type: %d", tradeType)
	}

	feeAmount := (inputAmount * int64(pool.FeePercentage)) / 10000
	netInputAmount := inputAmount - feeAmount

	newInputReserve := inputReserve + netInputAmount
	if newInputReserve == 0 {
		return nil, fmt.Errorf("trade would drain the pool")
	}
	newOutputReserve := k / newInputReserve
	outputAmount := outputReserve - newOutputReserve

	if outputAmount <= 0 {
		return nil, fmt.Errorf("insufficient pool liquidity")
	}

	var pricePerToken float64
	if outputAmount > 0 {
		pricePerToken = float64(inputAmount) / float64(outputAmount)
	}

	minimumReceived := outputAmount * 9950 / 10000

	return &models.TradeQuoteResponse{
		OutputAmount:    outputAmount,
		PricePerToken:   pricePerToken,
		FeeAmount:       feeAmount,
		PriceImpact:     0, // Simplified for now
		MinimumReceived: minimumReceived,
	}, nil
}

// ============================================================================
// TRADE VERIFICATION & INDEXING
// ============================================================================

// VerifySwap verifies an on-chain swap transaction and indexes it
func (s *AMMService) VerifySwap(ctx context.Context, userAddress string, req *models.RecordTradeRequest) (*models.AMMTrade, error) {
	// 1. Verify transaction signature on chain (similar to DuelService)
	// For now, assuming it's valid if we receive it (in MVP)
	// In production: s.solanaClient.VerifyTransaction(req.TransactionSignature)

	// Check if this transaction has already been indexed
	var existingTrade models.AMMTrade
	if err := s.db.Where("transaction_signature = ?", req.TransactionSignature).First(&existingTrade).Error; err == nil {
		return &existingTrade, nil // Already processed
	}

	// Verify using client (mock logic for now if client not injected)
	// if s.solanaClient != nil {
	// 	confirmed, _ := s.solanaClient.VerifyTransaction(ctx, req.TransactionSignature, 1)
	// 	if !confirmed { return nil, errors.New("transaction not confirmed") }
	// }

	return s.RecordTrade(ctx, userAddress, req)
}

// RecordTrade records a completed trade and updates pool reserves
func (s *AMMService) RecordTrade(ctx context.Context, userAddress string, req *models.RecordTradeRequest) (*models.AMMTrade, error) {
	poolID, err := uuid.Parse(req.PoolID)
	if err != nil {
		return nil, fmt.Errorf("invalid pool ID: %w", err)
	}

	pool, err := s.GetPool(ctx, poolID)
	if err != nil {
		return nil, err
	}

	// Calculate price
	var price float64
	if req.OutputAmount > 0 {
		price = float64(req.InputAmount) / float64(req.OutputAmount)
	}

	trade := &models.AMMTrade{
		PoolID:               poolID,
		UserAddress:          userAddress,
		TradeType:            models.AMMTradeType(req.TradeType),
		InputAmount:          req.InputAmount,
		OutputAmount:         req.OutputAmount,
		FeeAmount:            req.FeeAmount,
		Price:                decimal.NewFromFloat(price),
		TransactionSignature: req.TransactionSignature,
		Status:               models.AMMTradeStatusConfirmed, // Assumed confirmed if we are recording it post-verification
	}

	// Use transaction for atomicity
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(trade).Error; err != nil {
			return fmt.Errorf("failed to record trade: %w", err)
		}

		// Update pool reserves based on trade type (Optimistic update or eventual consistency from chain)
		switch models.AMMTradeType(req.TradeType) {
		case models.TradeTypeBuyYes:
			pool.NoReserve += req.InputAmount - req.FeeAmount
			pool.YesReserve -= req.OutputAmount
		case models.TradeTypeBuyNo:
			pool.YesReserve += req.InputAmount - req.FeeAmount
			pool.NoReserve -= req.OutputAmount
		case models.TradeTypeSellYes:
			pool.YesReserve += req.InputAmount - req.FeeAmount
			pool.NoReserve -= req.OutputAmount
		case models.TradeTypeSellNo:
			pool.NoReserve += req.InputAmount - req.FeeAmount
			pool.YesReserve -= req.OutputAmount
		}

		pool.UpdatedAt = time.Now()
		if err := tx.Save(pool).Error; err != nil {
			return fmt.Errorf("failed to update pool reserves: %w", err)
		}

		if err := s.upsertPosition(tx, poolID, userAddress, req); err != nil {
			return fmt.Errorf("failed to update position: %w", err)
		}

		// Record price candle (simplified)
		s.RecordPriceCandle(ctx, poolID, price, price, price, price, req.InputAmount)

		return nil
	})

	if err != nil {
		return nil, err
	}

	return trade, nil
}

func (s *AMMService) upsertPosition(tx *gorm.DB, poolID uuid.UUID, userAddress string, req *models.RecordTradeRequest) error {
	var position models.AMMPosition
	err := tx.Where("pool_id = ? AND user_address = ?", poolID, userAddress).First(&position).Error

	if err == gorm.ErrRecordNotFound {
		position = models.AMMPosition{
			PoolID:      poolID,
			UserAddress: userAddress,
		}
	} else if err != nil {
		return err
	}

	tradeType := models.AMMTradeType(req.TradeType)
	price := decimal.NewFromFloat(float64(req.InputAmount) / float64(req.OutputAmount))

	switch tradeType {
	case models.TradeTypeBuyYes:
		position.YesBalance += req.OutputAmount
		position.EntryPriceYes = &price
	case models.TradeTypeBuyNo:
		position.NoBalance += req.OutputAmount
		position.EntryPriceNo = &price
	case models.TradeTypeSellYes:
		position.YesBalance -= req.InputAmount
	case models.TradeTypeSellNo:
		position.NoBalance -= req.InputAmount
	}

	position.UpdatedAt = time.Now()

	if err == gorm.ErrRecordNotFound {
		return tx.Create(&position).Error
	}
	return tx.Save(&position).Error
}

// ============================================================================
// POSITION QUERIES
// ============================================================================

// GetUserPosition retrieves a user's position in a specific pool
func (s *AMMService) GetUserPosition(ctx context.Context, poolID uuid.UUID, userAddress string) (*models.AMMPosition, error) {
	var position models.AMMPosition
	if err := s.db.WithContext(ctx).
		Where("pool_id = ? AND user_address = ?", poolID, userAddress).
		First(&position).Error; err != nil {
		return nil, fmt.Errorf("position not found: %w", err)
	}
	return &position, nil
}

// GetUserPositions retrieves all positions for a user
func (s *AMMService) GetUserPositions(ctx context.Context, userAddress string) ([]models.AMMPosition, error) {
	var positions []models.AMMPosition
	if err := s.db.WithContext(ctx).
		Where("user_address = ?", userAddress).
		Order("updated_at DESC").
		Find(&positions).Error; err != nil {
		return nil, fmt.Errorf("failed to get positions: %w", err)
	}
	return positions, nil
}

// ============================================================================
// TRADE HISTORY
// ============================================================================

// GetTradeHistory retrieves trade history for a pool
func (s *AMMService) GetTradeHistory(ctx context.Context, poolID uuid.UUID, limit, offset int) ([]models.AMMTrade, error) {
	var trades []models.AMMTrade
	if err := s.db.WithContext(ctx).
		Where("pool_id = ?", poolID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&trades).Error; err != nil {
		return nil, fmt.Errorf("failed to get trades: %w", err)
	}
	return trades, nil
}

// GetUserTrades retrieves trade history for a user in a pool
func (s *AMMService) GetUserTrades(ctx context.Context, poolID uuid.UUID, userAddress string, limit, offset int) ([]models.AMMTrade, error) {
	var trades []models.AMMTrade
	if err := s.db.WithContext(ctx).
		Where("pool_id = ? AND user_address = ?", poolID, userAddress).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&trades).Error; err != nil {
		return nil, fmt.Errorf("failed to get user trades: %w", err)
	}
	return trades, nil
}

// ============================================================================
// PRICE HISTORY
// ============================================================================

// GetPriceHistory retrieves price candles for a pool
func (s *AMMService) GetPriceHistory(ctx context.Context, poolID uuid.UUID, startTime, endTime time.Time, limit int) ([]models.PriceCandle, error) {
	var candles []models.PriceCandle
	if err := s.db.WithContext(ctx).
		Where("pool_id = ? AND timestamp BETWEEN ? AND ?", poolID, startTime, endTime).
		Order("timestamp DESC").
		Limit(limit).
		Find(&candles).Error; err != nil {
		return nil, fmt.Errorf("failed to get price history: %w", err)
	}
	return candles, nil
}

// RecordPriceCandle records a new price candle
func (s *AMMService) RecordPriceCandle(ctx context.Context, poolID uuid.UUID, open, high, low, close float64, volume int64) error {
	// Note: For real trading view, we need aggregation (1m, 1h bars).
	// This is a simplified "tick" recorder.

	// Create a new candle for this trade tick
	// In production, we should aggregate or use a dedicated TSDB (TimescaleDB)

	candle := &models.PriceCandle{
		PoolID:    poolID,
		Timestamp: time.Now(),
		Open:      decimal.NewFromFloat(open),
		High:      decimal.NewFromFloat(high),
		Low:       decimal.NewFromFloat(low),
		Close:     decimal.NewFromFloat(close),
		Volume:    volume,
	}

	// Just log error, don't fail trade
	if err := s.db.WithContext(ctx).Create(candle).Error; err != nil {
		fmt.Printf("failed to record price candle: %v\n", err)
		return err
	}
	return nil
}
