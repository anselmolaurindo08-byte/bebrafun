package main

import (
	"fmt"
	"log"
	"os"

	"prediction-market/internal/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(cfg.GetDSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Read migration file
	sqlBytes, err := os.ReadFile("migrations/004_trading_system.sql")
	if err != nil {
		log.Fatalf("Failed to read migration file: %v", err)
	}

	// Execute migration
	log.Println("Applying migration: 004_trading_system.sql")
	if err := db.Exec(string(sqlBytes)).Error; err != nil {
		log.Fatalf("Failed to apply migration: %v", err)
	}

	log.Println("✅ Migration applied successfully!")
	fmt.Println("✅ Trading system tables created")
	fmt.Println("✅ Indexes created")
	fmt.Println("✅ Users table updated")
}
