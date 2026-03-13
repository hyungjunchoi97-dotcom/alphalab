-- Alter journal_investments to support full investment thesis model
-- Run this in Supabase SQL Editor

ALTER TABLE journal_investments
  ADD COLUMN IF NOT EXISTS company_name   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS thesis         text DEFAULT '',
  ADD COLUMN IF NOT EXISTS entry_date     date,
  ADD COLUMN IF NOT EXISTS exit_date      date,
  ADD COLUMN IF NOT EXISTS exit_price     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status         text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes          jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS screenshot_url text DEFAULT '';

-- Backfill entry_date from existing date column (for old data)
UPDATE journal_investments SET entry_date = date WHERE entry_date IS NULL AND date IS NOT NULL;

-- Make entry_date default to today for new rows without it
ALTER TABLE journal_investments ALTER COLUMN entry_date SET DEFAULT CURRENT_DATE;

-- Update direction values from English to Korean (old data migration)
UPDATE journal_investments SET direction = '매수' WHERE direction = 'buy';
UPDATE journal_investments SET direction = '매도' WHERE direction = 'sell';

-- Drop old index and create better one
DROP INDEX IF EXISTS idx_journal_investments_user_date;
CREATE INDEX IF NOT EXISTS idx_journal_investments_user_status ON journal_investments (user_id, status, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_investments_user_entry ON journal_investments (user_id, entry_date DESC);
