import { requireLicense } from "@/lib/billing";
import { ConnectReply, ConnectRequest } from "@/lib/schemas";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { CONNECT_SYSTEM, connectUser } from "@/lib/prompts";
import { validateImage } from "@/lib/connect";
import { composeNote, contactDecision } from "@/lib/packet";
import { checkLimits } from "@/lib/limit";
import { CHANNEL_RULES } from "@/lib/checker";
import { cleanStrings } from "@/lib/clean";

export const maxDuration = 60;

export async function POST(req: Request) {
  // Paid access: a no-op unless LYNKR_PAYWALL=1.
  const locked = await requireLicense(req);
  if (locked) return locked;
  const read = await readJson(req, BODY_LIMIT.connect);
  if ("error" in read) return read.error;
  const parsed = ConnectRequest.safeParse(read.body);
  if (!parsed.success) {
    return Response.json({ error: "Check the person details. Pasted text is up to 4,000 characters; screenshots are PNG, JPG or WebP under 4 MB." }, { status: 400 });
  }
  const { profile, facts, packet, text, image } = parsed.data;
  if (image) {
    const bad = validateImage(image.media_type, image.data);
    if (bad) return Response.json({ error: bad }, { status: 413 });
  }

  // The contact decision is the same in both modes and runs before any AI call.
  const decision = contactDecision(packet);
  if (isMock() || decision.status !== "good") {
    if (isMock() && image && decision.status === "good") {
      return Response.json(
        { error: "Reading screenshots needs an AI key, so it isn't available in demo mode. Write what you noticed in your own words instead." },
        { status: 422 },
      );
    }
    return Response.json(composeNote(profile, packet, facts) satisfies ConnectReply);
  }

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const rule = CHANNEL_RULES[packet.channel];
    const size = (b: string) => (rule.unit === "chars" ? b.length : b.trim() ? b.trim().split(/\s+/).length : 0);
    // One message for one channel: no labels like "email:", nothing over the limit.
    // Lynkr's own check already found a good reason to write, so "needs context" from the model is a
    // miss, not a verdict: retry, then fall back. A "do not send" from the model is respected.
    const bad = (r: ConnectReply) =>
      r.fitStatus === "needs_context" ||
      (r.fitStatus === "ready_for_review" && (size(r.body) > rule.max || /\b(connection_note|linkedin_message|inmail|email)\s*:/i.test(r.body)));
    let reply: ConnectReply | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = cleanStrings(
        await callStructured({
          system: CONNECT_SYSTEM,
          user:
            connectUser(profile, facts, packet, text) +
            (attempt
              ? `\n\nYour last draft broke the rules. The anchor and the ask above are specific enough: set fitStatus "ready_for_review" and write ONE ${CHANNEL_RULES[packet.channel].label} only, at most ${rule.max} ${rule.unit === "chars" ? "characters" : "words"}, with no labels. Drop the fact sentence if that is what it takes to fit.`
              : ""),
          schema: ConnectReply,
          effort: "low",
          maxTokens: 2000,
          image: image ? { mediaType: image.media_type, data: image.data } : undefined,
        }),
      );
      if (!bad(r)) {
        reply = r;
        break;
      }
    }
    if (!reply) {
      // The AI couldn't keep to the limit: fall back to the rule-based note built from the user's own words, which drops parts until it fits.
      const fallback = composeNote(profile, packet, facts);
      return Response.json({
        ...fallback,
        whyThisIsRelevant: `${fallback.whyThisIsRelevant} Built from your own words because the AI draft ran too long.`,
      } satisfies ConnectReply);
    }
    const ids = new Set(facts.map((f) => f.id));
    return Response.json({ ...reply, factRefs: reply.factRefs.filter((r) => ids.has(r)) } satisfies ConnectReply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
