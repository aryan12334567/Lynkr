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
  const request = async <T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> => {
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
