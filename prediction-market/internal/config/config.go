package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Database   DatabaseConfig
	Twitter    TwitterConfig
	Server     ServerConfig
	App        AppConfig
	Polymarket PolymarketConfig
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
}

// TwitterConfig holds Twitter/X.com OAuth settings
type TwitterConfig struct {
	ConsumerKey    string
	ConsumerSecret string
	CallbackURL    string
}

// ServerConfig holds server settings
type ServerConfig struct {
	Port string
}

// AppConfig holds application-specific settings
type AppConfig struct {
	JWTSecret             string
	InitialVirtualBalance string
	InviteCodesPerUser    string
}

// PolymarketConfig holds Polymarket API settings
type PolymarketConfig struct {
	APIKey     string
	Secret     string
	Passphrase string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Try to load .env file (ignore error if it doesn't exist)
	_ = godotenv.Load()

	config := &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", ""),
			DBName:   getEnv("DB_NAME", "prediction_market"),
		},
		Twitter: TwitterConfig{
			ConsumerKey:    getEnv("TWITTER_CONSUMER_KEY", ""),
			ConsumerSecret: getEnv("TWITTER_CONSUMER_SECRET", ""),
			CallbackURL:    getEnv("TWITTER_CALLBACK_URL", "http://localhost:8080/auth/callback"),
		},
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
		},
		App: AppConfig{
			JWTSecret:             getEnv("JWT_SECRET", ""),
			InitialVirtualBalance: getEnv("INITIAL_VIRTUAL_BALANCE", "1000.00"),
			InviteCodesPerUser:    getEnv("INVITE_CODES_PER_USER", "5"),
		},
		Polymarket: PolymarketConfig{
			APIKey:     getEnv("POLYMARKET_API_KEY", ""),
			Secret:     getEnv("POLYMARKET_SECRET", ""),
			Passphrase: getEnv("POLYMARKET_PASSPHRASE", ""),
		},
	}

	// Validate required fields
	if config.App.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	if config.Twitter.ConsumerKey == "" || config.Twitter.ConsumerSecret == "" {
		return nil, fmt.Errorf("Twitter OAuth credentials are required")
	}

	return config, nil
}

// GetDSN returns the PostgreSQL connection string
func (c *Config) GetDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.DBName,
	)
}

// getEnv gets an environment variable with a fallback default value
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
