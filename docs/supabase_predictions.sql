-- ══════════════════════════════════════════════════════════════
-- Predictions tables
-- ══════════════════════════════════════════════════════════════

create table if not exists predictions (
  id                uuid primary key default gen_random_uuid(),
  title_en          text not null,
  title_kr          text not null,
  description_en    text not null default '',
  description_kr    text not null default '',
  category          text not null default 'stocks'
    check (category in ('stocks', 'realestate', 'politics', 'other')),
  status            text not null default 'open'
    check (status in ('open', 'closed', 'resolved')),
  closes_at         timestamptz not null,
  created_at        timestamptz not null default now(),
  resolved_option_id text
    check (resolved_option_id is null or resolved_option_id in ('yes', 'no'))
);

create table if not exists prediction_votes (
  id              uuid primary key default gen_random_uuid(),
  prediction_id   uuid not null references predictions(id) on delete cascade,
  user_id         uuid not null,
  option_id       text not null check (option_id in ('yes', 'no')),
  created_at      timestamptz not null default now(),
  unique (user_id, prediction_id)
);

-- Indexes
create index if not exists idx_predictions_status on predictions(status);
create index if not exists idx_predictions_category on predictions(category);
create index if not exists idx_prediction_votes_prediction on prediction_votes(prediction_id);

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════

alter table predictions enable row level security;
alter table prediction_votes enable row level security;

-- Predictions: anyone can read, only service role can insert/update (no policy = denied for anon/authenticated)
create policy "predictions_select" on predictions for select using (true);

-- Votes: anyone can read, authenticated users can insert their own
create policy "votes_select" on prediction_votes for select using (true);
create policy "votes_insert" on prediction_votes for insert
  with check (auth.uid() = user_id);
