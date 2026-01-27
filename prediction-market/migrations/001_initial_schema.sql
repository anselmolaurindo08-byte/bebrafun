-- Prediction Market Database Schema
-- Version: 1.0
-- Description: Initial schema for Season 0 (Virtual Money)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    x_username VARCHAR(255) UNIQUE NOT NULL,
    x_id VARCHAR(255) UNIQUE NOT NULL,
    followers_count INT DEFAULT 0,
    virtual_balance DECIMAL(15, 2) DEFAULT 1000.00,
    referrer_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on referrer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    used_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invite_codes_user_id ON invite_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rebate_percentage INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(referrer_id, referred_user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Politics', 'Sports', 'Crypto', 'Solana')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'resolved', 'cancelled')),
    resolution_outcome VARCHAR(50),
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_created_by ON markets(created_by);

-- Market events table
CREATE TABLE IF NOT EXISTS market_events (
    id SERIAL PRIMARY KEY,
    market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    event_title VARCHAR(500) NOT NULL,
    event_description TEXT,
    outcome_type VARCHAR(50) NOT NULL CHECK (outcome_type IN ('binary', 'multiple'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_market_events_market_id ON market_events(market_id);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    event_id INT NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    side VARCHAR(10) NOT NULL CHECK (side IN ('yes', 'no')),
    price DECIMAL(5, 2) NOT NULL CHECK (price >= 0 AND price <= 100),
    quantity DECIMAL(15, 2) NOT NULL CHECK (quantity > 0),
    filled_quantity DECIMAL(15, 2) DEFAULT 0 CHECK (filled_quantity >= 0),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'partially_filled', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_market_id ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_lost', 'referral_bonus', 'social_bonus')),
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- User proposals table
CREATE TABLE IF NOT EXISTS user_proposals (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_title VARCHAR(500) NOT NULL,
    market_description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Politics', 'Sports', 'Crypto', 'Solana')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_proposals_user_id ON user_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_proposals_status ON user_proposals(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
