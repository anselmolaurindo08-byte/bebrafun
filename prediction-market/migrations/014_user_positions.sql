-- Create user_positions table for virtual position tracking
CREATE TABLE IF NOT EXISTS user_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address VARCHAR(255) NOT NULL,
    pool_id UUID REFERENCES amm_pools(id) ON DELETE CASCADE,
    outcome VARCHAR(10) NOT NULL CHECK (outcome IN ('YES', 'NO')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    entry_price DECIMAL(10, 6) NOT NULL,
    sol_invested BIGINT NOT NULL CHECK (sol_invested > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX idx_user_positions_user ON user_positions(user_address);
CREATE INDEX idx_user_positions_pool ON user_positions(pool_id);
CREATE INDEX idx_user_positions_status ON user_positions(status);
CREATE INDEX idx_user_positions_user_pool ON user_positions(user_address, pool_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_positions_updated_at
    BEFORE UPDATE ON user_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_positions_updated_at();
