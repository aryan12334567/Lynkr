import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CommentAngle, CommentGoal } from "../schemas";

/**
 * A signed log receipt (Commenter plan KTD9). Each option the writer returns carries one. The log accepts only
 * `{receipt, body}`: the server checks the signature, the expiry and that the body is the one that was signed, then
 * stores the fields that were signed. Nothing the client invents can be stored, and nothing is stored at generation time.
 *
 * The key is derived from COMMENT_RECEIPT_SECRET when set, otherwise from BETTER_AUTH_SECRET (no new secret to
 * configure; rotating it only invalidates receipts that are under 24 hours old).
 */

export const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

export type ReceiptFields = {
  userId: string;
  authorName: string;
  authorHeadline: string;
  body: string;
  goal: CommentGoal;
  angle: CommentAngle;
  source: "extension" | "web";
};

type Payload = Omit<ReceiptFields, "body"> & { bodyHash: string; id: string; exp: number };

const key = (): Buffer => {
  const secret = (process.env.COMMENT_RECEIPT_SECRET || process.env.BETTER_AUTH_SECRET || "").trim();
  if (!secret) throw new Error("Receipts aren't configured.");
  return createHash("sha256").update(`lynkr-comment-receipt:v1:${secret}`).digest();
};
const hashBody = (b: string) => createHash("sha256").update(b).digest("hex");
const sign = (data: string) => createHmac("sha256", key()).update(data).digest("base64url");

export function signReceipt(f: ReceiptFields, now = Date.now()): string {
  const { body, ...rest } = f;
  const p: Payload = { ...rest, bodyHash: hashBody(body), id: randomUUID(), exp: now + RECEIPT_TTL_MS };
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export type Verified = Omit<ReceiptFields, "body"> & { id: string };

/** The signed fields, or null when the receipt is forged, expired, for another user, or the body does not match. */
export function verifyReceipt(receipt: string, body: string, userId: string, now = Date.now()): Verified | null {
  try {
    const [data, sig] = receipt.split(".");
    if (!data || !sig) return null;
    const want = Buffer.from(sign(data));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Payload;
    if (p.userId !== userId || p.exp < now || p.bodyHash !== hashBody(body)) return null;
    const { bodyHash: _h, exp: _e, ...rest } = p;
    void _h; void _e;
    return rest;
  } catch {
    return null;
  }
}
