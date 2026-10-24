import { accountContext } from "./account";
import { confirmedFacts, getBrief } from "./db";
import { ProfileInput, type FactRef, type StoryFact } from "./schemas";

/**
 * Every AI request reads the person's context from their account when it's there (build plan
 * Part 1b), so features can't disagree. Requests keep their old shape: the facts and profile the
 * browser sends are used only when nothing is stored in the account (signed out, a license key
 * without an account, or account storage not set up yet).
 */

const toRef = (f: StoryFact): FactRef => ({ id: f.id, kind: f.kind, text: f.text.slice(0, 400) });

/**
 * "all": the drafting route uses every confirmed fact in the account.
 * "picked": routes where the person chose a few facts use those ids, with the account's wording.
 * Facts the account doesn't know (not synced yet) fall back to what the browser sent.
 */
export function mergeFacts(account: StoryFact[] | null, sent: FactRef[], mode: "all" | "picked"): FactRef[] {
  if (!account || account.length === 0) return sent;
  const byId = new Map(account.map((f) => [f.id, f]));
  if (mode === "all") return account.map(toRef).slice(0, 20);
  return sent.map((s) => (byId.has(s.id) ? toRef(byId.get(s.id)!) : s));
}

/** The account's brief wins when it's a valid profile; otherwise the browser's. */
export function mergeProfile(account: unknown, sent: ProfileInput): ProfileInput {
  if (!account) return sent;
  const p = ProfileInput.safeParse(account);
  return p.success ? p.data : sent;
}

export async function resolveContext<T extends { facts?: FactRef[]; profile?: ProfileInput }>(
  req: Request,
  body: T,
  mode: "all" | "picked",
): Promise<T> {
  const ctx = await accountContext(req).catch(() => null);
  if (!ctx) return body;
  const [facts, brief] = await Promise.all([confirmedFacts(ctx.db, ctx.userId), body.profile ? getBrief(ctx.db, ctx.userId) : Promise.resolve(null)]);
  return {
    ...body,
    ...(body.facts ? { facts: mergeFacts(facts, body.facts, mode) } : {}),
    ...(body.profile ? { profile: mergeProfile(brief?.data, body.profile) } : {}),
  };
}
