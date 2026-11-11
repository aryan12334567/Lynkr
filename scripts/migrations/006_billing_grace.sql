-- Past-due grace (build plan B3, decision D-I5). Dodo sends the end of the grace window only on webhook payloads
-- (`past_due_ends_at`), never on the subscription list, so the deadline is stored here when the webhook arrives.
-- Keyed by Dodo's subscription id, not by Lynkr user, so a key-only subscriber is covered too.
-- Safe to run again: every statement is IF NOT EXISTS. No deletes.

create table if not exists billing_grace (
  subscription_id text primary key,
  customer_id text not null,
  past_due_ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists billing_grace_customer_idx on billing_grace (customer_id);
