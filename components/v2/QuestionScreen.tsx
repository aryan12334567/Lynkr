"use client";

import { useId, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button, ErrorNote, inputCls } from "../ui";
import { useSpeech } from "../useSpeech";
import { ProgressBar } from "./ProgressBar";
import { actionsFor, chipsFor, composeAnswer, exampleFor, isSaveShortcut, saveState, STUCK_LABEL, stuckPress, toggleChip, type StuckLevel } from "./questionLogic";
import { byId, pick, SECTION_LABEL } from "@/lib/interview/bank";
import type { AnswerInput, AskStep } from "@/lib/interview/engine";
import type { Bucket } from "@/lib/schemas";

type Props = {
  bucket: Bucket;
  step: AskStep;
  progress: { done: number; total: number; pct: number };
  minutesLeft: number;
  reflection: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: AnswerInput) => void;
  /** The person's field as they picked it (the A3 chip, e.g. "Design"), so the example fits their kind of work. */
  field?: string | null;
};

/**
 * Interview v2, one question per screen (build plan Part 4). The server picked the question;
 * this screen only collects the answer. Local text resets for each new question or follow-up.
 */
export function QuestionScreen(props: Props) {
  const { step } = props;
  return <QuestionBody key={`${step.qid}.${step.attempt}.${step.revisit ? 1 : 0}`} {...props} />;
}

function QuestionBody({ bucket, step, progress, minutesLeft, reflection, busy, error, onSubmit, field }: Props) {
  const id = useId();
  const q = byId(step.qid);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [stuck, setStuck] = useState<StuckLevel>(0);
  const speech = useSpeech((t) => setText((v) => (v ? `${v.trimEnd()} ${t}` : t)));

  if (!q) return <ErrorNote message="This question couldn't be loaded. Please reload the page." />;

  const followUp = step.attempt > 0;
  const chips = chipsFor(q, bucket, step.attempt);
  const showText = !chips || !!chips.withText;
  const { example, examples: more } = exampleFor(q, bucket, field);
  const actions = actionsFor(q.tag);
  const state = saveState(q, bucket, step.attempt, picked, text);

  const base = { qid: step.qid, attempt: step.attempt, ...(step.trigger ? { trigger: step.trigger } : {}) };
  const save = () => {
    if (!state.ok || busy) return;
    speech.stop();
    onSubmit({ ...base, status: "answered", text: composeAnswer(chips, picked, text) });
  };
  const leave = (status: "skipped" | "parked" | "later") => {
    speech.stop();
    onSubmit({ ...base, status, text: "", ...(status === "parked" ? { round: step.revisit ? 2 : 1 } : {}) });
  };
  // Stuck ladder: rephrase, then more examples, then park (or Later for an enrichment question).
  const pressStuck = () => {
    const next = stuckPress(stuck);
    if (next.park) leave(actions.later ? "later" : "parked");
    else setStuck(next.level);
  };

  return (
    <section aria-labelledby={`${id}-q`} className="mx-auto w-full max-w-2xl">
      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between gap-3 text-[0.88rem] text-soft">
          <span>{SECTION_LABEL[q.section]}</span>
          <span className="text-faint">About {minutesLeft} min left</span>
        </div>
        <ProgressBar pct={progress.pct} />
      </div>

      <p aria-live="polite" className="min-h-6 text-[0.95rem] text-soft">
        {reflection}
      </p>

      <div className="mt-3">
        {followUp && <p className="mb-1 text-[0.82rem] font-semibold uppercase tracking-wide text-accent">Follow-up</p>}
        {step.revisit && !followUp && <p className="mb-1 text-[0.82rem] font-semibold uppercase tracking-wide text-faint">Coming back to this one</p>}
        <h2 id={`${id}-q`} className="text-[1.35rem] font-semibold leading-snug">
          {step.prompt}
        </h2>
      </div>

      {stuck >= 1 && (
        <div className="mt-4 space-y-2 rounded-xl bg-muted p-4 text-[0.95rem]" aria-live="polite">
          <p>
            <span className="font-semibold">Another way to put it: </span>
            {pick(q.rephrase, bucket)}
          </p>
          {stuck >= 2 && more.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-soft">
              {more.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        // Ctrl/Cmd+Enter saves from anywhere in the form, chips included. Caught before the chip sees it,
        // so it never toggles the focused chip; plain Enter or Space still toggles a chip.
        onKeyDownCapture={(e) => {
          if (!isSaveShortcut(e)) return;
          e.preventDefault();
          e.stopPropagation();
          save();
        }}
      >
        {chips && (
          <fieldset>
            <legend className="mb-2 text-[0.95rem] font-medium">{chips.multi ? "Pick any that fit" : "Pick one"}</legend>
            <div className="flex flex-wrap gap-2">
              {chips.options.map((o) => {
                const on = picked.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    role={chips.multi ? "checkbox" : "radio"}
                    aria-checked={on}
                    onClick={() => setPicked((p) => toggleChip(chips, p, o))}
                    className={`min-h-11 rounded-full border px-4 text-[0.95rem] transition-colors ${on ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink hover:border-accent/50"}`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {showText && (
          <div>
            <label htmlFor={`${id}-a`} className="mb-1.5 block text-[0.95rem] font-medium">
              {chips ? "Anything to add?" : "Your answer"}
            </label>
            <textarea
              id={`${id}-a`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby={`${id}-ex ${id}-hint`}
              className={`${inputCls} min-h-32 text-[1rem]`}
              placeholder="Type, or use the microphone"
            />
            {speech.supported && (
              <div className="mt-2">
                <Button type="button" variant="ghost" className="min-h-11" onClick={speech.listening ? speech.stop : speech.start} aria-pressed={speech.listening}>
                  {speech.listening ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
                  {speech.listening ? "Stop listening" : "Speak your answer"}
                </Button>
              </div>
            )}
            {speech.error && <p className="mt-2 text-[0.9rem] text-warn">{speech.error}</p>}
          </div>
        )}

        {showText && !followUp && (
          <div id={`${id}-ex`} className="rounded-xl border border-dashed border-line p-4">
            <p className="text-[0.82rem] font-semibold text-faint">Example answer, edit it so it&apos;s about you</p>
            <p className="mt-1 text-[0.95rem] text-soft">{example}</p>
            <Button type="button" variant="quiet" className="mt-2 min-h-11 px-0 text-accent" onClick={() => setText(example)}>
              Use as a starting point
            </Button>
          </div>
        )}

        <p id={`${id}-hint`} aria-live="polite" className="min-h-5 text-[0.9rem] text-warn">
          {state.hint}
        </p>
        <ErrorNote message={error} />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="min-h-11" disabled={!state.ok || busy}>
            {busy ? "Saving…" : "Save and continue"}
          </Button>
          {actions.notSure && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => leave("parked")}>
              Not sure yet
            </Button>
          )}
          {actions.later && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => leave("later")}>
              Later
            </Button>
          )}
          {actions.skip && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => leave("skipped")}>
              Skip
            </Button>
          )}
          <Button type="button" variant="quiet" className="min-h-11 sm:ml-auto" disabled={busy} onClick={pressStuck}>
            {STUCK_LABEL[stuck]}
          </Button>
        </div>
        <p className="text-[0.82rem] text-faint">Tip: press Ctrl+Enter to save.</p>
      </form>
    </section>
  );
}
