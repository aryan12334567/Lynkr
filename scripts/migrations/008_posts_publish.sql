-- Posts scheduling and publishing (Posts build plan U7 to U9). Extends 003: the status check there already allows
-- scheduled, publishing, published, failed and unknown. publish_mode is 'manual' (a reminder; the person posts it on
-- LinkedIn and marks it posted) or 'auto' (the server publishes it once). Safe to run again: IF NOT EXISTS. No deletes.

alter table posts add column if not exists publish_mode text check (publish_mode is null or publish_mode in ('manual', 'auto'));
alter table posts add column if not exists published_at timestamptz;
alter table posts add column if not exists linkedin_urn text;
alter table posts add column if not exists fail_reason text;
alter table posts add column if not exists last_op_id text;
alter table posts add column if not exists claimed_at timestamptz;

create index if not exists posts_due_idx on posts (scheduled_at) where status = 'scheduled' and publish_mode = 'auto';
