package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"prediction-market/internal/models"
)

// AuthService handles authentication business logic
type AuthService struct {
	db *gorm.DB
}

// NewAuthService creates a new AuthService
func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{db: db}
}

// ProcessWalletLogin finds or creates a user by wallet address
func (s *AuthService) ProcessWalletLogin(walletAddress string, inviteCode string) (*models.User, error) {
	var user models.User

	result := s.db.Where("wallet_address = ?", walletAddress).First(&user)

	if result.Error == gorm.ErrRecordNotFound {
		// New user — create account
		user = models.User{
			WalletAddress:  walletAddress,
		}

		// Handle referral if invite code provided
		if inviteCode != "" {
			var invite models.InviteCode
			if err := s.db.Where("code = ? AND used_by_user_id IS NULL", inviteCode).First(&invite).Error; err == nil {
				user.ReferrerID = &invite.UserID
			}
		}

		if err := s.db.Create(&user).Error; err != nil {
			return nil, fmt.Errorf("failed to create user: %w", err)
		}

		// Generate invite codes for new user
		if err := s.generateInviteCodes(user.ID, 5); err != nil {
			log.Printf("Warning: failed to generate invite codes for user %d: %v", user.ID, err)
		}

		// Create referral relationship if user was referred
		if user.ReferrerID != nil {
			if err := s.createReferral(*user.ReferrerID, user.ID); err != nil {
				log.Printf("Warning: failed to create referral for user %d: %v", user.ID, err)
			}

			if inviteCode != "" {
				now := time.Now()
				s.db.Model(&models.InviteCode{}).
					Where("code = ?", inviteCode).
					Updates(map[string]interface{}{
						"used_by_user_id": user.ID,
						"used_at":         now,
					})
			}
		}

		log.Printf("New user created: wallet=%s (ID: %d)", walletAddress, user.ID)
	} else if result.Error != nil {
		return nil, fmt.Errorf("database error: %w", result.Error)
	} else {
		log.Printf("User logged in: wallet=%s (ID: %d)", walletAddress, user.ID)
	}

	return &user, nil
}

// GetUserByID retrieves a user by their ID
func (s *AuthService) GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// generateInviteCodes generates invite codes for a user
func (s *AuthService) generateInviteCodes(userID uint, count int) error {
	for i := 0; i < count; i++ {
		code, err := generateRandomCode(8)
		if err != nil {
			return err
		}

		inviteCode := models.InviteCode{
			UserID: userID,
			Code:   code,
		}

		if err := s.db.Create(&inviteCode).Error; err != nil {
			return err
		}
	}

	return nil
}

// createReferral creates a referral relationship between users
func (s *AuthService) createReferral(referrerID, referredUserID uint) error {
	referral := models.Referral{
		ReferrerID:     referrerID,
		ReferredUserID: referredUserID,
		Status:         "ACTIVE",
	}

	return s.db.Create(&referral).Error
}

// generateRandomCode generates a random alphanumeric code
func generateRandomCode(length int) (string, error) {
	bytes := make([]byte, length/2)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
