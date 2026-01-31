package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Build connection string
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	// Connect to database
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Read migration file
	migrationSQL, err := os.ReadFile("migrations/010_remove_twitter_oauth.sql")
	if err != nil {
		log.Fatalf("Failed to read migration file: %v", err)
	}

	// Execute migration
	log.Println("Executing migration...")
	_, err = db.Exec(string(migrationSQL))
	if err != nil {
		log.Fatalf("Failed to execute migration: %v", err)
	}

	log.Println("✅ Migration completed successfully!")

	// Optional: Drop Twitter columns completely
	fmt.Println("\n⚠️  Do you want to completely remove Twitter columns? (y/N): ")
	var response string
	fmt.Scanln(&response)

	if response == "y" || response == "Y" {
		log.Println("Dropping Twitter columns...")
		dropSQL := `
			ALTER TABLE users DROP COLUMN IF EXISTS x_username;
			ALTER TABLE users DROP COLUMN IF EXISTS x_id;
			ALTER TABLE users DROP COLUMN IF EXISTS x_avatar_url;
			ALTER TABLE users DROP COLUMN IF EXISTS followers_count;
		`
		_, err = db.Exec(dropSQL)
		if err != nil {
			log.Fatalf("Failed to drop Twitter columns: %v", err)
		}
		log.Println("✅ Twitter columns dropped successfully!")
	} else {
		log.Println("Skipping Twitter column removal (columns preserved as nullable)")
	}
}
