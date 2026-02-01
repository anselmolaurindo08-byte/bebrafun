package database

import (
	"fmt"
	"log"

	"prediction-market/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Connect establishes a connection to the PostgreSQL database
func Connect(dsn string) error {
	var err error

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Error),
		DisableForeignKeyConstraintWhenMigrating: true,
	})

	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connection established successfully")
	return nil
}

// AutoMigrate runs automatic migrations for all models
func AutoMigrate() error {
	// Migrate core models first
	coreModels := []interface{}{
		&models.User{},
		&models.InviteCode{},
		&models.Market{},
		&models.MarketEvent{},
		&models.Transaction{},
		&models.UserProposal{},
	}

	for _, model := range coreModels {
		if err := DB.AutoMigrate(model); err != nil {
			log.Printf("Warning: migration issue for %T: %v", model, err)
		}
	}

	// Migrate referral models
	referralModels := []interface{}{
		&models.ReferralCode{},
		&models.Referral{},
		&models.ReferralRebate{},
		&models.SocialShare{},
		&models.ReferralStats{},
	}

	for _, model := range referralModels {
		if err := DB.AutoMigrate(model); err != nil {
			log.Printf("Warning: migration issue for %T: %v", model, err)
		}
	}

	// Migrate admin models
	adminModels := []interface{}{
		&models.AdminUser{},
		&models.Contest{},
		&models.ContestParticipant{},
		&models.ContestLeaderboardSnapshot{},
		&models.PlatformStats{},
		&models.AdminLog{},
		&models.UserRestriction{},
	}

	for _, model := range adminModels {
		if err := DB.AutoMigrate(model); err != nil {
			log.Printf("Warning: migration issue for %T: %v", model, err)
		}
	}

	// Migrate blockchain models
	blockchainModels := []interface{}{
		&models.WalletConnection{},
		&models.EscrowTransaction{},
		&models.DuelEscrowHold{},
		&models.TokenConfig{},
	}

	for _, model := range blockchainModels {
		if err := DB.AutoMigrate(model); err != nil {
			log.Printf("Warning: migration issue for %T: %v", model, err)
		}
	}

	// Migrate duel models
	duelModels := []interface{}{
		&models.Duel{},
		&models.DuelTransaction{},
		&models.DuelQueue{},
		&models.DuelStatistics{},
		&models.DuelResult{},
		&models.TransactionConfirmationRecord{},
		&models.DuelPriceCandle{},
	}

	for _, model := range duelModels {
		if err := DB.AutoMigrate(model); err != nil {
			log.Printf("Warning: migration issue for %T: %v", model, err)
		}
	}

	// Migrate AMM models
	ammModels := []interface{}{
		&models.AMMPool{},
		&models.PriceCandle{},
		&models.AMMPosition{},
		&models.AMMTrade{},
	}

	for _, model := range ammModels {
		if err := DB.AutoMigrate(model); err != nil {
			log.Printf("Warning: migration issue for %T: %v", model, err)
		}
	}

	log.Println("Database migrations completed successfully")
	return nil
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}
