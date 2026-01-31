-- AMM (Automated Market Maker) tables for prediction markets

-- Liquidity pools
CREATE TABLE IF NOT EXISTS amm_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id INTEGER REFERENCES markets(id),
    program_id VARCHAR(255) NOT NULL UNIQUE,
    authority VARCHAR(255) NOT NULL,
    yes_mint VARCHAR(255) NOT NULL,
    no_mint VARCHAR(255) NOT NULL,
    yes_reserve BIGINT NOT NULL DEFAULT 0,
    no_reserve BIGINT NOT NULL DEFAULT 0,
    fee_percentage SMALLINT NOT NULL DEFAULT 50,
    total_liquidity BIGINT NOT NULL DEFAULT 0,
    bump SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price candles for charting
CREATE TABLE IF NOT EXISTS price_candles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES amm_pools(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User positions in AMM pools
CREATE TABLE IF NOT EXISTS amm_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES amm_pools(id) ON DELETE CASCADE,
    user_address VARCHAR(255) NOT NULL,
    yes_balance BIGINT NOT NULL DEFAULT 0,
    no_balance BIGINT NOT NULL DEFAULT 0,
    entry_price_yes DECIMAL(20, 8),
    entry_price_no DECIMAL(20, 8),
    pnl DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pool_id, user_address)
);

-- Trade history
CREATE TABLE IF NOT EXISTS amm_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES amm_pools(id) ON DELETE CASCADE,
    user_address VARCHAR(255) NOT NULL,
    trade_type SMALLINT NOT NULL,
    input_amount BIGINT NOT NULL,
    output_amount BIGINT NOT NULL,
    fee_amount BIGINT NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    transaction_signature VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    confirmations SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_amm_pools_market ON amm_pools(market_id);
CREATE INDEX IF NOT EXISTS idx_amm_pools_authority ON amm_pools(authority);
CREATE INDEX IF NOT EXISTS idx_amm_pools_status ON amm_pools(status);
CREATE INDEX IF NOT EXISTS idx_price_candles_pool_ts ON price_candles(pool_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_amm_positions_user_pool ON amm_positions(user_address, pool_id);
CREATE INDEX IF NOT EXISTS idx_amm_trades_user_pool ON amm_trades(user_address, pool_id);
CREATE INDEX IF NOT EXISTS idx_amm_trades_signature ON amm_trades(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_amm_trades_status ON amm_trades(status);
