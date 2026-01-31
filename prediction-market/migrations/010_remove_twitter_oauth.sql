-- Migration: Remove Twitter OAuth dependency
-- This migration makes wallet_address the primary required field
-- and makes Twitter fields optional (nullable)

-- Note: This migration does NOT drop Twitter columns to preserve existing data
-- If you want to completely remove Twitter data, uncomment the ALTER TABLE DROP COLUMN statements

-- Make wallet_address NOT NULL (it should already have data from wallet connections)
-- First, ensure all users have a wallet_address (update any NULL values if needed)
UPDATE users 
SET wallet_address = CONCAT('LEGACY_', id::text) 
WHERE wallet_address IS NULL OR wallet_address = '';

-- Now make wallet_address NOT NULL
ALTER TABLE users 
ALTER COLUMN wallet_address SET NOT NULL;

-- Make Twitter fields nullable (they should already be nullable, but this ensures it)
ALTER TABLE users 
ALTER COLUMN x_username DROP NOT NULL,
ALTER COLUMN x_id DROP NOT NULL,
ALTER COLUMN followers_count DROP NOT NULL;

-- Optional: If you want to completely remove Twitter data, uncomment these lines:
-- ALTER TABLE users DROP COLUMN IF EXISTS x_username;
-- ALTER TABLE users DROP COLUMN IF EXISTS x_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS x_avatar_url;
-- ALTER TABLE users DROP COLUMN IF EXISTS followers_count;

-- Update indexes: Remove unique constraint on x_username if it exists
-- and ensure wallet_address has a unique index
DROP INDEX IF EXISTS idx_users_x_username;
DROP INDEX IF EXISTS idx_users_x_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Optional: Create index on x_username for faster lookups if keeping Twitter data
CREATE INDEX IF NOT EXISTS idx_users_x_username_optional ON users(x_username) WHERE x_username IS NOT NULL;
