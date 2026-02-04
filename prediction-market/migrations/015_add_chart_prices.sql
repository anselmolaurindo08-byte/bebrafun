-- Add chart_start_price column for persisting chart display price
-- This is separate from price_at_start which is used for duel resolution

ALTER TABLE duels ADD COLUMN IF NOT EXISTS chart_start_price DOUBLE PRECISION;

-- Add price_at_end column if it doesn't exist
ALTER TABLE duels ADD COLUMN IF NOT EXISTS price_at_end DOUBLE PRECISION;

-- Add index for faster queries on active duels
CREATE INDEX IF NOT EXISTS idx_duels_status_started_at ON duels(status, started_at);
