"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft } from "lucide-react";
import type { Account } from "@/lib/auth-client";
import type { StoryFact } from "@/lib/schemas";
import type { Saved } from "@/lib/store";
import { track } from "@/lib/track";
import { importText, prefillFrom } from "@/lib/pdf/linkedinPdf";
import { briefFrom, minutesLeft, progress as progressOf, type AnswerInput, type NextStep } from "@/lib/interview/engine";
import { profileFrom } from "@/lib/interview/profile";
import { byId } from "@/lib/interview/bank";
import { activeSecsFor, addCandidateFacts, confirmCandidates, type Interview2Body, type Interview2Reply, type V2State } from "@/lib/interview/client";
import { DemoPill, LegalLinks, SavedHint, TrustNote, Wordmark } from "../chrome";
import { ImportStep } from "../ImportStep";
import { ErrorNote } from "../ui";
import { BucketChoice } from "./BucketChoice";
import { QuestionScreen } from "./QuestionScreen";
import { VaultPanel } from "./VaultPanel";
import { ReadBack } from "./ReadBack";
import { FirstWin } from "./FirstWin";

type ActiveBucket = Interview2Body["bucket"];

/** Thrown when the server needs a signed-in account; the flow sends the person to sign up. */
class AccountRequired extends Error {}

