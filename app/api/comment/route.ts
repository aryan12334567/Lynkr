import { CommentReply, CommentRequest } from "@/lib/schemas";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { COMMENT_SYSTEM, commentUser } from "@/lib/prompts";
import { mockComment } from "@/lib/mock";
import { checkLimits } from "@/lib/limit";
import { cleanStrings } from "@/lib/clean";
import { AUDIENCE_LABEL, DOMAIN_LABEL } from "@/lib/roles";
import { validComment } from "@/lib/comment";

export const maxDuration = 60;

/**
 * Comment on a post the user found. The excerpt is used for this request only: it
 * isn't logged or stored. Nothing is posted.
 */
export async function POST(req: Request) {
  const read = await readJson(req, BODY_LIMIT.comment);
  if ("error" in read) return read.error;
  const parsed = CommentRequest.safeParse(read.body);
  if (!parsed.success) {
    return Response.json({ error: "Paste 20 to 3,000 characters of the post, pick up to 3 facts, and keep your thought under 500 characters." }, { status: 400 });
  }
  const { targetRole, domain, audiences, industry, excerpt, facts, perspective, anchor } = parsed.data;

  if (!perspective && facts.length === 0) {
    return Response.json({
      status: "skip",
      body: "",
      postAnchor: "",
      factRefs: [],
      whyItFits: "Add one thought of your own or pick a fact. Without one, skipping this post is the better move.",
    } satisfies CommentReply);
  }

  if (isMock()) return Response.json(mockComment(excerpt, anchor, perspective, facts));

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const ids = new Set(facts.map((f) => f.id));
  const user = commentUser(targetRole, DOMAIN_LABEL[domain], audiences.map((a) => AUDIENCE_LABEL[a]).join(", "), industry, excerpt, facts, perspective);
  try {
    // One retry if the model's comment fails the checks, then an honest skip.
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = cleanStrings(await callStructured({ system: COMMENT_SYSTEM, user, schema: CommentReply, effort: "medium", maxTokens: 2000 }));
      if (!validComment(reply, excerpt, ids)) return Response.json(reply);
    }
    return Response.json({
      status: "skip",
      body: "",
      postAnchor: "",
      factRefs: [],
      whyItFits: "Couldn't write a comment that responds to a specific line and uses your point. Add your own thought, or skip this post.",
    } satisfies CommentReply);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
