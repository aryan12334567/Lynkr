/**
 * "Link my license key" (build plan B6b, decision D-X7). A key-only payer links a Dodo license key to their account;
 * from then on the account counts as paid for as long as Dodo says the key is valid (re-checked through the same
 * `validateLicense` every other key check uses, so Dodo stays the only source of truth).
 *
 * The key is a customer credential: it is stored encrypted (AES-256-GCM, key derived from BETTER_AUTH_SECRET), is
 * never returned by a route, is not in Download my data, and goes with the account when it is deleted.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Db } from "./db";

const purposeKey = (): Buffer => {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!secret) throw new Error("Accounts aren't configured.");
  return createHash("sha256").update(`lynkr-license-link:v1:${secret}`).digest();
};

/** Encrypts a key as base64(iv | tag | ciphertext). */
export function sealKey(key: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", purposeKey(), iv);
  const body = Buffer.concat([c.update(key, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

/** The key, or null when the text was altered or the secret changed. */
export function openKey(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64");
    if (raw.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", purposeKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function saveLink(db: Db, userId: string, key: string, instanceId: string): Promise<void> {
  await db.query(
    `insert into account_license (user_id, key_enc, instance_id) values ($1, $2, $3)
     on conflict (user_id) do update set key_enc = excluded.key_enc, instance_id = excluded.instance_id, linked_at = now()`,
    [userId, sealKey(key), instanceId],
  );
}

/** The linked key and its instance, for one user only. */
export async function getLink(db: Db, userId: string): Promise<{ key: string; instanceId: string } | null> {
  const r = await db.query<{ key_enc: string; instance_id: string }>("select key_enc, instance_id from account_license where user_id = $1", [userId]);
  const row = r.rows[0];
  if (!row) return null;
  const key = openKey(row.key_enc);
  return key ? { key, instanceId: row.instance_id } : null;
}

export async function removeLink(db: Db, userId: string): Promise<{ key: string; instanceId: string } | null> {
  const link = await getLink(db, userId);
  await db.query("delete from account_license where user_id = $1", [userId]);
  return link;
}

/** True when this user has a linked key that Dodo currently confirms. Never throws: any failure means not entitled. */
export async function linkedLicenseActive(db: Db, userId: string, validate: (key: string, instanceId: string) => Promise<boolean>): Promise<boolean> {
  try {
    const link = await getLink(db, userId);
    return link ? await validate(link.key, link.instanceId) : false;
  } catch {
    return false;
  }
}
