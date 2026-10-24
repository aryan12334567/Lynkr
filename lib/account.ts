import { z } from "zod";
import { accountsConfigured, sessionUser } from "./auth";
import { hasValidLicense, paywallEnabled } from "./billing";
import { cloudReady, getDb, touchUser, type Db, type Settings } from "./db";
import { FACT_KINDS } from "./schemas";

/**
 * Who is asking, and whether their context lives in the account (build plan Part 1b).
 * "Cloud" means signed in AND the database has migration 001. Otherwise everything keeps
 * working from the browser, as before.
 */
export type AccountCtx = { userId: string; email: string; db: Db; settings: Settings };

export async function accountContext(req: Request): Promise<AccountCtx | null> {
  const user = await sessionUser(req);
  if (!user || !(await cloudReady())) return null;
  const db = getDb();
  const settings = await touchUser(db, user.id);
  return { userId: user.id, email: user.email, db, settings };
}

/**
 * The free part (interview, Story Vault, first draft) comes before the paywall but needs a
 * signed-in account when the paywall is on. A license key bought before accounts existed also
 * works, with the context kept in the browser until its owner creates an account. Returns the
 * response to send back, or the user (null when there's no account: local development or a key).
 */
export async function requireAccountForFree(req: Request): Promise<{ user: { id: string; email: string } | null } | { error: Response }> {
  const user = await sessionUser(req);
  if (user) return { user: { id: user.id, email: user.email } };
  if (!paywallEnabled() || (await hasValidLicense(req))) return { user: null };
  if (accountsConfigured()) {
    return { error: Response.json({ error: "Create a free account or sign in to start your interview.", code: "account_required" }, { status: 401 }) };
  }
  // Paywall on but accounts off: there's no free path, so this is paid like everything else.
  return { error: Response.json({ error: "An active subscription is needed. Subscribe, or enter your license key.", code: "subscription_required" }, { status: 402 }) };
}

/** A Story Vault fact as sent by the browser (edits, confirmations, moving browser data). */
export const StoryFactInput = z.object({
  id: z.string().trim().min(1).max(12),
  kind: z.enum(FACT_KINDS),
  text: z.string().trim().min(1).max(400),
  sourceTurnIds: z.array(z.number().int()).max(20).default([]),
  reviewStatus: z.enum(["candidate", "confirmed", "excluded"]),
  useInDrafts: z.boolean(),
  sourceQid: z.string().max(8).optional(),
  confidence: z.object({ example: z.boolean(), number: z.enum(["measured", "estimate", "none"]), iDid: z.boolean() }).optional(),
  updatedAt: z.string().max(40).optional(),
});

export const unauthorized = () => Response.json({ error: "Please sign in first." }, { status: 401 });
export const noCloud = () => Response.json({ error: "Saving to your account isn't available yet. Your work is kept in this browser." }, { status: 409 });
