"use client";

import { useState } from "react";
import { filterContacts, groupByStage, isBooster, type UiContact } from "@/lib/outreach/ui-board";
import { goalLabel } from "@/lib/outreach/ui-goals";
import { shortDate } from "@/lib/outreach/ui-timeline";
import { chipCls } from "@/lib/outreach/ui-style";
import { Card, Pill, SectionHead } from "../ui";

/**
 * Everyone you're writing to, in a column for the stage they have reached. The stage comes from the timeline,
 * so nobody moves a person by hand. Tier 1 people come first in each column.
 */
export function PeopleBoard({ contacts, selectedId, onSelect, example }: {
  contacts: UiContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Id of the made-up example person, if shown. */
  example?: string;
}) {
  const [tier1, setTier1] = useState(false);
  const [boosters, setBoosters] = useState(false);
  const shown = filterContacts(contacts, { tier1, boosters });
  const columns = groupByStage(shown).filter((c) => c.contacts.length > 0);
  return (
    <Card>
      <SectionHead title="People">Each person sits in the column for the furthest step you&apos;ve recorded.</SectionHead>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter people">
        <button type="button" aria-pressed={tier1} onClick={() => setTier1((v) => !v)} className={chipCls(tier1)}>Tier 1 only</button>
        <button type="button" aria-pressed={boosters} onClick={() => setBoosters((v) => !v)} className={chipCls(boosters)}>Boosters only</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{shown.length} {shown.length === 1 ? "person" : "people"} shown</p>
      {contacts.length === 0 ? (
        <p className="text-soft">No one yet. Add a person below, or pick someone from your connections.</p>
      ) : columns.length === 0 ? (
        <p className="text-soft">No one matches these filters. {boosters ? "Boosters are people who have replied to you." : ""}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {columns.map((col) => (
            <section key={col.id} aria-labelledby={`stage-${col.id}`} className="min-w-0 rounded-xl bg-muted/40 p-3">
              <h4 id={`stage-${col.id}`} className="mb-2 text-[0.95rem] font-bold">{col.label} <span className="font-normal text-soft">({col.contacts.length})</span></h4>
              <ul className="space-y-2">
                {col.contacts.map((c) => (
                  <li key={c.id}>
                    <button type="button" aria-pressed={selectedId === c.id} onClick={() => onSelect(c.id)}
                      className={`min-h-10 w-full rounded-lg border bg-surface p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${selectedId === c.id ? "border-accent" : "border-line"}`}>
                      <span className="block break-words font-medium">{c.name}</span>
                      <span className="block break-words text-[0.88rem] text-soft">{[c.role, c.company].filter(Boolean).join(" at ") || goalLabel(c.goal)}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {c.tier === "tier_1" && <Pill tone="accent">Tier 1</Pill>}
                        {isBooster(c) && <Pill tone="good">Booster</Pill>}
                        {example === c.id && <Pill>Example</Pill>}
                        {c.nextActionAt && <span className="text-[0.82rem] text-soft">Next step {shortDate(c.nextActionAt)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
