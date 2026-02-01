package services

import (
	"fmt"

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
