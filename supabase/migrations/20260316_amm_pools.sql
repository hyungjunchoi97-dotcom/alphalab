-- AMM Pool columns for predictions
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS yes_pool numeric DEFAULT 100;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS no_pool numeric DEFAULT 100;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS k_constant numeric DEFAULT 10000;

-- Back-fill k_constant for existing rows
UPDATE predictions SET k_constant = yes_pool * no_pool WHERE k_constant IS NULL OR k_constant = 0;

-- AMM bet tracking columns for prediction_bets
ALTER TABLE prediction_bets ADD COLUMN IF NOT EXISTS shares_received numeric;
ALTER TABLE prediction_bets ADD COLUMN IF NOT EXISTS probability_at_bet numeric;
