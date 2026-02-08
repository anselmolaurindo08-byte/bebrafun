-- Find user ID for the wallet address
-- Run this first to get user_id:
SELECT id FROM users WHERE wallet_address = 'ARytv9UPs8ajtsHboVgtVJDwz1u7VrHTfDj8qERFrcJE';

-- Then insert into admin_users table (replace USER_ID_HERE with the actual ID from above)
-- INSERT INTO admin_users (user_id, role, permissions, created_at, updated_at) 
-- VALUES (
--   USER_ID_HERE,
--   'SUPER_ADMIN',
--   '{"manage_users": true, "manage_markets": true, "manage_contests": true, "view_analytics": true}'::jsonb,
--   NOW(),
--   NOW()
-- );
