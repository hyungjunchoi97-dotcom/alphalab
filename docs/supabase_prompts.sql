-- ══════════════════════════════════════════════════════════════
-- Prompts tables
-- ══════════════════════════════════════════════════════════════

create table if not exists prompts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null default '',
  content         text not null default '',
  tags            text[] not null default '{}',
  author_id       uuid,
  author_email    text not null default 'System',
  rating_sum      int not null default 0,
  rating_count    int not null default 0,
  use_count       int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists prompt_ratings (
  id              uuid primary key default gen_random_uuid(),
  prompt_id       uuid not null references prompts(id) on delete cascade,
  user_id         uuid not null,
  rating          int not null check (rating >= 1 and rating <= 5),
  comment         text not null default '',
  created_at      timestamptz not null default now(),
  unique (user_id, prompt_id)
);

-- Indexes
create index if not exists idx_prompts_author on prompts(author_id);
create index if not exists idx_prompt_ratings_prompt on prompt_ratings(prompt_id);

-- ══════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════

alter table prompts enable row level security;
alter table prompt_ratings enable row level security;

-- Prompts: anyone can read, service role handles insert/update/delete
create policy "prompts_select" on prompts for select using (true);
create policy "prompts_insert" on prompts for insert with check (true);
create policy "prompts_update" on prompts for update using (true);
create policy "prompts_delete" on prompts for delete using (true);

-- Ratings: anyone can read, authenticated users can insert their own
create policy "prompt_ratings_select" on prompt_ratings for select using (true);
create policy "prompt_ratings_insert" on prompt_ratings for insert
  with check (auth.uid() = user_id);
