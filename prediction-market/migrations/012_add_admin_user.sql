-- Migration: Add admin user for wallet ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE
-- Created: 2026-02-03

-- Step 1: Insert user if not exists
INSERT INTO users (wallet_address, created_at, updated_at)
VALUES ('ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE', NOW(), NOW())
ON CONFLICT (wallet_address) DO NOTHING;

-- Step 2: Add admin privileges
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
