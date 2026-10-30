-- Outreach (Vertical 3): contacts and extension tokens stored per user (build plan Part 1b).
-- Every table is keyed to the Better Auth "user" and removed with it (on delete cascade).
-- Safe to run again: every statement is IF NOT EXISTS. No deletes.

-- One row per Lynkr user for outreach-specific settings (like monthly caps).
create table if not exists lynkr_user_outreach (
  user_id text primary key references "user" ("id") on delete cascade,
  monthly_new_contacts_limit smallint not null default 15 check (monthly_new_contacts_limit between 5 and 30),
  last_monthly_contacts_count smallint not null default 0 check (last_monthly_contacts_count >= 0),
  contacts_count_month date not null default date_trunc('month', now() at time zone 'Asia/Kolkata')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table lynkr_user_outreach add column if not exists contacts_count_month date not null default date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
create index if not exists lynkr_user_outreach_updated_idx on lynkr_user_outreach (updated_at);

-- Contacts: people we've reached out to.
-- Each contact has its own goal and intent, and a tier that controls the note budget.
-- The brief field stores at most 3 facts with sources, as a JSONB object.
create table if not exists contacts (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  name text not null,
  company text,
  role text,
  profile_url text check (
    profile_url ~ '^https://www.linkedin.com/in/[a-z0-9-]+/$'
    and profile_url !~ '\?[a-z]abc='
  ),
  relationship text check (relationship in ('stranger', 'alumni', 'knows_me')),
  bridge text not null check (bridge in ('knows_me', 'worked_studied', 'alumni', 'event', 'mutual_intro', 'public_work', 'live_role', 'none')),
  goal text not null check (goal in ('job', 'internship', 'referral', 'network', 'mentor', 'clients', 'hiring', 'funding', 'buy_business', 'partner', 'reconnect')),
  intent text not null check (intent in ('learn_role', 'work_question', 'feedback', 'explore_team', 'live_job', 'referral', 'follow_up', 'thank_you')),
  tier text not null check (tier in ('tier_1', 'tier_2')),
  source text check (source in ('connections', 'manual', 'finder', 'extension')),
  status text not null default 'to_contact' check (status in ('to_contact', 'invited', 'accepted', 'messaged', 'replied', 'outcome')),
  -- Stage dates (first to nil):
  invited_at timestamptz null,
  accepted_at timestamptz null,
  messaged_at timestamptz null,
  replied_at timestamptz null,
  outcome_at timestamptz null,
  -- Next action computed from stages and the 3B7 rule (not stored, but we keep next_action_at to speed queries):
  next_action_at timestamptz null,
  outcome text check (outcome in ('positive', 'negative', 'no_response')),
  note_used boolean not null default false,
  angle_used text check (angle_used ~ '^angle_[a-z0-9_]+$'),
  brief jsonb check (brief is null or length(brief::text) < 10_000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_user_status_idx on contacts (user_id, status);
create index if not exists contacts_user_goal_idx on contacts (user_id, goal);
create index if not exists contacts_user_tier_idx on contacts (user_id, tier);
create index if not exists contacts_user_source_idx on contacts (user_id, source);
create index if not exists contacts_user_created_idx on contacts (user_id, created_at desc);
create index if not exists contacts_user_next_action_idx on contacts (user_id, next_action_at);

-- Extension pairing: random tokens the Chrome extension uses for auth.
create table if not exists ext_tokens (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  last_used_at timestamptz null
);
create index if not exists ext_tokens_user_revoked_idx on ext_tokens (user_id, revoked_at);

-- AI spend for outreach: daily model-call caps at 60 per user per day.
create table if not exists outreach_daily_usage (
  user_id text not null references "user" ("id") on delete cascade,
  day date not null,
  chat_model_calls smallint not null default 0 check (chat_model_calls >= 0),
  primary key (user_id, day)
);
create index if not exists outreach_daily_usage_day_idx on outreach_daily_usage (day);