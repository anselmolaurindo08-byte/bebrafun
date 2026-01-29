-- Migration: Add wallet_address to users table for dual authentication (Twitter + Wallet)
-- This allows users to connect their Solana wallet after Twitter OAuth

-- Add wallet_address column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(44) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address) WHERE wallet_address IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.wallet_address IS 'Solana wallet address for on-chain transactions (optional, for dual auth)';
