import { z } from "zod";
import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { requireLicense } from "@/lib/billing";
import { sessionUser } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { listPosted, recordFromReceipt, removeEntry, setPosted } from "@/lib/comment/log";
import { verifyReceipt } from "@/lib/comment/receipt";
import { commenterSwitch } from "@/lib/comment/flags";

export const maxDuration = 30;

const Log = z.object({ receipt: z.string().min(10).max(2000), body: z.string().min(1).max(1200) }).strict();
const Mark = z.object({ id: z.string().uuid(), posted: z.boolean().nullable() }).strict();
const Del = z.object({ id: z.string().uuid() }).strict();

/**
 * "Comments you've written" (Commenter plan R14, R19). Reading and deleting stay open to a signed-in person whose
 * subscription has lapsed: they can always see and remove their own data. Writing (logging, Posted) is paid.
 *   GET ?since=ISO   -> { entries }   the last 50 posted entries, newest first
 *   POST {receipt, body}   -> { entry }   the web helper's Copy
 *   PATCH {id, posted}     -> { entry }
 *   DELETE {id}            -> { ok }
 */
export async function GET(req: Request) {
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return Response.json({ entries: [] });
  const raw = new URL(req.url).searchParams.get("since");
  const since = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : undefined;
  try {
    return Response.json({ entries: await listPosted(ctx.db, ctx.userId, 50, since) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ entries: [] }); // before migration 004
  }
}

export async function POST(req: Request) {
  if (commenterSwitch() !== "on") return Response.json({ error: "Comments aren't switched on yet." }, { status: 404 });
  if (!(await sessionUser(req))) return unauthorized();
  const locked = await requireLicense(req);
  if (locked) return locked;
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 8192);
  if ("error" in read) return read.error;
  const body = Log.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const v = verifyReceipt(body.data.receipt, body.data.body, ctx.userId);
  if (!v) return Response.json({ error: "That comment can't be logged." }, { status: 400 });
  const entry = await recordFromReceipt(ctx.db, ctx.userId, v, body.data.body);
  if (!entry) return Response.json({ error: "Today's log limit is used up." }, { status: 429 });
  return Response.json({ entry: { id: entry.id, posted: entry.posted } });
}

export async function PATCH(req: Request) {
  if (!(await sessionUser(req))) return unauthorized();
  const locked = await requireLicense(req);
  if (locked) return locked;
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 1024);
  if ("error" in read) return read.error;
  const body = Mark.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const entry = await setPosted(ctx.db, ctx.userId, body.data.id, body.data.posted);
  return entry ? Response.json({ entry }) : Response.json({ error: "Not found." }, { status: 404 });
}

export async function DELETE(req: Request) {
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 1024);
  if ("error" in read) return read.error;
  const body = Del.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return (await removeEntry(ctx.db, ctx.userId, body.data.id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
}
