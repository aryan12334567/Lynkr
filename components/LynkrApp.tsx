"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { ExternalContextPacket, GenerateReply, ProfileInput, StoryFact, Turn, VaultReply } from "@/lib/schemas";
import type { ImportMode } from "./ExternalContext";
import { clear, draftFacts, EMPTY, load, postJson, save, type Saved } from "@/lib/store";
import { importedText, type ImportedProfile } from "@/lib/linkedinExport";
import { Setup } from "./Setup";
import { Interview } from "./Interview";
import { VaultReview } from "./VaultReview";
import { Results, TAB_IDS, type Tab } from "./Results";
import { Checker } from "./Checker";
import { Landing } from "./Landing";
import { ConfirmReset, DemoPill, SavedHint, SupportButton, TrustNote, Wordmark } from "./chrome";
import { Button, Card, ErrorNote } from "./ui";

const STEPS = ["Basics", "Interview", "Check your facts", "Drafts"] as const;
const stepOf = (stage: Saved["stage"]) =>
  stage === "setup" ? 0 : stage === "interview" || stage === "extracting" ? 1 : stage === "review" || stage === "generating" ? 2 : 3;

/**
 * Screens have addresses (#home, #start, #check, #app/<tab>) so the browser's Back
 * and Forward buttons work and every screen can be returned to.
 */
type Route = { name: "home" } | { name: "start" } | { name: "check" } | { name: "app"; tab: Tab };

