import type { GenerateReply, ProfileInput, Turn } from "./schemas";
import type { Plan } from "./plan";
import { DEFAULT_CONNECT, type Connect } from "./connect";

/** Everything Lynkr keeps lives in this browser only (localStorage). */
export type Stage = "setup" | "interview" | "generating" | "results";

export type Saved = {
  stage: Stage;
  profile: ProfileInput | null;
  turns: Turn[];
  result: GenerateReply | null;
  /** Fill-in values for each draft's [[slots]], keyed by draft id. */
  fills: Record<string, string[]>;
  /** Weekly plan + calendar; built the first time the "This week" tab opens. */
  plan: Plan | null;
  /** Connect Coach: note budget, weekly cap and the people tracker. */
  connect: Connect;
};

const KEY = "lynkr:v1";

export const EMPTY: Saved = { stage: "setup", profile: null, turns: [], result: null, fills: {}, plan: null, connect: DEFAULT_CONNECT };

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const s = JSON.parse(raw) as Saved;
    // A reload mid-generation has nothing to wait for; go back to the interview.
    if (s.stage === "generating") s.stage = s.turns.length ? "interview" : "setup";
    return { ...EMPTY, ...s };
  } catch {
    return EMPTY;
  }
}

export function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage full: the app still works, it just won't remember.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong. Please try again.");
  return data as T;
}
