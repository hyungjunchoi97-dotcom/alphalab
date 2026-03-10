create table if not exists dart_cache (
  symbol text not null,
  period text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (symbol, period)
);
