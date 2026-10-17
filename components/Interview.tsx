"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewReply, ProfileInput, Turn } from "@/lib/schemas";
import { postJson } from "@/lib/store";
import { Button, Card, ErrorNote, inputCls } from "./ui";
import { useSpeech } from "./useSpeech";

const SKIPPED = "(skipped)";

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

export function Interview({
  profile,
  turns,
  onTurns,
  onFinish,
  onBack,
}: {
  profile: ProfileInput;
  turns: Turn[];
  onTurns: (t: Turn[]) => void;
  onFinish: (t: Turn[]) => void;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState<InterviewReply | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(-1);
  const speech = useSpeech((t) => setAnswer((a) => (a ? `${a} ${t}` : t)));

  async function ask(history: Turn[]) {
    setLoading(true);
    setError(null);
    try {
      const reply = await postJson<InterviewReply>("/api/interview", { profile, turns: history });
      if (reply.done) onFinish(history);
      else setCurrent(reply);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Ask the first (or next, after a reload) question once per turn count.
  useEffect(() => {
    if (asked.current === turns.length) return;
    asked.current = turns.length;
    ask(turns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(a: string) {
    if (!current) return;
    speech.stop();
    const next = [...turns, { q: current.question, a }];
    onTurns(next);
    setAnswer("");
    setCurrent(null);
    asked.current = next.length;
    ask(next);
  }

  const answered = turns.filter((t) => t.a !== SKIPPED).length;

  return (
    <Card>
      <div className="mb-5 flex items-center justify-between gap-3 text-[0.9rem] text-soft">
        <span>
          Question {turns.length + 1} <span className="text-faint">of about 7</span>
        </span>
        <Button variant="quiet" onClick={onBack}>
          Edit basics
        </Button>
      </div>

      {loading && !current && <p className="animate-pulse text-soft">Thinking of the next question…</p>}

      {current && (
        <div className="space-y-4">
          <div>
            <p className="font-serif text-[1.3rem] font-bold leading-snug">{current.question}</p>
            {current.why && <p className="mt-2 text-[0.92rem] text-faint">{current.why}</p>}
          </div>
          <label className="sr-only" htmlFor="answer">
            Your answer
          </label>
          <textarea
            id="answer"
            className={`${inputCls} min-h-32 text-[1rem]`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={speech.supported ? "Type, or tap Speak and talk. You can edit before sending." : "Type your answer"}
            maxLength={1500}
            autoFocus
          />
          {speech.error && <p className="text-[0.9rem] text-warn">{speech.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!answer.trim()} onClick={() => send(answer.trim())}>
              Send answer
            </Button>
            {speech.supported && (
              <Button variant="ghost" onClick={speech.listening ? speech.stop : speech.start} aria-pressed={speech.listening}>
                <MicIcon />
                {speech.listening ? "Stop mic" : "Speak"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => send(SKIPPED)}>
              Skip
            </Button>
            {answered >= 3 && (
              <Button variant="quiet" onClick={() => onFinish(turns)} className="sm:ml-auto">
                Review my facts now
              </Button>
            )}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <details className="mt-6 border-t border-line pt-4 text-[0.92rem]">
          <summary className="cursor-pointer text-soft">Your answers so far ({turns.length})</summary>
          <ol className="mt-3 space-y-2">
            {turns.map((t, i) => (
              <li key={i} className="rounded-md bg-muted p-3">
                <p className="text-soft">{t.q}</p>
                <p className="mt-1">{t.a === SKIPPED ? <span className="text-faint">Skipped</span> : t.a}</p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="mt-4">
        <ErrorNote message={error} />
        {error && (
          <Button variant="ghost" className="mt-2" onClick={() => ask(turns)}>
            Try again
          </Button>
        )}
      </div>
    </Card>
  );
}
