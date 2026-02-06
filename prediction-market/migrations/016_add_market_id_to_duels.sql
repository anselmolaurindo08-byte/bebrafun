-- Add market_id column to duels table
-- This column tracks which market/chart the duel is based on (1=SOL/USDT, 2=PUMP/USDT)

ALTER TABLE duels ADD COLUMN IF NOT EXISTS market_id INTEGER;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_duels_market_id ON duels(market_id);

-- Add comment
COMMENT ON COLUMN duels.market_id IS 'Market/chart selection: 1=SOL/USDT, 2=PUMP/USDT';
