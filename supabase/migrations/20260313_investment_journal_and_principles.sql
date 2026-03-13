-- Investment journal + Trading principles tables
-- Run this in Supabase SQL Editor

-- 1) Investment journal entries
CREATE TABLE IF NOT EXISTS journal_investments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date NOT NULL,
  ticker        text NOT NULL DEFAULT '',
  direction     text NOT NULL DEFAULT 'buy',
  entry_price   numeric NOT NULL DEFAULT 0,
  quantity      numeric NOT NULL DEFAULT 0,
  reason        text DEFAULT '',
  holding_period text DEFAULT 'short',
  target_price  numeric DEFAULT 0,
  memo          text DEFAULT '',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_journal_investments_user_date ON journal_investments (user_id, date DESC);

ALTER TABLE journal_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own investments"
  ON journal_investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments"
  ON journal_investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments"
  ON journal_investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments"
  ON journal_investments FOR DELETE USING (auth.uid() = user_id);

-- 2) Trading principles
CREATE TABLE IF NOT EXISTS journal_principles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        text NOT NULL,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE journal_principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own principles"
  ON journal_principles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own principles"
  ON journal_principles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own principles"
  ON journal_principles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own principles"
  ON journal_principles FOR DELETE USING (auth.uid() = user_id);

-- 3) Daily principle compliance checks
CREATE TABLE IF NOT EXISTS journal_principle_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          date NOT NULL,
  principle_id  uuid NOT NULL REFERENCES journal_principles(id) ON DELETE CASCADE,
  followed      boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, date, principle_id)
);

CREATE INDEX idx_principle_checks_user_date ON journal_principle_checks (user_id, date DESC);

ALTER TABLE journal_principle_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own checks"
  ON journal_principle_checks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checks"
  ON journal_principle_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checks"
  ON journal_principle_checks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checks"
  ON journal_principle_checks FOR DELETE USING (auth.uid() = user_id);
