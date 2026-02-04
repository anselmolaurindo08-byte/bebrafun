-- Add onchain_pool_id column to amm_pools table
ALTER TABLE amm_pools 
ADD COLUMN onchain_pool_id BIGINT;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_amm_pools_onchain_pool_id 
ON amm_pools(onchain_pool_id) 
WHERE onchain_pool_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN amm_pools.onchain_pool_id IS 'Pool ID from blockchain (uint64)';
