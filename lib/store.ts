import { ProfileInput, type FactKind, type GenerateReply, type StoryFact, type Turn } from "./schemas";
import type { Plan } from "./plan";
import { DEFAULT_CONNECT, migratePerson, type Connect, type Person } from "./connect";

/** Everything Lynkr keeps lives in this browser only (localStorage). */
export type Stage = "setup" | "interview" | "extracting" | "review" | "generating" | "results";

/** A user's own edit of a draft; base is the draft text it was made from. */
export type DraftEdit = { text: string; base: string };

export type Saved = {
  stage: Stage;
  profile: ProfileInput | null;
  turns: Turn[];
  /** Story Vault: candidate facts the user reviews, edits, confirms or excludes. */
  facts: StoryFact[];
  result: GenerateReply | null;
  /** Fill-in values for each draft's [[slots]], keyed by draft id. */
  fills: Record<string, string[]>;
  /** Full-text edits, keyed by draft id. */
  edits: Record<string, DraftEdit>;
  /** Profile findings the user marked done, by finding id. */
  profileDone: Record<string, boolean>;
  /** Comments the user chose to keep. The post excerpt is never saved. */
  keptComments: string[];
  /** Weekly plan + calendar; built the first time the "This week" tab opens. */
  plan: Plan | null;
  /** Connect Coach: note budget, weekly cap and the people tracker. */
  connect: Connect;
};

const KEY = "lynkr:v1";

export const EMPTY: Saved = {
  stage: "setup",
  profile: null,
  turns: [],
  facts: [],
  result: null,
  fills: {},
  edits: {},
  profileDone: {},
  keptComments: [],
  plan: null,
  connect: DEFAULT_CONNECT,
};

const OLD_KIND: Record<string, FactKind> = {
  story: "challenge",
  number: "evidence",
  proof: "project",
  skill: "contribution",
  opinion: "opinion",
  constraint: "constraint",
  target: "target",
};

/** Bring a save from an older version up to date without losing answers or drafts. */
export function migrate(raw: Partial<Saved> & Record<string, unknown>): Saved {
  const s: Saved = { ...EMPTY, ...raw } as Saved;
  if (s.profile) {
    const p = ProfileInput.safeParse(s.profile);
    s.profile = p.success ? p.data : s.profile;
  }
  // Results saved before the reviewable vault: their vault items become confirmed facts.
  if ((!s.facts || s.facts.length === 0) && s.result?.vault?.length) {
    s.facts = s.result.vault.map((v, i) => ({
      id: `F${i + 1}`,
      kind: OLD_KIND[v.kind] ?? "project",
      text: v.text,
      sourceTurnIds: [],
      reviewStatus: "confirmed",
      useInDrafts: true,
    }));
  }
  s.connect = { ...DEFAULT_CONNECT, ...s.connect, people: (s.connect?.people ?? []).map((p) => migratePerson(p as Omit<Person, "status"> & { status: string })) };
  // A reload mid-request has nothing to wait for.
  if (s.stage === "generating") s.stage = s.facts.length ? "review" : s.turns.length ? "interview" : "setup";
  if (s.stage === "extracting") s.stage = s.turns.length ? "interview" : "setup";
  return s;
}

export function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return migrate(JSON.parse(raw));
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

/** Facts the user confirmed and left on, with short ids for the server. */
export function draftFacts(facts: StoryFact[]) {
  return facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts).map((f) => ({ id: f.id, kind: f.kind, text: f.text.slice(0, 400) }));
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
