"use client";

import { useEffect, useState } from "react";
import type { GenerateReply, ProfileInput, Turn } from "@/lib/schemas";
import { clear, EMPTY, load, postJson, save, type Saved } from "@/lib/store";
import { Setup } from "./Setup";
import { Interview } from "./Interview";
import { Results } from "./Results";
import { Checker } from "./Checker";
import { Button, Card, ErrorNote } from "./ui";

export function LynkrApp() {
  const [s, setS] = useState<Saved>(load);
  const [mock, setMock] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showChecker, setShowChecker] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: { mock: boolean }) => setMock(d.mock))
      .catch(() => setMock(null));
  }, []);

  useEffect(() => save(s), [s]);

  const update = (patch: Partial<Saved>) => setS((prev) => ({ ...prev, ...patch }));

  async function generate(profile: ProfileInput, turns: Turn[]) {
    update({ stage: "generating", turns });
    setError(null);
    try {
      const result = await postJson<GenerateReply>("/api/generate", { profile, turns });
      update({ stage: "results", result, fills: {} });
    } catch (e) {
      setError((e as Error).message);
      update({ stage: "interview" });
    }
  }

  function reset() {
    clear();
    setS(EMPTY);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Lynkr<span className="text-accent">.</span>
          </h1>
          {mock && (
            <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-0.5 text-xs text-warn">
              Demo mode: no AI key, drafts are templates
            </span>
          )}
        </div>
        <p className="mt-2 text-soft">
          Get replies from real people on LinkedIn without sounding like AI. Free for freshers and early-career job seekers.
        </p>
      </header>

      <main className="space-y-4">
        <ErrorNote message={error} />

        {s.stage === "setup" && (
          <>
            <Setup initial={s.profile} onDone={(profile) => update({ profile, stage: "interview" })} />
            <div className="text-center">
              <button onClick={() => setShowChecker((v) => !v)} className="text-sm text-accent hover:underline">
                {showChecker ? "Hide the message checker" : "Just want to check a message you already wrote?"}
              </button>
            </div>
            {showChecker && <Checker />}
          </>
        )}

        {s.stage === "interview" && s.profile && (
          <Interview
            profile={s.profile}
            turns={s.turns}
            onTurns={(turns) => update({ turns })}
            onFinish={(turns) => generate(s.profile!, turns)}
            onBack={() => update({ stage: "setup" })}
          />
        )}

        {s.stage === "generating" && (
          <Card>
            <p className="animate-pulse font-medium">Writing your profile fixes, messages and posts…</p>
            <p className="mt-1 text-sm text-soft">Only from what you told us. Anything we don&apos;t know becomes a blank for you to fill.</p>
          </Card>
        )}

        {s.stage === "results" && s.result && (
          <Results
            result={s.result}
            fills={s.fills}
            onFill={(id, f) => setS((prev) => ({ ...prev, fills: { ...prev.fills, [id]: f } }))}
            onClearVault={reset}
            onRedo={() => update({ stage: "interview" })}
          />
        )}
      </main>

      <footer className="mt-12 border-t border-line pt-6 text-xs leading-relaxed text-faint">
        <p>
          <strong className="text-soft">No LinkedIn login. No scraping. No auto-posting or auto-messaging.</strong> You copy
          and send everything yourself. Your answers are sent to the AI only to write drafts and are not stored by us; your
          Story Vault stays in this browser.
        </p>
        {s.stage !== "setup" && (
          <Button variant="ghost" className="mt-3" onClick={reset}>
            Start over
          </Button>
        )}
      </footer>
    </div>
  );
}
