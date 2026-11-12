import { z } from "zod";
import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { requireLicense } from "@/lib/billing";
import { sessionUser } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { linkEntry, linkedFor, suggestForName } from "@/lib/comment/link";

export const maxDuration = 30;

const Link = z.object({ id: z.string().uuid(), contactId: z.string().min(1).max(64).nullable() }).strict();

/**
 * Warming Outreach (Commenter plan R17).
 *   GET ?name=Priya%20Shah        -> { suggestions }  posted comments on a post by someone with that name; the person picks
 *   GET ?contactId=...            -> { linked }       the posted comment already linked to that contact, or null
 *   POST {id, contactId | null}   -> { ok }           only a confirmed link sets it; null removes it
 */
export async function GET(req: Request) {
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return Response.json({ suggestions: [] });
  const params = new URL(req.url).searchParams;
  const contactId = params.get("contactId")?.slice(0, 64);
  if (contactId) {
    try {
      const e = await linkedFor(ctx.db, ctx.userId, contactId);
      return Response.json({ linked: e ? { id: e.id, createdAt: e.createdAt } : null }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ linked: null });
    }
  }
  const name = params.get("name")?.slice(0, 120) ?? "";
  try {
    const found = await suggestForName(ctx.db, ctx.userId, name);
    return Response.json({ suggestions: found.map((e) => ({ id: e.id, authorName: e.authorName, authorHeadline: e.authorHeadline, createdAt: e.createdAt })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ suggestions: [] }); // before migration 004
  }
}

export async function POST(req: Request) {
  if (!(await sessionUser(req))) return unauthorized();
  const locked = await requireLicense(req);
  if (locked) return locked;
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 1024);
  if ("error" in read) return read.error;
  const body = Link.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  return (await linkEntry(ctx.db, ctx.userId, body.data.id, body.data.contactId)) ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
}
