import { accountContext, requireAccountForFree } from "@/lib/account";
import { cleanStrings } from "@/lib/clean";
import { resolveContext } from "@/lib/context";
import { takeDaily } from "@/lib/db";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { checkLimits } from "@/lib/limit";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { mockGenerate } from "@/lib/mock";
import { firstWinSystem, generateUser } from "@/lib/prompts";
import { FirstWinReply, FirstWinRequest, type FactRef } from "@/lib/schemas";

export const maxDuration = 60;

/** Free with a signed-in account (decision 1): a few first drafts per person per day. */
const DAILY_FIRST_WINS = 5;

/** Fact ids belong in factRefs, never in the text the person copies. */
const stripIds = (s: string) => s.replace(/\s*\(?\b(?:F\d{1,2})(?:\s*,\s*F\d{1,2})*\)?(?=[\s.,;:!?]|$)/g, "").replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:!?])/g, "$1");

/**
 * The first win (build plan Part 5): right after the read-back, a new headline and one referral
 * message from the existing draft writer's rules, using only confirmed facts, with [[blanks]] for gaps.
 * Signed in with account storage, the facts and profile come from the account.
 */
export async function POST(req: Request) {
  const gate = await requireAccountForFree(req);
  if ("error" in gate) return gate.error;
  const read = await readJson(req, BODY_LIMIT.firstWin);
  if ("error" in read) return read.error;
  const parsed = FirstWinRequest.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Confirm your summary first, then try again." }, { status: 400 });
  const { profile, facts } = await resolveContext(req, parsed.data, "all");
  const ids = new Set(facts.map((f: FactRef) => f.id));

  if (isMock()) {
    const m = mockGenerate(profile, facts);
    return Response.json({ headline: m.profile.headlines[0], referral: { ...m.outreach.referral, factRefs: m.outreach.referral.factRefs.filter((r) => ids.has(r)) } } satisfies FirstWinReply);
  }

  const limited = checkLimits(req, "generate");
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const ctx = gate.user ? await accountContext(req) : null;
  if (ctx && !(await takeDaily(ctx.db, ctx.userId, "first_win", DAILY_FIRST_WINS))) {
    return Response.json({ error: "You've written today's free drafts. Come back tomorrow, or subscribe for the full set." }, { status: 429 });
  }
  try {
    const r = cleanStrings(
      await callStructured({
        system: firstWinSystem(profile.bucket),
        user: generateUser(profile, facts, "", ""),
        schema: FirstWinReply,
        effort: "low",
        maxTokens: 4000,
      }),
    );
    return Response.json({
      headline: stripIds(r.headline).slice(0, 220),
      referral: { ...r.referral, body: stripIds(r.referral.body), factRefs: r.referral.factRefs.filter((x) => ids.has(x)) },
    } satisfies FirstWinReply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
