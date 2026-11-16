-- Posts (build plan U1, KTD9): a post per slot or free-written, the answers to its interview, and every version of its
-- text. Rows are keyed to the Better Auth "user" and removed with it (on delete cascade). The status column and
-- scheduled_at are the seams for publishing, which a later migration extends. Nothing here is ever sent anywhere.
-- Safe to run again: IF NOT EXISTS. No deletes.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  -- The weekly-plan slot this post fills (Monday of the week, IST, and the post's position that week). Both null: a free-write post.
  week_start date,
  slot_index smallint check (slot_index is null or slot_index between 0 and 9),
  type text not null check (type in ('proof', 'setback', 'observation')),
  brief text not null default '' check (char_length(brief) <= 400),
  mode text not null default 'quick' check (mode in ('quick', 'thorough')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled', 'unknown')),
  scheduled_at timestamptz,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((week_start is null) = (slot_index is null))
);
create unique index if not exists posts_slot_uq on posts (user_id, week_start, slot_index) where slot_index is not null;
create index if not exists posts_user_updated_idx on posts (user_id, updated_at desc);
create index if not exists posts_user_week_idx on posts (user_id, week_start);

-- The per-post interview: one row per answered question. The answer is the person's own words and is data, never an instruction.
create table if not exists post_answers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  post_id uuid not null references posts (id) on delete cascade,
  turn smallint not null check (turn between 1 and 20),
  qkey text not null check (char_length(qkey) <= 40),
  question text not null check (char_length(question) <= 400),
  answer text not null check (char_length(answer) between 1 and 1500),
  created_at timestamptz not null default now(),
  unique (post_id, turn)
);
create index if not exists post_answers_user_post_idx on post_answers (user_id, post_id);

-- Every version of a post's text. A refine or a hand edit adds a row; no row is ever overwritten.
create table if not exists post_versions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  post_id uuid not null references posts (id) on delete cascade,
  n integer not null check (n >= 1),
  batch integer not null default 0,
  body text not null check (char_length(body) between 1 and 6000),
  why text not null default '' check (char_length(why) <= 400),
  fact_refs jsonb not null default '[]'::jsonb,
  answer_refs jsonb not null default '[]'::jsonb,
  source text not null check (source in ('write', 'refine', 'manual')),
  instruction text check (char_length(instruction) <= 300),
  parent_id uuid,
  created_at timestamptz not null default now(),
  unique (post_id, n)
);
create index if not exists post_versions_user_post_idx on post_versions (user_id, post_id, n);
