// B6b, "Link my license key" (decision D-X7): the key is stored encrypted, scoped to one account, and checked with Dodo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { getLink, linkedLicenseActive, openKey, removeLink, saveLink, sealKey } from "../lib/license-link";
import { deleteAll, exportAll, type Db } from "../lib/db";

const migrationFile = "007_account_license.sql";
const migration = readFileSync(new URL(`../scripts/migrations/${migrationFile}`, import.meta.url), "utf8");

async function fresh() {
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
  await pg.exec(migration);
  const db: Db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
  return { pg, db };
}

async function withSecret<T>(secret: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const saved = process.env.BETTER_AUTH_SECRET;
  if (secret === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = secret;
  try { return await run(); } finally { if (saved === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = saved; }
}

const KEY = "LKY-1234-ABCD-5678";

test("a key is encrypted: the stored text does not contain it, and it opens only with the same secret", async () => {
  await withSecret("secret-one", () => {
    const sealed = sealKey(KEY);
    assert.ok(!sealed.includes(KEY) && !Buffer.from(sealed, "base64").toString("utf8").includes(KEY));
    assert.equal(openKey(sealed), KEY);
    assert.notEqual(sealKey(KEY), sealed, "a fresh random IV each time");
  });
  const sealed = await withSecret("secret-one", () => sealKey(KEY));
  assert.equal(await withSecret("secret-two", () => openKey(sealed)), null, "a changed secret cannot open it");
  await withSecret("secret-one", () => {
    const raw = Buffer.from(sealed, "base64");
    raw[raw.length - 1] ^= 1;
    assert.equal(openKey(raw.toString("base64")), null, "a tampered value is refused");
    assert.equal(openKey("not base64 !!"), null);
    assert.equal(openKey(""), null);
  });
});

test("sealing without a secret fails instead of storing an unprotected key", async () => {
  await withSecret(undefined, () => assert.throws(() => sealKey(KEY), /aren't configured/));
});

test("a link is stored encrypted, belongs to one user, can be replaced and removed", async () => {
  await withSecret("secret-one", async () => {
    const { pg, db } = await fresh();
    await saveLink(db, "a", KEY, "inst_1");
    const stored = (await pg.query("select key_enc from account_license where user_id = 'a'")).rows[0] as { key_enc: string };
    assert.ok(!stored.key_enc.includes(KEY));
    assert.deepEqual(await getLink(db, "a"), { key: KEY, instanceId: "inst_1" });
    assert.equal(await getLink(db, "b"), null, "another user has no link");
    await saveLink(db, "a", "LKY-NEW", "inst_2");
    assert.deepEqual(await getLink(db, "a"), { key: "LKY-NEW", instanceId: "inst_2" });
    assert.equal(((await pg.query("select count(*)::int n from account_license")).rows[0] as { n: number }).n, 1);
    assert.deepEqual(await removeLink(db, "a"), { key: "LKY-NEW", instanceId: "inst_2" });
    assert.equal(await getLink(db, "a"), null);
    assert.equal(await removeLink(db, "a"), null);
    await pg.close();
  });
});

test("the account counts as paid only while Dodo confirms the linked key; any failure means not paid", async () => {
  await withSecret("secret-one", async () => {
    const { pg, db } = await fresh();
    assert.equal(await linkedLicenseActive(db, "a", async () => true), false, "nothing linked");
    await saveLink(db, "a", KEY, "inst_1");
    const asked: string[] = [];
    assert.equal(await linkedLicenseActive(db, "a", async (k, i) => { asked.push(`${k}|${i}`); return true; }), true);
    assert.deepEqual(asked, [`${KEY}|inst_1`]);
    assert.equal(await linkedLicenseActive(db, "a", async () => false), false, "Dodo says the key is no longer valid");
    assert.equal(await linkedLicenseActive(db, "a", async () => { throw new Error("down"); }), false, "a lookup that throws fails closed");
    assert.equal(await linkedLicenseActive(db, "b", async () => true), false, "another user's account is not covered");
    await pg.close();
  });
});

test("deleting the account removes the link, and the migration can be applied twice", async () => {
  await withSecret("secret-one", async () => {
    const { pg, db } = await fresh();
    await saveLink(db, "a", KEY, "inst_1");
    await pg.exec(migration);
    await pg.query(`delete from "user" where id = 'a'`);
    assert.equal(((await pg.query("select count(*)::int n from account_license")).rows[0] as { n: number }).n, 0);
    await pg.close();
  });
});

test("Delete my data removes the linked key, and Download my data never includes it", async () => {
  await withSecret("secret-one", async () => {
    const pg = new PGlite();
    await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
    for (const m of ["001_vertical1.sql", "002_outreach.sql", migrationFile]) await pg.exec(readFileSync(new URL(`../scripts/migrations/${m}`, import.meta.url), "utf8"));
    const db: Db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
    await saveLink(db, "a", KEY, "inst_1");
    await saveLink(db, "b", "LKY-OTHER", "inst_9");
    const exported = await exportAll(db, "a");
    assert.ok(!("account_license" in exported));
    assert.ok(!JSON.stringify(exported).includes(KEY));
    const counts = await deleteAll(db, "a");
    assert.equal(counts.account_license, 1);
    assert.equal(await getLink(db, "a"), null);
    assert.deepEqual(await getLink(db, "b"), { key: "LKY-OTHER", instanceId: "inst_9" }, "another user's key is untouched");
    await pg.close();
  });
});
