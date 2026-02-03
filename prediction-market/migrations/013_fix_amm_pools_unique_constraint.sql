-- Fix AMM pools unique constraint
-- program_id should not be unique (it's the same for all pools)
-- pool_address (on-chain PDA) should be unique instead

-- Drop the incorrect unique constraint on program_id
ALTER TABLE amm_pools DROP CONSTRAINT IF EXISTS amm_pools_program_id_key;

-- Add pool_address column if it doesn't exist
ALTER TABLE amm_pools ADD COLUMN IF NOT EXISTS pool_address VARCHAR(255);

-- Create unique constraint on pool_address
CREATE UNIQUE INDEX IF NOT EXISTS idx_amm_pools_pool_address ON amm_pools(pool_address) WHERE pool_address IS NOT NULL;

-- Create index on program_id for faster lookups (but not unique)
CREATE INDEX IF NOT EXISTS idx_amm_pools_program_id ON amm_pools(program_id);
