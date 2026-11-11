/**
 * Past-due grace (build plan B3, decision D-I5), behind LYNKR_PAST_DUE_GRACE=on.
 *
 * Dodo keeps full access while a subscription is `past_due` and moves it to on_hold or cancelled at
 * `past_due_ends_at`. That deadline is on webhook payloads only, so it is stored here when `subscription.past_due`
 * arrives. Access is still re-checked against Dodo: grace applies only when a live lookup returns `past_due` for the
 * Lynkr product and now is before the stored deadline (lib/billing.ts `subscriptionActive`).
 *
 * The deadline is cleared on subscription.active, renewed, on_hold, cancelled, failed and expired.
 */
import type { Db } from "./db";

export const PAST_DUE_GRACE_ENV = "LYNKR_PAST_DUE_GRACE";
/** Grace is on only when the switch is exactly "on". */
export const pastDueGraceOn = (): boolean => process.env[PAST_DUE_GRACE_ENV]?.trim() === "on";

export type GraceAction =
  | { action: "store"; subscriptionId: string; customerId: string; endsAt: Date }
  | { action: "clear"; subscriptionId: string };

const CLEARING = new Set(["subscription.active", "subscription.renewed", "subscription.on_hold", "subscription.cancelled", "subscription.failed", "subscription.expired"]);

type Payload = { type?: unknown; data?: { subscription_id?: unknown; customer?: { customer_id?: unknown }; past_due_ends_at?: unknown } };

/** What a Dodo webhook means for the stored grace deadline. Anything unrecognised or malformed means nothing. */
export function graceAction(payload: unknown): GraceAction | null {
  const p = payload as Payload | null;
  const type = typeof p?.type === "string" ? p.type : "";
  const d = p?.data;
  const subscriptionId = typeof d?.subscription_id === "string" ? d.subscription_id.trim() : "";
  if (!subscriptionId || subscriptionId.length > 200) return null;
  if (CLEARING.has(type)) return { action: "clear", subscriptionId };
  if (type !== "subscription.past_due") return null;
  const customerId = typeof d?.customer?.customer_id === "string" ? d.customer.customer_id.trim() : "";
  const endsAt = typeof d?.past_due_ends_at === "string" ? new Date(d.past_due_ends_at) : null;
  if (!customerId || customerId.length > 200 || !endsAt || Number.isNaN(endsAt.getTime())) return null;
  return { action: "store", subscriptionId, customerId, endsAt };
}

/** Applies a webhook to the table. Never throws: a failure here must not break the webhook's other work. */
export async function applyGraceWebhook(db: Db, payload: unknown): Promise<void> {
  const a = graceAction(payload);
  if (!a) return;
  try {
    if (a.action === "clear") await db.query("delete from billing_grace where subscription_id = $1", [a.subscriptionId]);
    else await db.query(
      `insert into billing_grace (subscription_id, customer_id, past_due_ends_at) values ($1, $2, $3)
       on conflict (subscription_id) do update set customer_id = excluded.customer_id, past_due_ends_at = excluded.past_due_ends_at, updated_at = now()`,
      [a.subscriptionId, a.customerId, a.endsAt],
    );
  } catch {
    /* the table may not exist yet (migration 006 not run): grace then simply never applies */
  }
}

/**
 * True when one of these live `past_due` subscriptions is still inside its stored grace window. A subscription with no
 * stored deadline gets no grace: nothing is guessed.
 */
export async function graceCovers(db: Db, customerId: string, pastDueSubscriptionIds: readonly string[], now: Date = new Date()): Promise<boolean> {
  if (!customerId || pastDueSubscriptionIds.length === 0) return false;
  try {
    const r = await db.query("select 1 from billing_grace where customer_id = $1 and subscription_id = any($2) and past_due_ends_at > $3 limit 1", [customerId, [...pastDueSubscriptionIds], now]);
    return r.rows.length > 0;
  } catch {
    return false;
  }
}
