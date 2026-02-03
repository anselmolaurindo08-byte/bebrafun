package services

import (
	"context"
	"fmt"

	"prediction-market/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PositionService handles business logic for user positions
type PositionService struct {
	db *gorm.DB
}

// NewPositionService creates a new position service
func NewPositionService(db *gorm.DB) *PositionService {
	return &PositionService{db: db}
}

// CreatePosition creates a new user position
func (s *PositionService) CreatePosition(ctx context.Context, req *models.CreatePositionRequest) (*models.UserPosition, error) {
	poolID, err := uuid.Parse(req.PoolID)
	if err != nil {
		return nil, fmt.Errorf("invalid pool_id: %w", err)
	}

	position := &models.UserPosition{
		UserAddress: req.UserAddress,
		PoolID:      poolID,
		Outcome:     req.Outcome,
		Amount:      req.Amount,
		EntryPrice:  req.EntryPrice,
		SolInvested: req.SolInvested,
		Status:      "OPEN",
	}

	if err := s.db.WithContext(ctx).Create(position).Error; err != nil {
		return nil, fmt.Errorf("failed to create position: %w", err)
	}

	return position, nil
}

// GetUserPositions retrieves all positions for a user
func (s *PositionService) GetUserPositions(ctx context.Context, userAddress string, poolID *string) ([]models.UserPosition, error) {
	var positions []models.UserPosition
	query := s.db.WithContext(ctx).Where("user_address = ?", userAddress)

	if poolID != nil {
		query = query.Where("pool_id = ?", *poolID)
	}

	if err := query.Order("created_at DESC").Find(&positions).Error; err != nil {
		return nil, fmt.Errorf("failed to get user positions: %w", err)
	}

	return positions, nil
}

// GetPoolPositions retrieves all positions for a pool
func (s *PositionService) GetPoolPositions(ctx context.Context, poolID string) ([]models.UserPosition, error) {
	var positions []models.UserPosition

	if err := s.db.WithContext(ctx).
		Where("pool_id = ?", poolID).
		Order("created_at DESC").
		Find(&positions).Error; err != nil {
		return nil, fmt.Errorf("failed to get pool positions: %w", err)
	}

	return positions, nil
}

// GetPosition retrieves a single position by ID
func (s *PositionService) GetPosition(ctx context.Context, positionID string) (*models.UserPosition, error) {
	var position models.UserPosition

	if err := s.db.WithContext(ctx).
		Where("id = ?", positionID).
		First(&position).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("position not found")
		}
		return nil, fmt.Errorf("failed to get position: %w", err)
	}

	return &position, nil
}

// ClosePosition marks a position as closed
func (s *PositionService) ClosePosition(ctx context.Context, positionID string, exitPrice float64, solReceived int64) error {
	result := s.db.WithContext(ctx).
		Model(&models.UserPosition{}).
		Where("id = ? AND status = ?", positionID, "OPEN").
		Updates(map[string]interface{}{
			"status": "CLOSED",
		})

	if result.Error != nil {
		return fmt.Errorf("failed to close position: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("position not found or already closed")
	}

	return nil
}

// ToPositionResponse converts a UserPosition to PositionResponse
func (s *PositionService) ToPositionResponse(position *models.UserPosition) *models.PositionResponse {
	return &models.PositionResponse{
		ID:          position.ID.String(),
		UserAddress: position.UserAddress,
		PoolID:      position.PoolID.String(),
		Outcome:     position.Outcome,
		Amount:      position.Amount,
		EntryPrice:  position.EntryPrice,
		SolInvested: position.SolInvested,
		Status:      position.Status,
		CreatedAt:   position.CreatedAt,
		UpdatedAt:   position.UpdatedAt,
	}
}
