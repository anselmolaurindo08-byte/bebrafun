-- Migration: Create blockchain and wallet tables
-- This migration adds tables for wallet connections, escrow, and blockchain interactions

-- Drop old tables if they exist (incompatible schema)
DROP TABLE IF EXISTS duel_escrow_holds CASCADE;
DROP TABLE IF EXISTS escrow_transactions CASCADE;
DROP TABLE IF EXISTS duels CASCADE;

-- Wallet connections table
CREATE TABLE IF NOT EXISTS wallet_connections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL UNIQUE,
    blockchain VARCHAR(20) NOT NULL DEFAULT 'SOLANA',
    token_balance DECIMAL(18, 8) NOT NULL DEFAULT 0,
    token_symbol VARCHAR(10) NOT NULL DEFAULT 'PREDICT',
    is_verified BOOLEAN DEFAULT FALSE,
    connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_balance_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Token configuration table
CREATE TABLE IF NOT EXISTS token_configs (
    id SERIAL PRIMARY KEY,
    token_symbol VARCHAR(10) NOT NULL UNIQUE,
    token_mint_address VARCHAR(44) NOT NULL,
    escrow_contract_address VARCHAR(44),
    decimals INTEGER NOT NULL DEFAULT 9,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Duels table
CREATE TABLE duels (
    id SERIAL PRIMARY KEY,
    player_1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    player_2_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    player_1_amount DECIMAL(18, 8) NOT NULL,
    player_2_amount DECIMAL(18, 8),
    market_id INTEGER,
    event_id INTEGER,
    predicted_outcome VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    winner_amount DECIMAL(18, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Escrow transactions table
CREATE TABLE escrow_transactions (
    id SERIAL PRIMARY KEY,
    duel_id INTEGER NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'PAYOUT', 'TRANSFER')),
    amount DECIMAL(18, 8) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL DEFAULT 'PREDICT',
    transaction_hash VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    confirmations INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

-- Duel escrow holds table
CREATE TABLE duel_escrow_holds (
    id SERIAL PRIMARY KEY,
    duel_id INTEGER NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_locked DECIMAL(18, 8) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL DEFAULT 'PREDICT',
    status VARCHAR(20) NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'RELEASED', 'TRANSFERRED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    UNIQUE(duel_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_connections_user ON wallet_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_connections_address ON wallet_connections(wallet_address);
CREATE INDEX IF NOT EXISTS idx_duels_player1 ON duels(player_1_id);
CREATE INDEX IF NOT EXISTS idx_duels_player2 ON duels(player_2_id);
CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_duel ON escrow_transactions(duel_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_user ON escrow_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_duel_escrow_holds_duel ON duel_escrow_holds(duel_id);
CREATE INDEX IF NOT EXISTS idx_duel_escrow_holds_user ON duel_escrow_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_duel_escrow_holds_status ON duel_escrow_holds(status);

-- Add comments
COMMENT ON TABLE wallet_connections IS 'User Solana wallet connections for on-chain transactions';
COMMENT ON TABLE token_configs IS 'Token mint addresses and configuration';
COMMENT ON TABLE duels IS 'Player duels with SOL/token stakes';
COMMENT ON TABLE escrow_transactions IS 'Blockchain escrow transactions for duels';
COMMENT ON TABLE duel_escrow_holds IS 'Tracks locked tokens in escrow for active duels';
