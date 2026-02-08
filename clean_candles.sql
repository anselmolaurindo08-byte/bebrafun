-- Clean old 50/50 price candles that were recorded before OHLC fix
-- This will allow new trades to record correct historical prices

-- Delete all candles for pool 1770549658972 (test market)
DELETE FROM amm_price_candles WHERE pool_id = (
  SELECT id FROM amm_pools WHERE onchain_pool_id = 1770549658972
);

-- Optional: Delete all candles for all pools to start fresh
-- DELETE FROM amm_price_candles;

-- Verify deletion
SELECT COUNT(*) as remaining_candles FROM amm_price_candles;
