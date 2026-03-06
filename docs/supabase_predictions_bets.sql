-- =====================================================
-- Predictions Bets — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL)
-- =====================================================

-- 1. Bets table (points-based betting)
CREATE TABLE IF NOT EXISTS predictions_bets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id uuid NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  choice text NOT NULL CHECK (choice IN ('yes', 'no')),
  points int NOT NULL CHECK (points > 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(market_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bets_market ON predictions_bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_user ON predictions_bets(user_id);

-- RLS
ALTER TABLE predictions_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bets" ON predictions_bets FOR SELECT USING (true);
CREATE POLICY "Auth insert bets" ON predictions_bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);
