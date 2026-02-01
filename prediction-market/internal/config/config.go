package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application
type Config struct {
	Database   DatabaseConfig
	Server     ServerConfig
	App        AppConfig
	Solana     SolanaConfig
	Polymarket PolymarketConfig
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

type ServerConfig struct {
	Port string
}

type AppConfig struct {
	JWTSecret            string
	InviteCodesPerUser   int
	FrontendURL          string
}

type SolanaConfig struct {
	Network               string
	RPCURL                string
	ServerWalletPrivateKey string
	ProgramID             string
}

type PolymarketConfig struct {
	APIKey     string
	Secret     string
	Passphrase string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		// Just log, don't fail as env vars might be set directly
		fmt.Println("No .env file found")
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			Name:     getEnv("DB_NAME", "prediction_market"),
		},
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
		},
		App: AppConfig{
			JWTSecret:          getEnv("JWT_SECRET", "secret"),
			InviteCodesPerUser: 5,
			FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		},
		Solana: SolanaConfig{
			Network:               getEnv("SOLANA_NETWORK", "devnet"),
			RPCURL:                getEnv("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
			ServerWalletPrivateKey: getEnv("SERVER_WALLET_PRIVATE_KEY", ""),
			ProgramID:             getEnv("SOLANA_PROGRAM_ID", "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"),
		},
		Polymarket: PolymarketConfig{
			APIKey:     getEnv("POLYMARKET_API_KEY", ""),
			Secret:     getEnv("POLYMARKET_SECRET", ""),
			Passphrase: getEnv("POLYMARKET_PASSPHRASE", ""),
		},
	}, nil
}

func (c *Config) GetDSN() string {
	// If DATABASE_URL is provided (e.g. Railway), use it directly
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		return dbURL
	}

	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		c.Database.Host, c.Database.User, c.Database.Password, c.Database.Name, c.Database.Port)
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
