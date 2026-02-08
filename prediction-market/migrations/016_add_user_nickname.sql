-- Add nickname column to users table
ALTER TABLE users ADD COLUMN nickname VARCHAR(50);

-- Add unique constraint on nickname
CREATE UNIQUE INDEX idx_users_nickname ON users(nickname);

-- Generate default nicknames for existing users (using wallet address suffix)
UPDATE users SET nickname = 'User_' || SUBSTRING(wallet_address FROM 1 FOR 8) WHERE nickname IS NULL;

-- Make nickname NOT NULL after setting defaults
ALTER TABLE users ALTER COLUMN nickname SET NOT NULL;
