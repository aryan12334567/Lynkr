import { z } from "zod";
import { readJson } from "@/lib/http";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
import { recordFromReceipt, setPosted } from "@/lib/comment/log";
import { verifyReceipt } from "@/lib/comment/receipt";
import { commenterSwitch } from "@/lib/comment/flags";
import { bumpMetric } from "@/lib/db";

export const maxDuration = 30;
export const OPTIONS = preflight;

const Log = z.object({ receipt: z.string().min(10).max(2000), body: z.string().min(1).max(1200), via: z.enum(["insert", "copy"]).optional() }).strict();
const Posted = z.object({ id: z.string().uuid(), posted: z.boolean().nullable() }).strict();

/**
 * The log of what the person inserted or copied (Commenter plan KTD9). Only `{receipt, body}` is accepted: a forged,
 * expired, other-user's or mismatched receipt is a 400 and writes nothing. The same option twice is one row.
 */
export async function POST(req: Request) {
  const auth = await extensionAuth(req);
  if ("error" in auth) return auth.error;
  if (commenterSwitch() !== "on") return extJson(req, { error: "Comments aren't switched on yet." }, 404);
  const read = await readJson(req, 8192);
  if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
  const body = Log.safeParse(read.body);
  if (!body.success) return extJson(req, { error: "Invalid request." }, 400);
  const v = verifyReceipt(body.data.receipt, body.data.body, auth.userId);
  if (!v) return extJson(req, { error: "That comment can't be logged." }, 400);
  try {
    const entry = await recordFromReceipt(auth.db, auth.userId, v, body.data.body);
    if (!entry) return extJson(req, { error: "Today's log limit is used up." }, 429);
    try { await bumpMetric(auth.db, body.data.via === "copy" ? "comment_copied" : "comment_inserted", `${v.goal}:${v.angle}`); } catch { /* count only */ }
    return extJson(req, { entry: { id: entry.id, posted: entry.posted } });
  } catch {
    return extJson(req, { error: "The log is unavailable right now." }, 503);
  }
}

/** "Posted / Not posted": only the person's own row. null clears the answer. */
export async function PATCH(req: Request) {
  const auth = await extensionAuth(req);
  if ("error" in auth) return auth.error;
  const read = await readJson(req, 1024);
  if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
  const body = Posted.safeParse(read.body);
  if (!body.success) return extJson(req, { error: "Invalid request." }, 400);
  try {
    const entry = await setPosted(auth.db, auth.userId, body.data.id, body.data.posted);
    if (!entry) return extJson(req, { error: "Not found." }, 404);
    if (body.data.posted) { try { await bumpMetric(auth.db, "comment_posted", `${entry.goal}:${entry.angle}`); } catch { /* count only */ } }
    return extJson(req, { entry: { id: entry.id, posted: entry.posted } });
  } catch {
    return extJson(req, { error: "The log is unavailable right now." }, 503);
  }
}