async function askServer(body: Interview2Body): Promise<Interview2Reply> {
  const res = await fetch("/api/interview2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Interview2Reply & { error?: string; code?: string };
  if (res.status === 401 && data.code === "account_required") throw new AccountRequired();
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/** Best effort: save the read-back's facts to the account. Without account storage (409) the browser copy is the record. */
async function syncFacts(facts: StoryFact[]): Promise<StoryFact[] | null> {
  try {
    const res = await fetch("/api/me/facts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts: facts.slice(0, 60) }) });
    if (!res.ok) return null;
    const d = (await res.json()) as { facts?: StoryFact[] };
    return Array.isArray(d.facts) ? d.facts : null;
  } catch {
    return null;
  }
}

/**
 * The new interview (build plan Parts 2 to 5): who it's for, the import, one question at a time,
 * the read-back and the first win. The server picks every question; this screen only shows them,
 * keeps the browser copy (Saved.v2 and Saved.facts) and resumes where the person left off.
 */
export function InterviewFlow({
  s,
  setS,
  account,
  mock,
  onDone,
  onHome,
}: {
  s: Saved;
  setS: Dispatch<SetStateAction<Saved>>;
  account: Account | null;
  mock: boolean | null;
  /** After the first win: the app shows the paywall or the full drafts, as usual. */
  onDone: () => void;
  onHome: () => void;
}) {
  const v2 = s.v2;
  const bucket = v2.bucket as ActiveBucket | null;
  const [step, setStep] = useState<NextStep | null>(null);
  const [reflection, setReflection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the account is known to hold the interview (account storage on), for the "saved" hint.
  const [inAccount, setInAccount] = useState(false);
  useEffect(() => {
    if (!account?.signedIn) return;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cloud?: boolean } | null) => setInAccount(j?.cloud === true))
      .catch(() => {});
  }, [account?.signedIn]);
  const shownAt = useRef(0);
  const imported = !!v2.importSource && v2.importSource !== "skip";

  const setV2 = (patch: Partial<V2State> | ((prev: V2State) => Partial<V2State>)) =>
    setS((prev) => ({ ...prev, v2: { ...prev.v2, ...(typeof patch === "function" ? patch(prev.v2) : patch) } }));

  /** Apply one reply from the server: answers, facts (or the account's vault), and the next step. */
  function apply(reply: Interview2Reply, answered: AnswerInput | null, secs: number) {
    // Count-only: answering time in seconds, never what was said. Only when an answer finished it.
    if (answered && reply.next.type === "done") track("interview_finished", { bucket: bucket ?? undefined, value: v2.activeSecs + secs });
    setS((prev) => {
      let facts = prev.facts;
      let factMap = prev.v2.factMap;
      if (reply.vault) facts = reply.vault;
      else if (answered && reply.facts.length) ({ facts, factMap } = addCandidateFacts(prev.facts, prev.v2.factMap, answered.qid, answered.attempt, reply.facts));
      return {
        ...prev,
        facts,
        v2: {
          ...prev.v2,
          answers: reply.answers,
          factMap,
          activeSecs: prev.v2.activeSecs + secs,
          ...(reply.next.type === "done"
            ? { phase: "summary" as const, later: reply.next.later, unresolved: reply.next.unresolved, finishedAt: prev.v2.finishedAt ?? new Date().toISOString() }
            : {}),
        },
      };
    });
    setStep(reply.next);
    shownAt.current = Date.now();
  }

  function failed(e: unknown) {
    if (e instanceof AccountRequired) {
      window.location.assign("/signup");
      return;
    }
    setError((e as Error).message);
  }

  // Entering (or coming back to) the interview: ask the server for the current step, saving nothing.
  useEffect(() => {
    if (v2.phase !== "interview" || !bucket || step) return;
    let live = true;
    askServer({ bucket, answer: null, history: v2.answers, elapsedSecs: v2.activeSecs, imported })
      .then((reply) => live && apply(reply, null, 0))
      .catch((e) => live && failed(e));
    return () => {
      live = false;
    };
    // Only when the phase or bucket changes; answers are sent with each submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2.phase, bucket]);

  async function submit(input: AnswerInput) {
    if (!bucket || busy) return;
    setBusy(true);
    setError(null);
    const secs = activeSecsFor(shownAt.current || Date.now(), Date.now());
    try {
      const reply = await askServer({ bucket, answer: input, history: v2.answers, elapsedSecs: v2.activeSecs + secs, imported });
      setReflection(reply.reflection);
      apply(reply, input, secs);
    } catch (e) {
      failed(e);
    }
    setBusy(false);
  }

  function chooseBucket(b: ActiveBucket) {
    if (!v2.startedAt) track("interview_started", { bucket: b });
    // A different bucket asks different questions: keep the import, start the answers again.
    const changed = v2.bucket !== null && v2.bucket !== b;
    setV2((prev) => ({ bucket: b, phase: "import", startedAt: prev.startedAt ?? new Date().toISOString(), ...(changed ? { answers: [], factMap: {} } : {}) }));
    setStep(null);
  }

  async function confirmSummary(rating: number | null) {
    if (!bucket) return;
    setBusy(true);
    setError(null);
    const profile = profileFrom(bucket, v2.answers, v2.importText) ?? s.profile;
    if (!profile) {
      setError("We need your current role and what you're aiming for first. Fix those lines above.");
      setBusy(false);
      return;
    }
    const confirmed = confirmCandidates(s.facts);
    const saved = account?.signedIn ? await syncFacts(confirmed) : null;
    setS((prev) => ({ ...prev, profile, facts: saved ?? confirmed, v2: { ...prev.v2, rating, phase: "firstwin" } }));
    setBusy(false);
    window.scrollTo({ top: 0 });
  }

  const brief = bucket ? briefFrom(bucket, v2.answers) : null;
  // The import's current role, offered on the question that asks for it ("confirm or fix").
  const shown =
    step?.type === "ask" && step.attempt === 0 && v2.prefillRole && byId(step.qid)?.prefill === "currentRole"
      ? { ...step, prompt: `${step.prompt} From your profile: ${v2.prefillRole}. Confirm or fix it.` }
      : step;
  const wide = v2.phase === "interview";

  return (
    <div className={`mx-auto w-full px-4 pb-12 pt-6 sm:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onHome} aria-label="Lynkr home page" className="rounded-md">
          <Wordmark />
        </button>
        <span className="flex items-center gap-3">
          <SavedHint inAccount={inAccount} />
          {mock && <DemoPill />}
        </span>
      </header>

      <main className="space-y-4">
        <ErrorNote message={error} />

        {v2.phase === "bucket" && <BucketChoice value={v2.bucket} onChoose={chooseBucket} />}

        {v2.phase === "import" && bucket && (
          <ImportStep
            bucket={bucket}
            account={account}
            onBack={() => setV2({ phase: "bucket" })}
            onDone={({ fields, source }) => {
              track("import_used", { bucket, source });
              setV2({
                importSource: source,
                importText: fields ? importText(fields) : "",
                prefillRole: fields ? prefillFrom(fields).currentRole : "",
                phase: "interview",
              });
              setStep(null);
            }}
          />
        )}

        {v2.phase === "interview" && bucket && brief && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            {shown?.type === "ask" ? (
              <QuestionScreen
                bucket={bucket}
                step={shown}
                progress={progressOf(bucket, v2.answers, imported)}
                minutesLeft={minutesLeft(bucket, v2.answers)}
                reflection={reflection}
                busy={busy}
                error={null}
                onSubmit={submit}
                field={v2.answers.find((a) => a.qid === "A3" && a.attempt === 0 && a.status === "answered")?.text ?? null}
              />
            ) : (
              <p role="status" className="animate-pulse text-soft">
                Getting your next question…
              </p>
            )}
            <VaultPanel facts={s.facts} brief={brief} />
          </div>
        )}

        {v2.phase === "summary" && brief && (
          <>
            <button onClick={() => setV2({ phase: "interview" })} className="inline-flex items-center gap-1.5 text-[0.92rem] font-medium text-accent hover:underline">
              <ArrowLeft size={15} aria-hidden /> Back to the questions
            </button>
            <ReadBack brief={brief} facts={s.facts} onChangeFacts={(facts) => setS((prev) => ({ ...prev, facts }))} onConfirm={confirmSummary} busy={busy} />
          </>
        )}

        {v2.phase === "firstwin" && s.profile && <FirstWin profile={s.profile} facts={s.facts} onContinue={onDone} />}
      </main>

      <footer className="mt-12 border-t border-line pt-6">
        <TrustNote mock={mock} />
        <LegalLinks className="mt-4" />
      </footer>
    </div>
  );
}

