-- Duels Enhancement Migration
-- Adds new columns to duels table and creates supporting tables

-- Add new columns to duels table
ALTER TABLE duels ADD COLUMN IF NOT EXISTS currency SMALLINT NOT NULL DEFAULT 0; -- 0: SOL, 1: PUMP
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player_1_username VARCHAR(255);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player_1_avatar VARCHAR(500);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player_2_username VARCHAR(255);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player_2_avatar VARCHAR(500);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS price_at_start DECIMAL(20, 8);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS price_at_end DECIMAL(20, 8);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS direction SMALLINT; -- 0: UP, 1: DOWN
ALTER TABLE duels ADD COLUMN IF NOT EXISTS confirmations SMALLINT DEFAULT 0;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255);
ALTER TABLE duels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create duel price candles table (separate from AMM price_candles)
CREATE TABLE IF NOT EXISTS duel_price_candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  time BIGINT NOT NULL,
  open DECIMAL(20, 8) NOT NULL,
  high DECIMAL(20, 8) NOT NULL,
  low DECIMAL(20, 8) NOT NULL,
  close DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_duel_price_candles_duel ON duel_price_candles(duel_id);
CREATE INDEX IF NOT EXISTS idx_duel_price_candles_time ON duel_price_candles(time DESC);

-- Create transaction confirmations table
CREATE TABLE IF NOT EXISTS transaction_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  transaction_hash VARCHAR(255) NOT NULL UNIQUE,
  confirmations SMALLINT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tx_confirmations_duel ON transaction_confirmations(duel_id);
CREATE INDEX IF NOT EXISTS idx_tx_confirmations_hash ON transaction_confirmations(transaction_hash);

-- Create duel results table
CREATE TABLE IF NOT EXISTS duel_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id UUID NOT NULL UNIQUE REFERENCES duels(id) ON DELETE CASCADE,
  winner_id BIGINT NOT NULL,
  loser_id BIGINT NOT NULL,
  winner_username VARCHAR(255) NOT NULL,
  loser_username VARCHAR(255) NOT NULL,
  winner_avatar VARCHAR(500),
  loser_avatar VARCHAR(500),
  amount_won DECIMAL(20, 8) NOT NULL,
  currency SMALLINT NOT NULL,
  entry_price DECIMAL(20, 8) NOT NULL,
  exit_price DECIMAL(20, 8) NOT NULL,
  price_change DECIMAL(20, 8) NOT NULL,
  price_change_percent DECIMAL(10, 4) NOT NULL,
  direction SMALLINT NOT NULL,
  was_correct BOOLEAN NOT NULL,
  duration_seconds BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_duel_results_winner ON duel_results(winner_id);
CREATE INDEX IF NOT EXISTS idx_duel_results_loser ON duel_results(loser_id);
