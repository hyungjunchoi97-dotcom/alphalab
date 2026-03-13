-- Journal individual trades table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS journal_trades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  ticker      text NOT NULL DEFAULT '',
  direction   text NOT NULL DEFAULT '매수',
  entry_price numeric NOT NULL DEFAULT 0,
  exit_price  numeric NOT NULL DEFAULT 0,
  quantity    numeric NOT NULL DEFAULT 0,
  fee         numeric NOT NULL DEFAULT 0,
  pnl         numeric NOT NULL DEFAULT 0,
  memo        text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_journal_trades_user_date ON journal_trades (user_id, date DESC);

ALTER TABLE journal_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trades"
  ON journal_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON journal_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON journal_trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON journal_trades FOR DELETE
  USING (auth.uid() = user_id);
