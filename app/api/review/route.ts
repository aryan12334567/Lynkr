import { resolveContext } from "@/lib/context";
import { requireLicense } from "@/lib/billing";
import { ReviewReply, ReviewRequest } from "@/lib/schemas";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { REVIEW_SYSTEM, reviewUser } from "@/lib/prompts";
import { checkLimits } from "@/lib/limit";
import { cleanStrings } from "@/lib/clean";

export const maxDuration = 60;

/** Optional AI review of one message. Opt-in, and only the message, anchor and picked facts are sent. */
export async function POST(req: Request) {
  // Paid access: a no-op unless LYNKR_PAYWALL=1.
  const locked = await requireLicense(req);
  if (locked) return locked;
  const read = await readJson(req, BODY_LIMIT.review);
  if ("error" in read) return read.error;
  const parsed = ReviewRequest.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Paste a message of up to 3,000 characters." }, { status: 400 });
  if (isMock()) {
    return Response.json({ error: "AI review needs an AI key, so it isn't available in demo mode. The rule-based checks above still work." }, { status: 422 });
  }
  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const { text, channel, intent, relationship, anchor, facts, tone } = await resolveContext(req, parsed.data, "picked");
  try {
    const reply = cleanStrings(await callStructured({ system: REVIEW_SYSTEM, user: reviewUser(text, channel, intent, relationship, anchor, facts, tone), schema: ReviewReply, effort: "low", maxTokens: 2000 }));
    // Only edits that point at real text in the message.
    // Only edits that change a real phrase: no single-character "finds", no sign-offs or name placeholders added.
    const edits = reply.edits.filter(
      (e) => e.find.trim().length >= 6 && text.includes(e.find) && e.replace.trim() !== e.find.trim() && !/\b(thanks|regards|best),?\s*\[\[|\[\[your ?name\]\]/i.test(e.replace),
    );
    return Response.json({ ...reply, edits: edits.slice(0, 4) } satisfies ReviewReply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
