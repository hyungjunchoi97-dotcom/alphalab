-- ETF holdings snapshot: one row per holding per ETF per day
create table if not exists etf_holdings_snapshot (
  id bigint generated always as identity primary key,
  etf_ticker text not null,
  snapshot_date date not null,
  symbol text not null,
  name text,
  sector text,
  weight numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_etf_snapshot_ticker_date
  on etf_holdings_snapshot(etf_ticker, snapshot_date desc);

create unique index if not exists idx_etf_snapshot_unique
  on etf_holdings_snapshot(etf_ticker, snapshot_date, symbol);

-- ETF changes: tracks additions/removals
create table if not exists etf_changes (
  id bigint generated always as identity primary key,
  etf_ticker text not null,
  symbol text not null,
  name text,
  sector text,
  change_type text not null check (change_type in ('ADD', 'REMOVE')),
  detected_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_etf_changes_date
  on etf_changes(detected_date desc);
create index if not exists idx_etf_changes_ticker
  on etf_changes(etf_ticker, detected_date desc);
