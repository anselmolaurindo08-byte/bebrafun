-- Add x_avatar_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS x_avatar_url VARCHAR(512);
