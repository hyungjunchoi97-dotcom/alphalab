-- Prediction odds system
-- Run in Supabase SQL Editor

-- 1) Extend predictions table
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS total_yes_points numeric DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS total_no_points numeric DEFAULT 0;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS house_fee_rate numeric DEFAULT 0.05;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS min_bet integer DEFAULT 10;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS max_bet integer DEFAULT 10000;

-- 2) prediction_bets table (odds-based, replaces predictions_bets for new bets)
CREATE TABLE IF NOT EXISTS prediction_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  prediction_id uuid REFERENCES predictions NOT NULL,
  side text NOT NULL CHECK (side IN ('yes', 'no')),
  points_wagered numeric NOT NULL,
  odds_at_bet numeric NOT NULL,
  potential_payout numeric NOT NULL,
  actual_payout numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_bets_user ON prediction_bets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_bets_pred ON prediction_bets (prediction_id, side);

ALTER TABLE prediction_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own bets" ON prediction_bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own bets" ON prediction_bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin can read all bets (for resolve)
CREATE POLICY "service role full access bets" ON prediction_bets
  USING (true)
  WITH CHECK (true);

-- 3) user_points table
CREATE TABLE IF NOT EXISTS user_points (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  balance numeric DEFAULT 1000,
  total_wagered numeric DEFAULT 0,
  total_won numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own points" ON user_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own points" ON user_points FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users insert own points" ON user_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service role full access points" ON user_points
  USING (true)
  WITH CHECK (true);
