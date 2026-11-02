"use client";

import { useId } from "react";
import type { OutreachGoal } from "@/lib/outreach/goals";
import { GOAL_CHIPS, canSave, toggleGoal } from "@/lib/outreach/ui-goals";
import { chipCls } from "@/lib/outreach/ui-style";
import { Button, Card } from "../ui";

/**
 * One screen of goal chips (R1). The interview's answers are already chosen, so one tap confirms.
 * Questions about a goal come later, only when a draft would be better for the answer (R3, R36).
 */
export function GoalSetup({ selected, onChange, onSave, saving, firstVisit, preselected, onCancel }: {
  selected: OutreachGoal[];
  onChange: (goals: OutreachGoal[]) => void;
  onSave: () => void;
  saving: boolean;
  firstVisit: boolean;
  /** True when the chips were chosen from the interview. */
  preselected: boolean;
  onCancel?: () => void;
}) {
  const hintId = useId();
  return (
    <Card>
      <fieldset aria-describedby={hintId}>
        <legend className="text-xl font-bold">What do you want from LinkedIn?</legend>
        <p id={hintId} className="mt-1 max-w-[62ch] text-soft">
          {preselected ? "We chose these from your interview. Change them if they're wrong. " : "Choose one or more. "}You can change your goals at any time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {GOAL_CHIPS.map((g) => (
            <button key={g.id} type="button" aria-pressed={selected.includes(g.id)} title={g.description} onClick={() => onChange(toggleGoal(selected, g.id))} className={chipCls(selected.includes(g.id))}>
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button disabled={!canSave(selected) || saving} onClick={onSave}>{saving ? "Saving" : firstVisit ? "Looks right" : "Save goals"}</Button>
        {onCancel && <Button variant="quiet" onClick={onCancel}>Cancel</Button>}
        {!canSave(selected) && <p className="text-[0.9rem] text-soft">Choose at least one goal to continue.</p>}
      </div>
    </Card>
  );
}
