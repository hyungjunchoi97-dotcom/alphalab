-- prediction_comments table
create table if not exists prediction_comments (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references predictions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text not null check (char_length(content) <= 200),
  created_at timestamptz not null default now()
);

-- Index for fast lookups by prediction
create index if not exists idx_prediction_comments_pred_id on prediction_comments(prediction_id, created_at desc);

-- RLS
alter table prediction_comments enable row level security;

-- Anyone can read comments
create policy "comments_select" on prediction_comments
  for select using (true);

-- Insert only if user has a bet on this prediction
create policy "comments_insert" on prediction_comments
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from predictions_bets
      where predictions_bets.market_id = prediction_comments.prediction_id
        and predictions_bets.user_id = auth.uid()
    )
  );
