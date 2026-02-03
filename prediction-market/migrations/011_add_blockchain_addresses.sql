-- Migration: Add blockchain addresses to pools and duels
-- Description: Adds pool_address and duel_address columns to store on-chain PDA addresses

-- Add pool_address to amm_pools table
ALTER TABLE amm_pools 
ADD COLUMN pool_address VARCHAR(255);

-- Add unique index for pool_address
CREATE UNIQUE INDEX idx_amm_pools_pool_address ON amm_pools(pool_address) WHERE pool_address IS NOT NULL;

-- Add duel_address to duels table
ALTER TABLE duels 
ADD COLUMN duel_address VARCHAR(255);

-- Add unique index for duel_address
CREATE UNIQUE INDEX idx_duels_duel_address ON duels(duel_address) WHERE duel_address IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN amm_pools.pool_address IS 'On-chain Solana PDA address for the AMM pool';
COMMENT ON COLUMN duels.duel_address IS 'On-chain Solana PDA address for the duel';
