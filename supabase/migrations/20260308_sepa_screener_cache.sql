-- SEPA screener cache table
create table if not exists sepa_screener_cache (
  id uuid primary key default gen_random_uuid(),
  market text not null unique,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS (service role only — no public access needed)
alter table sepa_screener_cache enable row level security;
