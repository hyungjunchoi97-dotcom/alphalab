-- Telegram subscribers table for newsletter alerts
CREATE TABLE IF NOT EXISTS telegram_subscribers (
  id bigint generated always as identity primary key,
  chat_id bigint unique not null,
  username text,
  alerts_stock boolean default true,
  alerts_macro boolean default true,
  alerts_crypto boolean default true,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_subs_active ON telegram_subscribers(is_active);

ALTER TABLE telegram_subscribers ENABLE ROW LEVEL SECURITY;
-- Service role only (no anon/authenticated access)
