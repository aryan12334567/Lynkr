"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { Draft, FirstWinReply, ProfileInput, StoryFact } from "@/lib/schemas";
import { track } from "@/lib/track";
import { DraftCard } from "../DraftCard";
import { Button } from "../ui";
import { firstWinBody } from "./readbackLogic";

type Load = { state: "loading" } | { state: "ready"; reply: FirstWinReply } | { state: "error"; message: string; account: boolean };

/**
 * The first win (build plan Part 5): right after the read-back, one headline and one referral
 * message, written only from confirmed facts. Blanks stay blanks until the person fills them,
 * and Copy stays off until they do. Free with an account; the rest of Lynkr is behind the paywall.
 */
export function FirstWin({ profile, facts, onContinue }: { profile: ProfileInput; facts: StoryFact[]; onContinue: () => void }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [headFills, setHeadFills] = useState<string[]>([]);
  const [refFills, setRefFills] = useState<string[]>([]);
  const shown = useRef(false);
  // The request is fixed when the screen opens: fixes after this point need a new read-back.
  const [body] = useState(() => JSON.stringify(firstWinBody(profile, facts)));

  const run = useCallback(
    (signal?: AbortSignal) => {
      void request(body, signal).then((next) => {
        if (!signal?.aborted) setLoad(next);
      });
    },
    [body],
  );

  useEffect(() => {
    const ac = new AbortController();
    run(ac.signal);
    return () => ac.abort();
  }, [run]);

  useEffect(() => {
    if (load.state === "ready" && !shown.current) {
      shown.current = true;
      track("first_win_shown", { bucket: profile.bucket });
    }
  }, [load.state, profile.bucket]);

  return (
    <section aria-labelledby="firstwin-title" aria-busy={load.state === "loading"} className="mx-auto w-full max-w-2xl">
      <h2 id="firstwin-title" className="text-[1.9rem] leading-tight tracking-[-0.03em] sm:text-[2.2rem]">
        Your first drafts
      </h2>
      <p className="mt-2 max-w-[56ch] text-soft">Written only from what you confirmed. Fill any blanks with the real detail, then copy.</p>

      {load.state === "loading" && (
        <p role="status" className="mt-8 flex items-center gap-2 text-soft">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Writing your headline and a referral message...
        </p>
      )}

      {load.state === "error" && (
        <div role="alert" className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <p className="text-ink">{load.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {load.account ? (
              <a href="/signup" className="inline-flex min-h-10 items-center rounded-full bg-accent px-5 font-semibold text-white hover:bg-accent-strong">
                Create a free account
              </a>
            ) : (
              <Button
                onClick={() => {
                  setLoad({ state: "loading" });
                  run();
                }}
              >
                Try again
              </Button>
            )}
          </div>
        </div>
      )}

      {load.state === "ready" && (
        <div className="mt-8 space-y-5">
          <DraftCard draft={headlineDraft(load.reply.headline)} fills={headFills} onFill={setHeadFills} kind="profile" facts={facts} />
          <DraftCard draft={load.reply.referral} fills={refFills} onFill={setRefFills} kind="message" relationship="knows_me" facts={facts} />
          <p className="text-[0.88rem] text-faint">Send the referral message only to someone who already knows you. Lynkr never sends anything for you.</p>
          <button
            type="button"
            onClick={onContinue}
            className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-[1rem] font-semibold text-white transition-colors hover:bg-ink/85 sm:w-auto"
          >
            See everything Lynkr can do <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}

/** One call to the first-win route, turned into the screen's next state. Never throws. */
async function request(body: string, signal?: AbortSignal): Promise<Load> {
  try {
    const res = await fetch("/api/first-win", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
    const data = (await res.json().catch(() => ({}))) as Partial<FirstWinReply> & { error?: string; code?: string };
    if (!res.ok || typeof data.headline !== "string" || !data.referral) {
      return { state: "error", message: data.error || "Couldn't write your drafts. Please try again.", account: res.status === 401 && data.code === "account_required" };
    }
    return { state: "ready", reply: data as FirstWinReply };
  } catch {
    return { state: "error", message: "Couldn't reach Lynkr. Check your connection and try again.", account: false };
  }
}

function headlineDraft(headline: string): Draft {
  return { title: "A headline for your profile", body: headline, why: "Paste it into the headline field on your LinkedIn profile.", factRefs: [] };
}
