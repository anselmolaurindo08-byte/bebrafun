package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
)

func main() {
	// Railway database URL
	dbURL := "postgresql://postgres:cqRUbikesgVWrWqakbOfUicvaexClAFK@interchange.proxy.rlwy.net:52098/railway"

	// Connect to database
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	fmt.Println("✅ Connected to Railway database")

	// Step 1: Delete duel transactions
	result, err := db.Exec(`
		DELETE FROM duel_transactions 
		WHERE duel_id IN (
			SELECT id FROM duels 
			WHERE status IN ('PENDING', 'MATCHED', 'ACTIVE')
		)
	`)
	if err != nil {
		log.Printf("⚠️  Warning deleting duel_transactions: %v", err)
	} else {
		rows, _ := result.RowsAffected()
		fmt.Printf("🗑️  Deleted %d duel transactions\n", rows)
	}

	// Step 2: Delete duel queue
	result, err = db.Exec(`
		DELETE FROM duel_queue 
		WHERE duel_id IN (
			SELECT id FROM duels 
			WHERE status IN ('PENDING', 'MATCHED', 'ACTIVE')
		)
	`)
	if err != nil {
		log.Printf("⚠️  Warning deleting duel_queue: %v", err)
	} else {
		rows, _ := result.RowsAffected()
		fmt.Printf("🗑️  Deleted %d queue entries\n", rows)
	}

	// Step 3: Delete transaction confirmations
	result, err = db.Exec(`
		DELETE FROM transaction_confirmations
		WHERE duel_id IN (
			SELECT id FROM duels 
			WHERE status IN ('PENDING', 'MATCHED', 'ACTIVE')
		)
	`)
	if err != nil {
		log.Printf("⚠️  Warning deleting transaction_confirmations: %v", err)
	} else {
		rows, _ := result.RowsAffected()
		fmt.Printf("🗑️  Deleted %d confirmations\n", rows)
	}

	// Step 4: Delete price candles
	result, err = db.Exec(`
		DELETE FROM duel_price_candles
		WHERE duel_id IN (
			SELECT id FROM duels 
			WHERE status IN ('PENDING', 'MATCHED', 'ACTIVE')
		)
	`)
	if err != nil {
		log.Printf("⚠️  Warning deleting duel_price_candles: %v", err)
	} else {
		rows, _ := result.RowsAffected()
		fmt.Printf("🗑️  Deleted %d price candles\n", rows)
	}

	// Step 5: Delete duels
	result, err = db.Exec(`
		DELETE FROM duels 
		WHERE status IN ('PENDING', 'MATCHED', 'ACTIVE')
	`)
	if err != nil {
		log.Fatal("❌ Failed to delete duels:", err)
	}
	rows, _ := result.RowsAffected()
	fmt.Printf("🗑️  Deleted %d active duels\n", rows)

	// Verify cleanup
	fmt.Println("\n📊 Verification:")
	var count int

	db.QueryRow("SELECT COUNT(*) FROM duels WHERE status = 'PENDING'").Scan(&count)
	fmt.Printf("   PENDING: %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM duels WHERE status = 'MATCHED'").Scan(&count)
	fmt.Printf("   MATCHED: %d\n", count)

	db.QueryRow("SELECT COUNT(*) FROM duels WHERE status = 'ACTIVE'").Scan(&count)
	fmt.Printf("   ACTIVE: %d\n", count)

	fmt.Println("\n✅ Database cleanup complete!")
}
