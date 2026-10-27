import { ACTIVE_BUCKETS, type Bucket, type StoryFact } from "../schemas";
import type { Answer, AnswerInput, Brief, CandidateFact, NextStep } from "./engine";

/**
 * Browser-side state for interview v2, saved with the rest of the app (lib/store.ts) and shared by
 * the flow screens. Facts live in Saved.facts, like the old interview's, so the existing drafts,
 * vault and paid features read them unchanged.
 */
export type ImportSource = "pdf" | "paste" | "archive" | "linkedin" | "skip";
export type V2Phase = "bucket" | "import" | "interview" | "summary" | "firstwin";

export type V2State = {
  bucket: Bucket | null;
  phase: V2Phase;
  importSource: ImportSource | null;
  /** Compact text of the confirmed import, sent to the AI only as quoted data. Never the PDF. */
  importText: string;
  /** From the import: offered in the first question as "confirm or fix". */
  prefillRole: string;
  answers: Answer[];
  /** Seconds spent answering (capped per question), for the time estimate and metrics. */
  activeSecs: number;
  startedAt: string | null;
  later: string[];
  unresolved: string[];
  /** Which fact ids came from which answer ("C1.0" -> ["F3"]), so a re-saved answer replaces its facts. */
  factMap: Record<string, string[]>;
  rating: number | null;
  finishedAt: string | null;
};

export const EMPTY_V2: V2State = {
  bucket: null,
  phase: "bucket",
  importSource: null,
  importText: "",
  prefillRole: "",
  answers: [],
  activeSecs: 0,
  startedAt: null,
  later: [],
  unresolved: [],
  factMap: {},
  rating: null,
  finishedAt: null,
};

const PHASES: readonly V2Phase[] = ["bucket", "import", "interview", "summary", "firstwin"];
const SOURCES: readonly ImportSource[] = ["pdf", "paste", "archive", "linkedin", "skip"];
const isList = (v: unknown): v is unknown[] => Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Bring a saved v2 state (or none, from saves made before v2) up to date. Anything malformed falls
 * back to the empty state field by field, so an old or half-written save never breaks the app.
 */
export function migrateV2(raw: unknown): V2State {
  if (!raw || typeof raw !== "object") return EMPTY_V2;
  const r = raw as Partial<Record<keyof V2State, unknown>>;
  const bucket = (ACTIVE_BUCKETS as readonly string[]).includes(str(r.bucket)) ? (r.bucket as Bucket) : null;
  const phase = PHASES.includes(r.phase as V2Phase) ? (r.phase as V2Phase) : "bucket";
  const answers = isList(r.answers)
    ? (r.answers.filter((a) => !!a && typeof a === "object" && typeof (a as Answer).qid === "string" && Number.isInteger((a as Answer).attempt)) as Answer[])
    : [];
  return {
    ...EMPTY_V2,
    bucket,
    // Without a bucket nothing past the first screen can be shown.
    phase: bucket ? phase : "bucket",
    importSource: SOURCES.includes(r.importSource as ImportSource) ? (r.importSource as ImportSource) : null,
    importText: str(r.importText).slice(0, 4000),
    prefillRole: str(r.prefillRole).slice(0, 200),
    answers,
    activeSecs: typeof r.activeSecs === "number" && r.activeSecs >= 0 ? Math.round(r.activeSecs) : 0,
    startedAt: typeof r.startedAt === "string" ? r.startedAt : null,
    later: isList(r.later) ? r.later.filter((x): x is string => typeof x === "string") : [],
    unresolved: isList(r.unresolved) ? r.unresolved.filter((x): x is string => typeof x === "string") : [],
    factMap: r.factMap && typeof r.factMap === "object" && !Array.isArray(r.factMap) ? (r.factMap as Record<string, string[]>) : {},
    rating: typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? r.rating : null,
    finishedAt: typeof r.finishedAt === "string" ? r.finishedAt : null,
  };
}

/** Seconds counted for one question: time on screen, capped so a break doesn't inflate the total. */
export const MAX_SECS_PER_QUESTION = 180;
export function activeSecsFor(shownAt: number, now: number): number {
  return Math.min(MAX_SECS_PER_QUESTION, Math.max(0, Math.round((now - shownAt) / 1000)));
}

export type Interview2Reply = {
  next: NextStep;
  reflection: string;
  facts: CandidateFact[];
  answers: Answer[];
  progress: { done: number; total: number; pct: number };
  brief: Brief;
  /** Present when the account holds the vault: it replaces the browser copy. */
  vault?: StoryFact[];
};

export type Interview2Body = { bucket: Bucket; answer: AnswerInput | null; history: Answer[]; elapsedSecs: number; imported: boolean };

/**
 * Put one answer's candidate facts into the vault. A re-saved answer replaces its own earlier
 * candidates; facts the person already confirmed, edited or excluded are kept as they are.
 */
export function addCandidateFacts(
  facts: StoryFact[],
  factMap: Record<string, string[]>,
  qid: string,
  attempt: number,
  candidates: CandidateFact[],
): { facts: StoryFact[]; factMap: Record<string, string[]> } {
  const key = `${qid}.${attempt}`;
  const old = new Set(factMap[key] ?? []);
  const keep = facts.filter((f) => !old.has(f.id) || f.reviewStatus !== "candidate");
  const kept = new Set(keep.filter((f) => old.has(f.id)).map((f) => f.text.trim().toLowerCase()));
  let n = Math.max(0, ...facts.map((f) => Number(f.id.slice(1)) || 0));
  const now = new Date().toISOString();
  const fresh: StoryFact[] = candidates
    .filter((c) => !kept.has(c.text.trim().toLowerCase()))
    .map((c) => ({
      id: `F${++n}`,
      kind: c.kind,
      text: c.text,
      sourceTurnIds: [],
      reviewStatus: "candidate",
      useInDrafts: false,
      sourceQid: c.sourceQid,
      confidence: c.confidence,
      updatedAt: now,
    }));
  return { facts: [...keep, ...fresh], factMap: { ...factMap, [key]: [...keep.filter((f) => old.has(f.id)).map((f) => f.id), ...fresh.map((f) => f.id)] } };
}

/** "Looks right" on the read-back: every candidate becomes confirmed and switched on for drafts. */
export function confirmCandidates(facts: StoryFact[]): StoryFact[] {
  const now = new Date().toISOString();
  return facts.map((f) => (f.reviewStatus === "candidate" ? { ...f, reviewStatus: "confirmed", useInDrafts: true, updatedAt: now } : f));
}
