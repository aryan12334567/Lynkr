import { requireLicense } from "@/lib/billing";
import { PlanChatReply, PlanChatRequest } from "@/lib/schemas";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { callStructured, isMock, LlmError } from "@/lib/llm";
import { PLAN_CHAT_SYSTEM, planChatUser } from "@/lib/prompts";
import { clampCounts, parsePlanChat, type PlanChange } from "@/lib/plan";
import { checkLimits } from "@/lib/limit";
import { accountContext } from "@/lib/account";
import { commenterSwitch } from "@/lib/comment/flags";
import { calendarVersion } from "@/lib/calendar/flags";
import { modelItemLines, type ChatMove } from "@/lib/calendar/chat";
import { applyChatMove } from "@/lib/calendar/chat-move";
import { calendarFeed, type Switches } from "@/lib/calendar/server";
import { isMonday } from "@/lib/calendar/plan-store";
import { addDays } from "@/lib/ist";
import { outreachVersion } from "@/lib/outreach/flags";

export const maxDuration = 60;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const switches = (): Switches => ({ outreach: outreachVersion() === "v2", commenter: commenterSwitch() === "on", posts: false });

/**
 * A move (calendar plan U7) is matched to the signed-in person's own item and sent through the Calendar's owner code.
 * Nothing about it can publish or send. Without a session or a week there is nothing to match, and the reply says so.
 */
async function moved(req: Request, change: PlanChange, weekStart: string | undefined): Promise<Response> {
  const move = change.move as ChatMove;
  const ctx = calendarVersion() === "v2" && weekStart && isMonday(weekStart) ? await accountContext(req) : null;
  if (!ctx || !weekStart) return Response.json({ counts: change.counts, times: change.times, understood: false, reply: "Sign in to move items by chat." } satisfies PlanChange);
  const r = await applyChatMove(ctx.db, ctx.userId, { weekStart, move, switches: switches() });
  return Response.json({ counts: change.counts, times: change.times, understood: r.moved, reply: r.reply, moved: r.moved });
}

export async function POST(req: Request) {
  // Paid access: a no-op unless LYNKR_PAYWALL=1.
  const locked = await requireLicense(req);
  if (locked) return locked;
  const read = await readJson(req, BODY_LIMIT.plan);
  if ("error" in read) return read.error;
  const body = read.body;
  const parsed = PlanChatRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Write what to change, in up to 500 characters." }, { status: 400 });
  }
  const { text, counts, times, weekStart } = parsed.data;

  if (isMock()) {
    const change = parsePlanChat(text, counts, times);
    return change.move ? moved(req, change, weekStart) : Response.json(change satisfies PlanChange);
  }

  const limited = checkLimits(req, "interview");
  if (limited) return Response.json({ error: limited }, { status: 429 });

  try {
    // The model sees only each item's weekday and kind (R12): no names, labels, ids or text.
    let lines = "";
    if (weekStart && isMonday(weekStart) && calendarVersion() === "v2") {
      const ctx = await accountContext(req);
      if (ctx) {
        const feed = await calendarFeed(ctx.db, ctx.userId, { from: weekStart, to: addDays(weekStart, 6), paid: true, switches: switches() }).catch(() => null);
        if (feed) lines = modelItemLines(feed.items.filter((i) => i.status !== "replaced"), weekStart);
      }
    }
    const r = await callStructured({
      system: PLAN_CHAT_SYSTEM,
      user: planChatUser(text, counts, times, lines),
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
    if (r.understood && r.move) {
      change.counts = counts;
      change.times = times;
      change.move = { ...r.move, time: r.move.time && HHMM.test(r.move.time) ? r.move.time : null };
      return moved(req, change, weekStart);
    }
    return Response.json(change);
  } catch (err) {
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
