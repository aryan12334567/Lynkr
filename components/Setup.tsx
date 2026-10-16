"use client";

import { useState } from "react";
import { GOAL_LABEL, GOALS, ProfileInput, type Goal } from "@/lib/schemas";
import { Button, Card, ErrorNote, Label, inputCls } from "./ui";

export function Setup({
  initial,
  onDone,
}: {
  initial: ProfileInput | null;
  onDone: (p: ProfileInput) => void;
}) {
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "job");
  const [targetRole, setTargetRole] = useState(initial?.targetRole ?? "");
  const [background, setBackground] = useState(initial?.background ?? "");
  const [currentProfile, setCurrentProfile] = useState(initial?.currentProfile ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ProfileInput.safeParse({ goal, targetRole, background, currentProfile });
    if (!parsed.success) {
      setError("Add the role you want and a line about your background (at least 2 characters each).");
      return;
    }
    onDone(parsed.data);
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Start with the basics</h2>
          <p className="text-sm text-soft">Two minutes. Then a short interview pulls out the specifics.</p>
        </div>

        <fieldset>
          <Label>What do you want right now?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {GOALS.map((g) => (
              <label
                key={g}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  goal === g ? "border-accent bg-accent/10" : "border-line hover:bg-muted"
                }`}
              >
                <input type="radio" name="goal" checked={goal === g} onChange={() => setGoal(g)} className="accent-accent" />
                {GOAL_LABEL[g]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <Label>Target role</Label>
          <input
            className={inputCls}
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Data analyst, SDR, Frontend developer"
            maxLength={120}
          />
        </label>

        <label className="block">
          <Label>Your background in one or two lines</Label>
          <textarea
            className={`${inputCls} min-h-20`}
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="e.g. Final-year B.Com at a tier-3 college in Pune, self-taught SQL, no internship yet"
            maxLength={400}
          />
        </label>

        <label className="block">
          <Label hint="(optional)">Paste your current LinkedIn headline and About</Label>
          <textarea
            className={`${inputCls} min-h-24`}
            value={currentProfile}
            onChange={(e) => setCurrentProfile(e.target.value)}
            placeholder="Copy them from your profile. We never log in to LinkedIn."
            maxLength={4000}
          />
        </label>

        <ErrorNote message={error} />
        <Button type="submit">Start the interview</Button>
      </form>
    </Card>
  );
}
