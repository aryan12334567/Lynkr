-- Outreach timeline (build plan KTD14): one events table per contact, and a summary on the contact
-- that lib/outreach/timeline.ts rewrites from those events inside the same transaction.
-- Runs after 002 (contacts). Safe to run again: tables and columns are IF NOT EXISTS, and the one
-- constraint swap below drops and re-adds the same named check.

create table if not exists outreach_events (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  contact_id text not null references contacts (id) on delete cascade,
  kind text not null check (kind in (
    'why', 'invite_sent', 'accepted', 'message_sent', 'reply', 'meeting_booked', 'meeting_done', 'thank_you',
    'follow_up', 'second_person', 'check_in', 'referral_ask', 'reschedule', 'withdraw', 'goal_reached', 'closed'
  )),
  status text not null check (status in ('due', 'done', 'superseded')),
  due_at timestamptz null,
  done_at timestamptz null,
  meeting_at timestamptz null,
  happened text check (happened in ('yes', 'no_show', 'moved')),
  rating text check (rating in ('good', 'neutral', 'bad')),
  note text check (char_length(note) <= 280),
  -- The reason text a suggestion was made for.
  rule text,
  superseded_reason text check (superseded_reason in ('moved', 'reply', 'dismissed', 'undone', 'finished')),
  supersedes_id text references outreach_events (id) on delete set null,
  -- The event that caused a suggestion.
  trigger_id text references outreach_events (id) on delete set null,
  -- Chosen by the caller; unique per user, so a retried change never adds a second event.
  op_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, op_id)
);
create index if not exists outreach_events_contact_idx on outreach_events (user_id, contact_id, created_at);
create index if not exists outreach_events_due_idx on outreach_events (user_id, status, due_at);
create index if not exists outreach_events_meeting_idx on outreach_events (user_id, kind, meeting_at);

alter table contacts add column if not exists why_text text check (char_length(why_text) <= 200);
alter table contacts add column if not exists why_source text check (why_source in ('comment', 'finder', 'connections', 'manual'));
alter table contacts add column if not exists goal_reached_at timestamptz null;
alter table contacts add column if not exists closed_at timestamptz null;

-- 002 declared the status check inline, so Postgres named it contacts_status_check. Swap it to allow 'meeting'.
alter table contacts drop constraint if exists contacts_status_check;
alter table contacts add constraint contacts_status_check
  check (status in ('to_contact', 'invited', 'accepted', 'messaged', 'replied', 'meeting', 'outcome'));
