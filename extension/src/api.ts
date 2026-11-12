/**
 * The side panel's talk to Lynkr, and the small rules around it. Nothing here touches the page, the DOM or `chrome`,
 * so the same code runs in the panel and under test.
 */

/** Lynkr's own origins: the only places a token is accepted from or sent to. */
export const ORIGIN_PATTERN = /^(https:\/\/(www\.)?lynkr\.cloud|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

export type PanelState = "unpaired" | "unpaid" | "paired";

/** A refused or failed call. `status` is 0 when the request never reached Lynkr. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type Auth = { token: string; origin: string };
export type ClientOptions = {
  auth: () => Auth | null;
  fetchFn?: typeof fetch;
  /** The token was refused (401): the panel goes back to "not paired". */
  onUnauthorized?: () => void | Promise<void>;
  /** The subscription has lapsed (402): the panel shows the upgrade card. */
  onLapsed?: () => void;
};

/**
 * Calls `/api/ext/*` with the pairing token. Until the contacts call has succeeded the panel is not paired, and any
 * other path (drafting, saving, recording) is refused here without a request, so unpaired and unpaid panels never
 * reach a route that spends or writes.
 */
export function createClient(options: ClientOptions) {
  let state: PanelState = "unpaired";
  const request = async <T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> => {
    const auth = options.auth();
    if (!auth || !ORIGIN_PATTERN.test(auth.origin)) throw new ApiError(0, "Connect your Lynkr account first.");
    if (state !== "paired" && path !== "contacts") throw new ApiError(0, state === "unpaid" ? "An active subscription is needed." : "Connect your Lynkr account first.");
    const send = options.fetchFn ?? fetch;
    let res: Response;
    try {
      res = await send(`${auth.origin}/api/ext/${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: { Authorization: `Bearer ${auth.token}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ApiError(0, "Could not reach Lynkr.");
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message = typeof data.error === "string" && data.error ? data.error : "Lynkr could not do that.";
      if (res.status === 401) { state = "unpaired"; await options.onUnauthorized?.(); }
      if (res.status === 402) { state = "unpaid"; options.onLapsed?.(); }
      throw new ApiError(res.status, message);
    }
    if (path === "contacts") state = "paired";
    return data as T;
  };
  return { request, get state() { return state; }, reset() { state = "unpaired"; } };
}

/** The tab address to save, or why not. Only a linkedin.com/in/ profile is accepted (KD1); the query and fragment are dropped. */
export type ProfileCheck = { ok: true; url: string } | { ok: false; reason: "no_address" | "not_profile" };
export function checkProfileTab(tabUrl: string | undefined): ProfileCheck {
  if (!tabUrl) return { ok: false, reason: "no_address" };
  let u: URL;
  try { u = new URL(tabUrl); } catch { return { ok: false, reason: "not_profile" }; }
  const m = /^\/in\/([A-Za-z0-9-]+)\/?$/.exec(u.pathname);
  if (u.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(u.hostname.toLowerCase()) || u.port || u.username || u.password || !m) return { ok: false, reason: "not_profile" };
  return { ok: true, url: `https://www.linkedin.com/in/${m[1].toLowerCase()}/` };
}
export const PROFILE_MESSAGES = {
  not_profile: "Save this profile link only works on a LinkedIn profile (an address like linkedin.com/in/name). Open one and try again.",
  no_address: "Chrome did not share this tab's address. Click the Lynkr icon on the profile page, then press Save this profile link again.",
} as const;

/** The route's `status` values the panel can send. */
export type TapAction = "invited" | "accepted" | "messaged" | "replied" | "meeting_booked" | "meeting_done" | "goal_reached" | "close";
export const TAP_LABEL: Record<TapAction, string> = {
  invited: "Invite sent", accepted: "Accepted", messaged: "Message sent", replied: "Reply received",
  meeting_booked: "Meeting booked", meeting_done: "Meeting done", goal_reached: "Goal reached", close: "Close",
};
/** The taps for a contact's current stage only (R40). A finished contact has none. */
const TAPS: Record<string, TapAction[]> = {
  to_contact: ["invited", "messaged", "close"],
  invited: ["accepted", "messaged", "close"],
  accepted: ["messaged", "meeting_booked", "close"],
  messaged: ["replied", "meeting_booked", "close"],
  replied: ["meeting_booked", "goal_reached", "close"],
  meeting: ["meeting_done", "goal_reached", "close"],
  outcome: [],
};
export const tapsFor = (status: string): TapAction[] => TAPS[status] ?? [];

/** "Thu, 14 Mar, 3:30 pm IST" */
export function formatIST(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(d)} IST`;
}

/** The confirmation shown after a tap. Undo is not offered here (R40): it lives on the timeline in Lynkr. */
export function tapSaved(action: TapAction, result: { event?: { meetingAt?: string | null }; goalReachedSuggested?: boolean }): string {
  const when = action === "meeting_booked" && result.event?.meetingAt ? ` for ${formatIST(result.event.meetingAt)}` : "";
  const goal = result.goalReachedSuggested ? " This meets your goal. Tap Goal reached to record it." : "";
  return `${TAP_LABEL[action]} saved${when}.${goal} Undo it in Lynkr.`;
}

// ---- comments (Commenter plan U5) ----

export type CommentGoal = "job_seeker" | "freelancer" | "visibility";
export type CommentAngle = "experience" | "add" | "question";
export type CommentOption = { angle: CommentAngle; body: string; postAnchor: string; factRefs: string[]; why: string; flags: string[]; receipt?: string };
export type CommentAuthor = { name: string; headline: string } | null;
export type CommentResult =
  | { status: "options"; goal: CommentGoal; author: CommentAuthor; options: CommentOption[]; dropped: number }
  | { status: "skip"; reason: "no_input" | "off_topic" | "failed"; why: string; author: CommentAuthor; goal: CommentGoal };

export const GOAL_LABEL: Record<CommentGoal, string> = { job_seeker: "Job seeker", freelancer: "Freelancer", visibility: "Visibility builder" };
export const ANGLE_LABEL: Record<CommentAngle, string> = { experience: "From your experience", add: "Add a point", question: "Ask a question" };

/** The most text one request carries; the server refuses more. */
export const SELECTION_SEND_MAX = 4000;
export const MESSAGE_SELECTION_MAX = 3000;

/** What can be told before a request is made (R4). The server checks the same limits and the "see more" case. */
export const SELECTION_PROBLEM_TEXT = {
  short: "Select the part of the post you want to answer (at least a sentence).",
  long: "That's longer than a LinkedIn post. Select just the part you're answering.",
  see_more: "Expand the post (click 'see more') and select again, so Lynkr reads all of it.",
} as const;
export function selectionProblem(text: string): keyof typeof SELECTION_PROBLEM_TEXT | null {
  const t = text.trim();
  if (t.length < 20) return "short";
  if (t.length > 3600) return "long";
  if (/(…|\.\.\.)\s*(see\s+)?more\s*$/i.test(t)) return "see_more";
  return null;
}

/** Insert and Ctrl+Shift+Y only run on LinkedIn (R10): the address must be exactly https://www.linkedin.com/. */
export function isLinkedInTab(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.linkedin.com" && !u.port && !u.username && !u.password;
  } catch { return false; }
}

/** Whether Lynkr has the Commenter switched on. Anything but a clear "on" counts as off. */
export async function commenterOn(origin: string, fetchFn: typeof fetch = fetch, timeoutMs = 4000): Promise<boolean> {
  if (!ORIGIN_PATTERN.test(origin)) return false;
  try {
    const res = await fetchFn(`${origin}/api/status`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    const j = (await res.json()) as { commenter?: unknown };
    return res.ok && j.commenter === "on";
  } catch { return false; }
}

/** Splits a comment into plain text and the sentences Lynkr could not tie to anything the person gave ("Check this line"). */
export function flagSegments(body: string, flags: string[]): { text: string; flagged: boolean }[] {
  const hits = flags
    .map((f) => ({ at: body.indexOf(f), len: f.length }))
    .filter((h) => h.at >= 0 && h.len > 0)
    .sort((a, b) => a.at - b.at);
  const out: { text: string; flagged: boolean }[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.at < pos) continue;
    if (h.at > pos) out.push({ text: body.slice(pos, h.at), flagged: false });
    out.push({ text: body.slice(h.at, h.at + h.len), flagged: true });
    pos = h.at + h.len;
  }
  if (pos < body.length) out.push({ text: body.slice(pos), flagged: false });
  return out.length ? out : [{ text: body, flagged: false }];
}

/** The body of one generation request. The author is sent only when the person has edited it. */
export function commentBody(selection: string, goal: CommentGoal | null, reaction: string, author: CommentAuthor | undefined) {
  return {
    selection: selection.slice(0, SELECTION_SEND_MAX),
    ...(goal ? { goal } : {}),
    ...(reaction.trim() ? { reaction: reaction.trim().slice(0, 500) } : {}),
    ...(author?.name ? { author: { name: author.name.slice(0, 120), headline: author.headline.slice(0, 220) } } : {}),
  };
}
