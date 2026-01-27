-- Step 1.4: Trading System Tables Migration
-- This migration adds tables for order book, trading, and market resolution

-- Drop old orders table (incompatible schema)
DROP TABLE IF EXISTS orders CASCADE;

-- Orders/Bets table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    market_event_id INTEGER NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
    quantity DECIMAL(18, 8) NOT NULL CHECK (quantity > 0),
    price DECIMAL(18, 8) NOT NULL CHECK (price >= 0 AND price <= 1),
    total_cost DECIMAL(18, 8) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
    filled_quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trades table (executed matches)
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    market_event_id INTEGER NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    quantity DECIMAL(18, 8) NOT NULL,
    price DECIMAL(18, 8) NOT NULL,
    total_amount DECIMAL(18, 8) NOT NULL,
    buyer_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    seller_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User positions (holdings)
CREATE TABLE IF NOT EXISTS user_positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    market_event_id INTEGER NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
    average_price DECIMAL(18, 8) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(18, 8) NOT NULL DEFAULT 0,
    realized_pnl DECIMAL(18, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, market_id, market_event_id)
);

-- Order book snapshot (for analytics)
CREATE TABLE IF NOT EXISTS order_book_snapshots (
    id SERIAL PRIMARY KEY,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    market_event_id INTEGER NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    buy_orders JSONB NOT NULL,
    sell_orders JSONB NOT NULL,
    mid_price DECIMAL(18, 8),
    spread DECIMAL(18, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market resolutions and payouts
CREATE TABLE IF NOT EXISTS market_resolutions (
    id SERIAL PRIMARY KEY,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    winning_event_id INTEGER NOT NULL REFERENCES market_events(id) ON DELETE CASCADE,
    resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payout_calculated BOOLEAN DEFAULT FALSE
);

-- User payouts
CREATE TABLE IF NOT EXISTS user_payouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    payout_amount DECIMAL(18, 8) NOT NULL,
    pnl DECIMAL(18, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_market ON orders(user_id, market_id);
CREATE INDEX IF NOT EXISTS idx_orders_market_event ON orders(market_id, market_event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_market ON user_positions(user_id, market_id);
CREATE INDEX IF NOT EXISTS idx_market_resolutions_market ON market_resolutions(market_id);
CREATE INDEX IF NOT EXISTS idx_user_payouts_user ON user_payouts(user_id);

-- Update users table to use DECIMAL for virtual_balance
ALTER TABLE users ALTER COLUMN virtual_balance TYPE DECIMAL(18, 8);
