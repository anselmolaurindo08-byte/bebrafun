-- Add player_2_direction column to duels table
ALTER TABLE duels ADD COLUMN IF NOT EXISTS player_2_direction SMALLINT;

-- Add comment
COMMENT ON COLUMN duels.player_2_direction IS 'Player 2 prediction: 0=UP, 1=DOWN';
