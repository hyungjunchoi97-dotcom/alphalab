-- Trading Journal tables
-- Run this in Supabase SQL Editor

-- 1) Journal entries
CREATE TABLE IF NOT EXISTS trading_journal_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  pnl         numeric NOT NULL DEFAULT 0,
  notes       text DEFAULT '',
  screenshot_url text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_journal_user_date ON trading_journal_entries (user_id, date DESC);

ALTER TABLE trading_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entries"
  ON trading_journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON trading_journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON trading_journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON trading_journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- 2) User settings (initial seed etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  initial_seed numeric DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- 3) Storage bucket for journal screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-screenshots', 'journal-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload journal screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'journal-screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Public read journal screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'journal-screenshots');
