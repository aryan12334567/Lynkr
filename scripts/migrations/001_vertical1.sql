-- Vertical 1: the person's context lives in their account (build plan Part 1b).
-- Every table is keyed to the Better Auth "user" and removed with it (on delete cascade).
-- Safe to run again: every statement is IF NOT EXISTS. Never stores a PDF or a file.

-- One row per Lynkr user: consent, the "save my answers" switch, and activity for the 12-month cleanup.
create table if not exists lynkr_user (
  user_id text primary key references "user" ("id") on delete cascade,
  consent_at timestamptz,
  save_answers boolean not null default true,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists lynkr_user_last_active_idx on lynkr_user (last_active_at);

-- The context brief: bucket, field, goals, targets, must-haves, private search, weekly time, tone.
-- Versioned: each change adds a row; the newest version is the current brief.
create table if not exists context_brief (
  user_id text not null references "user" ("id") on delete cascade,
  version integer not null check (version > 0),
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, version)
);

-- The Story Vault. fact_key is the short id drafts refer to (F1, F2 ...).
-- Facts from the interview remember the answer they came from, so re-saving an answer updates, never duplicates.
create table if not exists facts (
  user_id text not null references "user" ("id") on delete cascade,
  fact_key text not null check (char_length(fact_key) between 1 and 12),
  kind text not null,
  text text not null check (char_length(text) between 1 and 400),
  confidence jsonb,
  source_qid text,
  source_attempt smallint,
  source_idx smallint,
  status text not null check (status in ('candidate', 'confirmed', 'excluded')),
  use_in_drafts boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, fact_key)
);
create unique index if not exists facts_source_uq on facts (user_id, source_qid, source_attempt, source_idx) where source_qid is not null;
create index if not exists facts_user_status_idx on facts (user_id, status);

-- Interview answers, saved after every answer so the interview can resume. The person can switch this off.
create table if not exists interview_answers (
  user_id text not null references "user" ("id") on delete cascade,
  qid text not null,
  attempt smallint not null check (attempt between 0 and 2),
  status text not null check (status in ('answered', 'skipped', 'parked', 'later')),
  answer text not null default '' check (char_length(answer) <= 1500),
  meta jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, qid, attempt)
);

-- Saved outputs (drafts) and weekly plan entries.
create table if not exists drafts (
  user_id text not null references "user" ("id") on delete cascade,
  draft_key text not null,
  kind text not null,
  body jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, draft_key)
);
create table if not exists plan_items (
  user_id text not null references "user" ("id") on delete cascade,
  item_key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

-- Durable per-user daily caps (lib/limit.ts is in memory per instance).
create table if not exists usage_daily (
  user_id text not null references "user" ("id") on delete cascade,
  day date not null,
  kind text not null,
  count integer not null default 0,
  primary key (user_id, day, kind)
);

-- Count-only measurement (Part 7). No user id, no answer text.
create table if not exists metric_counts (
  day date not null,
  event text not null,
  label text not null default '',
  count integer not null default 0,
  sum_value bigint not null default 0,
  primary key (day, event, label)
);
