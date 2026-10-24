import { resolveContext } from "@/lib/context";
import { requireLicense } from "@/lib/billing";
import { GenerateReply, GenerateRequest, type FactRef, type ProfileInput } from "@/lib/schemas";
import { cleanStrings } from "@/lib/clean";
import { packetForPrompt } from "@/lib/requirements";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { GENERATE_SYSTEM, generateUser } from "@/lib/prompts";
import { mockGenerate } from "@/lib/mock";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 120;

/** Keep only fact references that were actually submitted. Linkage only: the user still reviews every sentence. */
function keepKnownRefs(reply: GenerateReply, ids: Set<string>): GenerateReply {
  const fix = <D extends { factRefs: string[] }>(d: D): D => ({ ...d, factRefs: d.factRefs.filter((r) => ids.has(r)) });
  return {
    ...reply,
    outreach: {
      stranger: fix(reply.outreach.stranger),
      alumni: fix(reply.outreach.alumni),
      referral: fix(reply.outreach.referral),
      hiring_manager: fix(reply.outreach.hiring_manager),
      follow_up: fix(reply.outreach.follow_up),
    },
    posts: reply.posts.map(fix),
    comments: reply.comments.map(fix),
  };
}

/**
 * A post angle with no supporting fact must not become a story. The setback post needs a
 * challenge fact and the observation post needs an opinion fact; without one, the honest
 * blank template replaces whatever the model wrote.
 */
function guardAngles(reply: GenerateReply, profile: ProfileInput, facts: FactRef[]): GenerateReply {
  const has = (k: FactRef["kind"]) => facts.some((f) => f.kind === k);
  if (has("challenge") && has("opinion")) return reply;
  const template = mockGenerate(profile, facts).posts;
  const posts = [...reply.posts];
  if (!has("challenge") && posts[1]) posts[1] = template[1];
  if (!has("opinion") && posts[2]) posts[2] = template[2];
  return { ...reply, posts };
}

/** Fact ids belong in factRefs, not in the text the user posts. */
function stripFactIds(reply: GenerateReply): GenerateReply {
  const strip = (s: string) => s.replace(/\s*\(?\b(?:F\d{1,2})(?:\s*,\s*F\d{1,2})*\)?(?=[\s.,;:!?]|$)/g, "").replace(/[ \t]{2,}/g, " ").replace(/ +([.,;:!?])/g, "$1");
  const d = <D extends { body: string; title: string }>(x: D): D => ({ ...x, body: strip(x.body), title: strip(x.title) });
  return {
    ...reply,
    profile: { headlines: reply.profile.headlines.map(strip), about: strip(reply.profile.about) },
    outreach: {
      stranger: d(reply.outreach.stranger),
      alumni: d(reply.outreach.alumni),
      referral: d(reply.outreach.referral),
      hiring_manager: d(reply.outreach.hiring_manager),
      follow_up: d(reply.outreach.follow_up),
    },
    posts: reply.posts.map(d),
    comments: reply.comments.map(d),
  };
}

export async function POST(req: Request) {
  // Paid access: a no-op unless LYNKR_PAYWALL=1.
  const locked = await requireLicense(req);
  if (locked) return locked;
  const read = await readJson(req, BODY_LIMIT.generate);
  if ("error" in read) return read.error;
  const parsed = GenerateRequest.safeParse(read.body);
  if (!parsed.success) {
    return Response.json({ error: "Confirm at least one Story Vault fact, then try again." }, { status: 400 });
  }
  const { profile, facts, jobDescription, imported, requirements } = await resolveContext(req, parsed.data, "all");
  // Only a packet the user approved reaches the AI (enrichment plan A4).
  const reqText = requirements?.reviewStatus === "approved" ? packetForPrompt(requirements) : "";
  const ids = new Set(facts.map((f) => f.id));

  if (isMock()) {
    return Response.json(keepKnownRefs(mockGenerate(profile, facts), ids));
  }

  const limited = checkLimits(req, "generate");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const reply = await callStructured({
      system: GENERATE_SYSTEM,
      user: generateUser(profile, facts, jobDescription, imported, reqText),
      schema: GenerateReply,
      effort: "low",
      maxTokens: 16000,
    });
    return Response.json(guardAngles(stripFactIds(cleanStrings(keepKnownRefs(reply, ids))), profile, facts));
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
