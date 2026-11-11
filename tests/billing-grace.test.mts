// B3, past-due grace (decision D-I5): the deadline comes from Dodo's webhook, access still follows Dodo's live status.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { applyGraceWebhook, graceAction, graceCovers, pastDueGraceOn, PAST_DUE_GRACE_ENV } from "../lib/billing-grace";
import { inPastDueGrace } from "../lib/billing";
import type { Db } from "../lib/db";

const migration = readFileSync(new URL("../scripts/migrations/006_billing_grace.sql", import.meta.url), "utf8");

async function fresh() {
  const pg = new PGlite();
  await pg.exec(migration);
  const db: Db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
  return { pg, db };
}

const day = 24 * 60 * 60_000;
const pastDue = (sub: string, customer: string, endsAt: Date) => ({ type: "subscription.past_due", data: { subscription_id: sub, customer: { customer_id: customer }, past_due_ends_at: endsAt.toISOString() } });
const event = (type: string, sub: string) => ({ type, data: { subscription_id: sub, customer: { customer_id: "cus_1" } } });
/** A Dodo client that lists the given past_due subscription ids. */
const client = (ids: string[]) => ({ subscriptions: { list: async () => ({ items: ids.map((subscription_id) => ({ subscription_id })) }) } }) as unknown as Parameters<typeof inPastDueGrace>[0];

test("the switch is on only when exactly 'on'", () => {
  const saved = process.env[PAST_DUE_GRACE_ENV];
  try {
    for (const v of [undefined, "", "1", "true", "ON", "off"]) { if (v === undefined) delete process.env[PAST_DUE_GRACE_ENV]; else process.env[PAST_DUE_GRACE_ENV] = v; assert.equal(pastDueGraceOn(), false, String(v)); }
    process.env[PAST_DUE_GRACE_ENV] = "on";
    assert.equal(pastDueGraceOn(), true);
  } finally { if (saved === undefined) delete process.env[PAST_DUE_GRACE_ENV]; else process.env[PAST_DUE_GRACE_ENV] = saved; }
});

test("past_due stores the deadline; every other lifecycle event clears it; junk means nothing", () => {
  const ends = new Date(Date.now() + 3 * day);
  assert.deepEqual(graceAction(pastDue("sub_1", "cus_1", ends)), { action: "store", subscriptionId: "sub_1", customerId: "cus_1", endsAt: ends });
  for (const t of ["subscription.active", "subscription.renewed", "subscription.on_hold", "subscription.cancelled", "subscription.failed", "subscription.expired"]) {
    assert.deepEqual(graceAction(event(t, "sub_1")), { action: "clear", subscriptionId: "sub_1" }, t);
  }
  for (const junk of [null, undefined, {}, "x", { type: "subscription.past_due" }, event("payment.succeeded", "sub_1"), event("subscription.plan_changed", "sub_1"),
    { type: "subscription.past_due", data: { subscription_id: "sub_1", customer: { customer_id: "cus_1" }, past_due_ends_at: "not a date" } },
    { type: "subscription.past_due", data: { subscription_id: "sub_1", customer: { customer_id: "cus_1" } } },
    { type: "subscription.past_due", data: { subscription_id: "sub_1", past_due_ends_at: ends.toISOString() } },
    { type: "subscription.past_due", data: { subscription_id: "x".repeat(300), customer: { customer_id: "cus_1" }, past_due_ends_at: ends.toISOString() } }]) {
    assert.equal(graceAction(junk), null, JSON.stringify(junk)?.slice(0, 60));
  }
});

test("grace covers a stored, unexpired deadline only, and only for the listed subscriptions", async () => {
  const { pg, db } = await fresh();
  const now = new Date();
  await applyGraceWebhook(db, pastDue("sub_open", "cus_1", new Date(now.getTime() + 2 * day)));
  await applyGraceWebhook(db, pastDue("sub_over", "cus_2", new Date(now.getTime() - 60_000)));
  assert.equal(await graceCovers(db, "cus_1", ["sub_open"], now), true);
  assert.equal(await graceCovers(db, "cus_1", ["sub_other"], now), false, "a subscription with no stored deadline gets no grace");
  assert.equal(await graceCovers(db, "cus_1", [], now), false);
  assert.equal(await graceCovers(db, "cus_2", ["sub_over"], now), false, "after the deadline");
  assert.equal(await graceCovers(db, "cus_2", ["sub_open"], now), false, "another customer's subscription");
  assert.equal(await graceCovers(db, "", ["sub_open"], now), false);
  await pg.close();
});

test("a later event moves or clears the deadline, and a repeated webhook changes nothing", async () => {
  const { pg, db } = await fresh();
  const now = new Date();
  const soon = new Date(now.getTime() + day);
  await applyGraceWebhook(db, pastDue("sub_1", "cus_1", soon));
  await applyGraceWebhook(db, pastDue("sub_1", "cus_1", soon));
  assert.equal(((await pg.query("select count(*)::int n from billing_grace")).rows[0] as { n: number }).n, 1);
  await applyGraceWebhook(db, pastDue("sub_1", "cus_1", new Date(now.getTime() + 5 * day)));
  assert.equal(await graceCovers(db, "cus_1", ["sub_1"], new Date(now.getTime() + 3 * day)), true, "the deadline moved");
  for (const t of ["subscription.active", "subscription.cancelled"]) {
    await applyGraceWebhook(db, pastDue("sub_1", "cus_1", soon));
    await applyGraceWebhook(db, event(t, "sub_1"));
    assert.equal(await graceCovers(db, "cus_1", ["sub_1"], now), false, `${t} clears it`);
  }
  await pg.close();
});

test("the live lookup decides: past_due must still be listed by Dodo, and the deadline must not have passed", async () => {
  const { pg, db } = await fresh();
  const now = new Date();
  await applyGraceWebhook(db, pastDue("sub_1", "cus_1", new Date(now.getTime() + day)));
  assert.equal(await inPastDueGrace(client(["sub_1"]), "cus_1", db, now), true);
  assert.equal(await inPastDueGrace(client([]), "cus_1", db, now), false, "Dodo no longer lists it as past_due");
  assert.equal(await inPastDueGrace(client(["sub_9"]), "cus_1", db, now), false, "no stored deadline for that subscription");
  assert.equal(await inPastDueGrace(client(["sub_1"]), "cus_1", db, new Date(now.getTime() + 2 * day)), false, "deadline passed");
  await pg.close();
});

test("without the table (migration 006 not run) a webhook does not throw and grace never applies", async () => {
  const pg = new PGlite();
  const db: Db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
  await applyGraceWebhook(db, pastDue("sub_1", "cus_1", new Date(Date.now() + day)));
  assert.equal(await graceCovers(db, "cus_1", ["sub_1"]), false);
  await pg.close();
});

test("migration 006 can be applied twice", async () => {
  const { pg } = await fresh();
  await pg.exec(migration);
  assert.equal(((await pg.query("select count(*)::int n from billing_grace")).rows[0] as { n: number }).n, 0);
  await pg.close();
});
