-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- Set specific user as admin (replace with actual wallet address)
UPDATE users SET role = 'admin' WHERE wallet_address = 'ARytv9UP...RFrcJE';

-- Create index for role lookups
CREATE INDEX idx_users_role ON users(role);
