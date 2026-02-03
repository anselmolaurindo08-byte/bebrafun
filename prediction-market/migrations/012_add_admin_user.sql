-- Migration: Add admin user and cleanup active duels/markets
-- Created: 2026-02-03
-- WARNING: This will delete ALL active duels and markets!

-- ============================================================================
-- CLEANUP SECTION - Delete all active duels and markets
-- ============================================================================

-- Step 1: Delete all duel-related data
DELETE FROM duel_transactions;
DELETE FROM duels WHERE status IN ('PENDING', 'MATCHED', 'ACTIVE');

-- Step 2: Delete all market-related data  
DELETE FROM amm_pools;
DELETE FROM markets WHERE status IN ('ACTIVE', 'PENDING');

-- Step 3: Reset any orphaned data
DELETE FROM duel_transactions WHERE duel_id NOT IN (SELECT id FROM duels);

-- ============================================================================
-- ADMIN USER SECTION - Add admin privileges
-- ============================================================================

-- Step 4: Insert user if not exists
INSERT INTO users (wallet_address, created_at, updated_at)
VALUES ('ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE', NOW(), NOW())
ON CONFLICT (wallet_address) DO NOTHING;

-- Step 5: Add admin privileges
INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at)
SELECT 
    u.id,
    'SUPER_ADMIN',
    '{"markets": ["create", "update", "delete", "resolve"], "users": ["view", "ban", "unban"], "contests": ["create", "update", "delete"], "platform": ["view_stats", "manage_settings"]}'::jsonb,
    NOW(),
    NOW()
FROM users u
WHERE u.wallet_address = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE'
ON CONFLICT (user_id) DO UPDATE
SET 
    role = 'SUPER_ADMIN',
    permissions = '{"markets": ["create", "update", "delete", "resolve"], "users": ["view", "ban", "unban"], "contests": ["create", "update", "delete"], "platform": ["view_stats", "manage_settings"]}'::jsonb,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION QUERIES (run separately to check results)
-- ============================================================================

-- Check remaining duels (should be only RESOLVED or CANCELLED)
-- SELECT status, COUNT(*) FROM duels GROUP BY status;

-- Check remaining markets (should be only RESOLVED or CLOSED)
-- SELECT status, COUNT(*) FROM markets GROUP BY status;

-- Verify admin user was created
-- SELECT au.*, u.wallet_address FROM admin_users au JOIN users u ON u.id = au.user_id WHERE u.wallet_address = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE';
