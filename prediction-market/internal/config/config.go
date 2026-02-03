package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Database DatabaseConfig
	Server   ServerConfig
	App      AppConfig
	Solana   SolanaConfig
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
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

// SolanaConfig holds Solana network settings
type SolanaConfig struct {
	Network                string
	SolanaRPCURL           string
	ProgramID              string
	ServerWalletPrivateKey string
	ServerWalletPublicKey  string
	EscrowProgramID        string
	PlatformFeePercent     float64
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
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8080"),
		},
		App: AppConfig{
			JWTSecret:             getEnv("JWT_SECRET", ""),
			InitialVirtualBalance: getEnv("INITIAL_VIRTUAL_BALANCE", "1000.00"),
			InviteCodesPerUser:    getEnv("INVITE_CODES_PER_USER", "5"),
		},
		Solana: SolanaConfig{
			Network:                getEnv("SOLANA_NETWORK", "devnet"),
			SolanaRPCURL:           getEnv("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
			ProgramID:              getEnv("PROGRAM_ID", "46XLMDdrHBaV1YeX1nuUwtRM1KNMF1XKEp5DBVSrHcbY"),
			ServerWalletPrivateKey: getEnv("SERVER_WALLET_PRIVATE_KEY", ""),
			ServerWalletPublicKey:  getEnv("SERVER_WALLET_PUBLIC_KEY", ""),
			EscrowProgramID:        getEnv("ESCROW_PROGRAM_ID", "F1CFijTZ6QEWPEoSTZ9BfYc4bhD6ejK5oRZhK5YYH9SY"),
			PlatformFeePercent:     getEnvFloat("PLATFORM_FEE_PERCENT", 5.0),
		},
	}

	// Validate required fields
	if config.App.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return config, nil
}

// GetDSN returns the PostgreSQL connection string
// Supports DATABASE_URL (Railway format) or individual DB_ variables
func (c *Config) GetDSN() string {
	// Railway provides DATABASE_URL in postgresql:// format
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		return databaseURL
	}

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

// getEnvFloat gets a float environment variable with a fallback default value
func getEnvFloat(key string, defaultValue float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	if parsed, err := strconv.ParseFloat(value, 64); err == nil {
		return parsed
	}
	return defaultValue
}
