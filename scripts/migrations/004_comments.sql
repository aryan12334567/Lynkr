-- Commenter log (build plan U1, KTD5). One row per comment option the person inserted or copied, written only from a
-- signed receipt (lib/comment/receipt.ts), so nothing the client invents is stored. The post text is never stored.
-- Only rows marked posted count toward the week or warm Outreach. Unposted rows are removed after 7 days, all rows
-- after 12 months (lib/comment/log.ts, called by the daily cleanup). Safe to run again: IF NOT EXISTS. No deletes.

create table if not exists comment_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  author_name text check (char_length(author_name) <= 120),
  author_headline text check (char_length(author_headline) <= 220),
  body text not null check (char_length(body) between 1 and 1200),
  goal text not null check (goal in ('job_seeker', 'freelancer', 'visibility')),
  angle text not null check (angle in ('experience', 'add', 'question')),
  source text not null check (source in ('extension', 'web')),
  posted boolean,
  contact_id text references contacts (id) on delete set null,
  receipt_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists comment_log_user_created_idx on comment_log (user_id, created_at desc);
