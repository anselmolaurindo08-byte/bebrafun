package services

import (
	"fmt"
	"log"

	"gorm.io/gorm"

	"prediction-market/internal/models"
)

// UserService handles user-related business logic
type UserService struct {
	db *gorm.DB
}

// NewUserService creates a new UserService
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return &user, nil
}

// GetUserInviteCodes retrieves all invite codes for a user
func (s *UserService) GetUserInviteCodes(userID uint) ([]models.InviteCode, error) {
	var inviteCodes []models.InviteCode
	if err := s.db.Where("user_id = ?", userID).Find(&inviteCodes).Error; err != nil {
		return nil, err
	}
	return inviteCodes, nil
}

// GetUserReferrals retrieves all referrals made by a user
func (s *UserService) GetUserReferrals(userID uint) ([]models.Referral, error) {
	var referrals []models.Referral
	if err := s.db.Where("referrer_id = ?", userID).Preload("ReferredUser").Find(&referrals).Error; err != nil {
		return nil, err
	}
	return referrals, nil
}

// UpdateNickname updates a user's nickname
func (s *UserService) UpdateNickname(userID uint, nickname string) error {
	// Check if nickname is already taken by another user
	var existingUser models.User
	if err := s.db.Where("nickname = ? AND id != ?", nickname, userID).First(&existingUser).Error; err == nil {
		return fmt.Errorf("nickname already taken")
	} else if err != gorm.ErrRecordNotFound {
		return err
	}

	// Update the user's nickname
	if err := s.db.Model(&models.User{}).Where("id = ?", userID).Update("nickname", nickname).Error; err != nil {
		return fmt.Errorf("failed to update nickname: %w", err)
	}

	return nil
}

// UserVolumeStats holds user trading volume statistics
type UserVolumeStats struct {
	DuelVolumeSol   float64 `json:"duel_volume_sol"`
	MarketVolumeSol float64 `json:"market_volume_sol"`
	TotalVolumeSol  float64 `json:"total_volume_sol"`
}

// GetUserVolume calculates total trading volume for a user across duels and AMM markets
func (s *UserService) GetUserVolume(userID uint, walletAddress string) (*UserVolumeStats, error) {
	const lamportsPerSol = 1_000_000_000.0

	// Calculate duel volume: sum of bet_amount where user is player1 or player2
	var duelVolumeLamports int64
	row := s.db.Table("duels").
		Select("COALESCE(SUM(bet_amount), 0)").
		Where("(player_1_id = ? OR player_2_id = ?) AND status IN (?, ?, ?, ?)",
			userID, userID, "COMPLETED", "RESOLVED", "STARTING", "ACTIVE").
		Row()
	if err := row.Scan(&duelVolumeLamports); err != nil {
		log.Printf("[GetUserVolume] Error scanning duel volume: %v", err)
		duelVolumeLamports = 0
	}

	// Calculate market volume: sum of input_amount for user's AMM trades
	var marketVolumeLamports int64
	row = s.db.Table("amm_trades").
		Select("COALESCE(SUM(input_amount), 0)").
		Where("user_address = ? AND status = ?", walletAddress, "CONFIRMED").
		Row()
	if err := row.Scan(&marketVolumeLamports); err != nil {
		log.Printf("[GetUserVolume] Error scanning market volume: %v", err)
		marketVolumeLamports = 0
	}

	duelSol := float64(duelVolumeLamports) / lamportsPerSol
	marketSol := float64(marketVolumeLamports) / lamportsPerSol

	return &UserVolumeStats{
		DuelVolumeSol:   duelSol,
		MarketVolumeSol: marketSol,
		TotalVolumeSol:  duelSol + marketSol,
	}, nil
}
