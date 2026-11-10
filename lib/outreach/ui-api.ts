"use client";
// The screens' calls to the outreach routes. Errors come back in plain words; a 402 means the subscription has lapsed.
import { loadLicense } from "../store";
import type { Send, TimelineRequest, TimelineResult, UiEvent } from "./ui-timeline";
import type { UiContact } from "./ui-board";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; this.name = "ApiError"; }
}
export const isLapsed = (e: unknown): boolean => e instanceof ApiError && e.status === 402;

const FALLBACK: Record<number, string> = {
  401: "Sign in to use outreach.",
  402: "An active subscription is needed to do that.",
  409: "Account storage isn't available right now.",
  429: "You've reached a daily limit. Try again tomorrow.",
};

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const license = loadLicense();
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(license ? { "x-lynkr-license": license.key, "x-lynkr-instance": license.instanceId } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach Lynkr. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, data.error || FALLBACK[res.status] || "Something went wrong. Please try again.");
  return data as T;
}

export async function loadTimeline(contactId: string): Promise<{ events: UiEvent[]; contact: UiContact }> {
  return api("GET", `/api/outreach/timeline?contactId=${encodeURIComponent(contactId)}`);
}

/** The real backend for the person card. A moved date returns no timeline, so it is read again. */
export const sendToServer: Send = async (req: TimelineRequest): Promise<TimelineResult> => {
  if (req.route === "timeline") {
    const out = await api<{ event: UiEvent; events: UiEvent[]; contact: UiContact; replayed: boolean }>("POST", "/api/outreach/timeline", req.body);
    return { events: out.events, contact: out.contact, event: out.event, replayed: out.replayed };
  }
  const moved = await api<{ replayed: boolean }>("PATCH", "/api/outreach/calendar", req.body);
  const fresh = await loadTimeline(req.contactId);
  return { events: fresh.events, contact: fresh.contact, replayed: moved.replayed };
};
