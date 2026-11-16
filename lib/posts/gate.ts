import { accountContext, noCloud, unauthorized, type AccountCtx } from "../account";
import { sessionUser } from "../auth";
import { requireLicense } from "../billing";
import type { Db } from "../db";
import { postsVersion } from "./flags";

/**
 * What every Posts route checks first, in this order: the switch (404 "Not found." unless v2), a session (401), the licence
 * when the route writes or drafts (402), the account database (409), and that migration 003 has run (409).
 * Reading your own posts needs only a session.
 */
export async function postsGate(req: Request, opts: { paid: boolean }): Promise<{ ctx: AccountCtx } | { error: Response }> {
  if (postsVersion() !== "v2") return { error: Response.json({ error: "Not found." }, { status: 404 }) };
  if (!(await sessionUser(req))) return { error: unauthorized() };
  if (opts.paid) {
    const locked = await requireLicense(req);
    if (locked) return { error: locked };
  }
  const ctx = await accountContext(req);
  if (!ctx) return { error: noCloud() };
  if (!(await postsReady(ctx.db))) return { error: Response.json({ error: "Posts aren't available yet." }, { status: 409 }) };
  return { ctx };
}

async function postsReady(db: Db): Promise<boolean> {
  try {
    return Boolean((await db.query<{ t: string | null }>("select to_regclass('public.posts')::text as t")).rows[0]?.t);
  } catch {
    return false;
  }
}

export const notFound = () => Response.json({ error: "That post was not found." }, { status: 404 });
