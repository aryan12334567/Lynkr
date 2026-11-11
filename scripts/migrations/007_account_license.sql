-- "Link my license key" (build plan B6b, decision D-X7): a key-only payer links the key to their account, so
-- account-only features keep working. The key is a customer credential, so it is stored encrypted
-- (lib/license-link.ts); it is never exported and never returned by any route.
-- Removed with the account. Safe to run again: IF NOT EXISTS. No deletes.

create table if not exists account_license (
  user_id text primary key references "user" ("id") on delete cascade,
  key_enc text not null,
  instance_id text not null,
  linked_at timestamptz not null default now()
);
