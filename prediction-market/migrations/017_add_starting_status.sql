-- Add starting_at column for countdown tracking
ALTER TABLE duels ADD COLUMN starting_at TIMESTAMP;

-- Update existing ACTIVE duels to have starting_at = started_at - 5 seconds
-- This maintains data consistency for historical duels
UPDATE duels 
SET starting_at = started_at - INTERVAL '5 seconds'
WHERE status = 'ACTIVE' AND started_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN duels.starting_at IS 'Timestamp when 5-second countdown started (before actual duel start)';
