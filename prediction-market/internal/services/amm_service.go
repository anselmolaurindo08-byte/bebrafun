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
type AMMService struct {
	db *gorm.DB
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

// CreatePool creates a new AMM pool
func (s *AMMService) CreatePool(ctx context.Context, req *models.CreatePoolRequest) (*models.AMMPool, error) {
	if req.YesReserve <= 0 || req.NoReserve <= 0 {
		return nil, fmt.Errorf("reserves must be greater than 0")
	}

	feePercentage := req.FeePercentage
	if feePercentage == 0 {
		feePercentage = 50 // default 0.5%
	}

	totalLiquidity := int64(math.Sqrt(float64(req.YesReserve) * float64(req.NoReserve)))

	pool := &models.AMMPool{
		MarketID:       req.MarketID,
		ProgramID:      req.ProgramID,
		Authority:      req.Authority,
		YesMint:        req.YesMint,
		NoMint:         req.NoMint,
		YesReserve:     req.YesReserve,
		NoReserve:      req.NoReserve,
		FeePercentage:  feePercentage,
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
		// Price = opposite reserve / total reserves
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
// TRADE QUOTE (constant product formula: x * y = k)
// ============================================================================

// GetTradeQuote calculates a trade quote without executing
func (s *AMMService) GetTradeQuote(ctx context.Context, poolID uuid.UUID, inputAmount int64, tradeType int16) (*models.TradeQuoteResponse, error) {
	pool, err := s.GetPool(ctx, poolID)
	if err != nil {
		return nil, err
	}

	if pool.Status != models.PoolStatusActive {
		return nil, fmt.Errorf("pool is not active")
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

	// Fee calculation (fee_percentage is in basis points, e.g., 50 = 0.5%)
	feeAmount := (inputAmount * int64(pool.FeePercentage)) / 10000
	netInputAmount := inputAmount - feeAmount

	// Constant product: (x + dx) * (y - dy) = k
	// dy = y - (k / (x + dx))
	newInputReserve := inputReserve + netInputAmount
	if newInputReserve == 0 {
		return nil, fmt.Errorf("trade would drain the pool")
	}
	newOutputReserve := k / newInputReserve
	outputAmount := outputReserve - newOutputReserve

	if outputAmount <= 0 {
		return nil, fmt.Errorf("insufficient pool liquidity")
	}

	// Price impact
	var priceImpact float64
	if inputReserve > 0 {
		spotPrice := float64(outputReserve) / float64(inputReserve)
		effectivePrice := float64(outputAmount) / float64(inputAmount)
		priceImpact = math.Abs(1-effectivePrice/spotPrice) * 100
	}

	// Price per token
	var pricePerToken float64
	if outputAmount > 0 {
		pricePerToken = float64(inputAmount) / float64(outputAmount)
	}

	// Minimum received (0.5% slippage default)
	minimumReceived := outputAmount * 9950 / 10000

	return &models.TradeQuoteResponse{
		OutputAmount:    outputAmount,
		PricePerToken:   pricePerToken,
		FeeAmount:       feeAmount,
		PriceImpact:     priceImpact,
		MinimumReceived: minimumReceived,
	}, nil
}

// ============================================================================
// TRADE RECORDING
// ============================================================================

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

	if pool.Status != models.PoolStatusActive {
		return nil, fmt.Errorf("pool is not active")
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
		Status:               models.AMMTradeStatusPending,
	}

	// Use transaction for atomicity
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Save trade
		if err := tx.Create(trade).Error; err != nil {
			return fmt.Errorf("failed to record trade: %w", err)
		}

		// Update pool reserves based on trade type
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

		// Upsert user position
		if err := s.upsertPosition(tx, poolID, userAddress, req); err != nil {
			return fmt.Errorf("failed to update position: %w", err)
		}

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
		// Create new position
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

// UpdateTradeConfirmations updates the confirmation count and status of a trade
func (s *AMMService) UpdateTradeConfirmations(ctx context.Context, txSignature string, confirmations int16, status models.AMMTradeStatus) error {
	result := s.db.WithContext(ctx).
		Model(&models.AMMTrade{}).
		Where("transaction_signature = ?", txSignature).
		Updates(map[string]interface{}{
			"confirmations": confirmations,
			"status":        status,
			"updated_at":    time.Now(),
		})

	if result.Error != nil {
		return fmt.Errorf("failed to update trade: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("trade not found: %s", txSignature)
	}
	return nil
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
	candle := &models.PriceCandle{
		PoolID:    poolID,
		Timestamp: time.Now(),
		Open:      decimal.NewFromFloat(open),
		High:      decimal.NewFromFloat(high),
		Low:       decimal.NewFromFloat(low),
		Close:     decimal.NewFromFloat(close),
		Volume:    volume,
	}

	if err := s.db.WithContext(ctx).Create(candle).Error; err != nil {
		return fmt.Errorf("failed to record price candle: %w", err)
	}
	return nil
}
