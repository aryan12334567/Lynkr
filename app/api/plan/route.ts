import { PlanChatReply, PlanChatRequest } from "@/lib/schemas";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { PLAN_CHAT_SYSTEM, planChatUser } from "@/lib/prompts";
import { clampCounts, parsePlanChat, type PlanChange } from "@/lib/plan";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 60;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = PlanChatRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Write what to change, in up to 500 characters." }, { status: 400 });
  }
  const { text, counts, times } = parsed.data;

  if (isMock()) {
    return Response.json(parsePlanChat(text, counts, times) satisfies PlanChange);
  }

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    const r = await callStructured({
      system: PLAN_CHAT_SYSTEM,
      user: planChatUser(text, counts, times),
      schema: PlanChatReply,
      effort: "low",
      maxTokens: 2000,
    });
    const pick = (t: string, fallback: string) => (HHMM.test(t) ? t : fallback);
    const change: PlanChange = {
      counts: clampCounts({ posts: r.posts, comments: r.comments, messages: r.messages }),
      times: { post: pick(r.post_time, times.post), comment: pick(r.comment_time, times.comment), message: pick(r.message_time, times.message) },
      understood: r.understood,
      reply: r.reply,
    };
    if (!r.understood) {
      change.counts = counts;
      change.times = times;
    }
    return Response.json(change);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
