-- ══════════════════════════════════════════════════════════════
-- Portfolio holdings table
-- ══════════════════════════════════════════════════════════════

create table if not exists portfolio_holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  symbol      text not null,
  name        text not null,
  market      text not null default 'KR'
    check (market in ('KR', 'US', 'JP', 'COM')),
  quantity    numeric not null default 0,
  avg_cost    numeric not null default 0,
  currency    text not null default 'KRW',
  created_at  timestamptz not null default now()
);

-- Indexes
create index if not exists idx_portfolio_holdings_user on portfolio_holdings(user_id);

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════

alter table portfolio_holdings enable row level security;

-- Users can read/insert/update/delete their own holdings
create policy "holdings_select" on portfolio_holdings for select
  using (auth.uid() = user_id);
create policy "holdings_insert" on portfolio_holdings for insert
  with check (auth.uid() = user_id);
create policy "holdings_update" on portfolio_holdings for update
  using (auth.uid() = user_id);
create policy "holdings_delete" on portfolio_holdings for delete
  using (auth.uid() = user_id);