function parseRoute(hash: string, s: Saved): Route {
  const h = hash.replace(/^#\/?/, "");
  if (h === "home") return { name: "home" };
  if (h === "start") return { name: "start" };
  if (h === "check") return { name: "check" };
  if (h.startsWith("app")) {
    const t = h.split("/")[1] as Tab;
    return { name: "app", tab: TAB_IDS.includes(t) ? t : "today" };
  }
  // No address yet: returning users with drafts land in the app, everyone else on the home page.
  if (s.stage === "results" && s.result) return { name: "app", tab: "today" };
  if (s.profile) return { name: "start" };
  return { name: "home" };
}

const toHash = (r: Route) => (r.name === "app" ? `#app/${r.tab}` : `#${r.name}`);

export function LynkrApp() {
  const [s, setS] = useState<Saved>(load);
  const skipNextSave = useRef(false);
  const [mock, setMock] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash, s));
  // In memory only, never saved: the user's own export fields and a pasted job description.
  const [imported, setImported] = useState<ImportedProfile | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  // An imported job page: memory only, never saved, separate from the Story Vault.
  const [requirements, setRequirements] = useState<ExternalContextPacket | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { mock: boolean; importFromLink?: ImportMode }) => {
        setMock(d.mock);
        setImportMode(d.importFromLink ?? null);
      })
      .catch(() => setMock(null));
  }, []);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    save(s);
  }, [s]);

  // Keep the address in step with the screen, and follow Back/Forward.
  useEffect(() => {
    if (window.location.hash !== toHash(route)) window.history.replaceState(null, "", toHash(route));
    const onHash = () => setRoute(parseRoute(window.location.hash, s));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Go to a screen and add it to the browser history. */
  function go(r: Route, opts: { replace?: boolean } = {}) {
    const hash = toHash(r);
    if (window.location.hash !== hash) {
      if (opts.replace) window.history.replaceState(null, "", hash);
      else window.history.pushState(null, "", hash);
    }
    setRoute(r);
    window.scrollTo({ top: 0 });
  }

  const update = (patch: Partial<Saved>) => setS((prev) => ({ ...prev, ...patch }));
  const hasDrafts = !!(s.result && s.profile);

  /** Step 1: candidate facts from the interview, for the user to review. */
  async function extract(profile: ProfileInput, turns: Turn[]) {
    update({ stage: "extracting", turns });
    setError(null);
    try {
      const reply = await postJson<VaultReply>("/api/vault", { profile, turns });
      // Keep anything the user already reviewed; add the new candidates after it.
      setS((prev) => {
        const kept = prev.facts.filter((f) => f.reviewStatus !== "candidate");
        const seen = new Set(kept.map((f) => f.text.trim().toLowerCase()));
        let n = Math.max(0, ...prev.facts.map((f) => Number(f.id.slice(1)) || 0));
        const fresh: StoryFact[] = reply.facts
          .filter((f) => !seen.has(f.text.trim().toLowerCase()))
          .map((f) => ({ ...f, id: `F${++n}`, reviewStatus: "candidate", useInDrafts: false }));
        return { ...prev, stage: "review", facts: [...kept, ...fresh] };
      });
    } catch (e) {
      setError((e as Error).message);
      update({ stage: "interview" });
    }
  }

  /** Step 2: drafts from confirmed facts only. */
  async function generate() {
    if (!s.profile) return;
    const facts = draftFacts(s.facts);
    if (!facts.length) {
      setError("Confirm at least one fact first.");
      return;
    }
    const back = s.stage;
    update({ stage: "generating" });
    setError(null);
    try {
      const result = await postJson<GenerateReply>("/api/generate", {
        profile: s.profile,
        turns: s.turns.length ? s.turns : [{ q: "Background", a: s.profile.background }],
        facts,
        jobDescription: jobDescription.trim().slice(0, 6000),
        imported: imported ? importedText(imported) : "",
        requirements: requirements?.reviewStatus === "approved" ? requirements : undefined,
      });
      // Fills and edits are kept: a rewritten draft never silently replaces your own edit.
      update({ stage: "results", result });
      go({ name: "app", tab: back === "results" ? (route.name === "app" ? route.tab : "today") : "today" }, { replace: back === "results" });
    } catch (e) {
      setError((e as Error).message);
      update({ stage: back === "results" ? "results" : "review" });
    }
  }

  function reset() {
    skipNextSave.current = true;
    clear();
    setImported(null);
    setJobDescription("");
    setRequirements(null);
    setS(EMPTY);
    go({ name: "home" });
  }

  /** Leave the app for more interview questions; drafts stay and can be returned to. */
  function moreQuestions() {
    update({ stage: "interview" });
    go({ name: "start" });
  }

  // ---- screens ----

  if (route.name === "home") {
    return (
      <Landing
        mock={mock}
        resume={hasDrafts ? "drafts" : s.profile ? "flow" : null}
        onStart={() => go(hasDrafts && s.stage === "results" ? { name: "app", tab: "today" } : { name: "start" })}
        onCheck={() => go({ name: "check" })}
      />
    );
  }

  if (route.name === "check") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <HomeLink onHome={() => go({ name: "home" })} />
          <Button variant="ghost" onClick={() => go(hasDrafts && s.stage === "results" ? { name: "app", tab: "today" } : { name: "start" })}>
            {hasDrafts ? "Back to my drafts" : "Start the full interview"}
          </Button>
        </header>
        <Checker facts={s.facts} mock={mock} />
        <footer className="mt-12 border-t border-line pt-6">
          <TrustNote mock={mock} />
          <SupportButton className="mt-4" />
        </footer>
      </div>
    );
  }

  if ((route.name === "app" || route.name === "start") && s.stage === "results" && hasDrafts) {
    return (
      <Results
        s={s}
        setS={setS}
        mock={mock}
        error={error}
        tab={route.name === "app" ? route.tab : "today"}
        onTab={(tab) => go({ name: "app", tab })}
        onHome={() => go({ name: "home" })}
        onRewrite={generate}
        onMoreQuestions={moreQuestions}
        onReset={reset}
        imported={imported}
        setImported={setImported}
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        requirements={requirements}
        setRequirements={setRequirements}
        importMode={importMode}
      />
    );
  }

  // The flow: basics, interview, fact check. (Also where #app lands if there are no drafts yet.)
  const step = stepOf(s.stage);
  const generating = s.stage === "generating";
  return (
    <div className="relative min-h-full">
      <div className="paper-grid pointer-events-none absolute inset-x-0 top-0 h-80" aria-hidden />
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <HomeLink onHome={() => go({ name: "home" })} />
          <span className="flex items-center gap-3">
            <SavedHint />
            {mock && <DemoPill />}
          </span>
        </header>

        {hasDrafts && s.stage !== "results" && !generating && (
          <button
            onClick={() => {
              update({ stage: "results" });
              go({ name: "app", tab: "today" });
            }}
            className="mb-5 inline-flex items-center gap-1.5 text-[0.92rem] font-medium text-accent hover:underline"
          >
            <ArrowLeft size={15} aria-hidden /> Back to my drafts
          </button>
        )}

        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className="min-w-0">
              <span className={`block h-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-2 block truncate text-[0.82rem] ${i === step ? "font-medium text-ink" : "text-faint"}`}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <main className="space-y-4">
          <ErrorNote message={error} />

          {s.stage === "setup" && <Setup initial={s.profile} onDone={(profile) => update({ profile, stage: "interview" })} />}

          {s.stage === "interview" && s.profile && (
            <Interview
              profile={s.profile}
              turns={s.turns}
              onTurns={(turns) => update({ turns })}
              onFinish={(turns) => extract(s.profile!, turns)}
              onBack={() => update({ stage: "setup" })}
            />
          )}

          {s.stage === "extracting" && (
            <Card>
              <p className="animate-pulse font-medium">Pulling the facts out of your answers…</p>
              <p className="mt-1 text-[0.95rem] text-soft">Usually under 15 seconds. You&apos;ll check each one before anything is written.</p>
            </Card>
          )}

          {generating && (
            <Card>
              <p className="animate-pulse font-medium">Writing your profile fixes, messages and posts…</p>
              <p className="mt-1 text-[0.95rem] text-soft">
                Usually 20 to 40 seconds. Only from the facts you confirmed; anything Lynkr doesn&apos;t know becomes a blank for you.
              </p>
            </Card>
          )}

          {s.stage === "review" && s.profile && (
            <VaultReview
              mode="first"
              profile={s.profile}
              turns={s.turns}
              facts={s.facts}
              onFacts={(facts) => setS((prev) => ({ ...prev, facts }))}
              onProfile={(profile) => setS((prev) => ({ ...prev, profile }))}
              busy={false}
              onWrite={generate}
              onBack={() => update({ stage: "interview" })}
            />
          )}

          {s.stage === "results" && !hasDrafts && (
            <Card>
              <p className="text-[0.95rem]">Your drafts aren&apos;t here anymore. Check your facts to write them again.</p>
              <Button className="mt-3" onClick={() => update({ stage: s.facts.length ? "review" : "setup" })}>
                Continue
              </Button>
            </Card>
          )}
        </main>

        <footer className="mt-12 border-t border-line pt-6">
          <TrustNote mock={mock} />
          <ConfirmReset onReset={reset} className="mt-3" />
          <SupportButton className="mt-4" />
        </footer>
      </div>
    </div>
  );
}

function HomeLink({ onHome }: { onHome: () => void }) {
  return (
    <button onClick={onHome} aria-label="Lynkr home page" className="rounded-md">
      <Wordmark />
    </button>
  );
}
