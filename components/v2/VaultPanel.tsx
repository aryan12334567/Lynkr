"use client";

import { confidenceHints, groupFacts } from "./questionLogic";
import type { Brief } from "@/lib/interview/engine";
import { FACT_KIND_LABEL, WANT_LABEL, type StoryFact } from "@/lib/schemas";

/**
 * The live Story Vault beside the interview (Part 4): what Lynkr has understood so far.
 * A sticky side panel on large screens, a collapsible section on phones.
 */
export function VaultPanel({ facts, brief }: { facts: StoryFact[]; brief: Brief }) {
  const groups = groupFacts(facts);
  const count = groups.reduce((n, g) => n + g.facts.length, 0);
  const lines = [
    ["Now", brief.currentRole],
    ["Wants", brief.goals.map((g) => WANT_LABEL[g]).join(", ")],
    ["Target roles", brief.targetRoles],
    ["Target companies", brief.targetCompanies],
  ].filter(([, v]) => v);

  const body = (
    <div className="space-y-4 text-[0.92rem]">
      {lines.length > 0 && (
        <dl className="space-y-1.5">
          {lines.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[0.8rem] text-faint">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {groups.length === 0 && lines.length === 0 && <p className="text-soft">Your facts appear here as you answer.</p>}
      {groups.map((g) => (
        <section key={g.kind} aria-label={FACT_KIND_LABEL[g.kind]}>
          <h3 className="text-[0.8rem] font-semibold uppercase tracking-wide text-faint">{FACT_KIND_LABEL[g.kind]}</h3>
          <ul className="mt-1.5 space-y-2">
            {g.facts.map((f) => {
              const hints = confidenceHints(f.confidence);
              const confirmed = f.reviewStatus === "confirmed";
              return (
                <li key={f.id} className={`rounded-lg border p-2.5 ${confirmed ? "border-line bg-surface" : "border-dashed border-line bg-muted"}`}>
                  <p className="break-words">{f.text}</p>
                  <p className="mt-1 text-[0.78rem] text-faint">
                    {confirmed ? "Confirmed" : "To check at the end"}
                    {hints.length > 0 && ` · ${hints.join(" · ")}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <aside aria-label="Your Story Vault" className="lg:sticky lg:top-6">
      <p aria-live="polite" className="sr-only">
        {count} {count === 1 ? "fact" : "facts"} in your Story Vault
      </p>
      <details className="rounded-2xl border border-line bg-surface p-4 lg:hidden">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">
          Your Story Vault <span className="font-normal text-soft">({count})</span>
        </summary>
        <div className="mt-3">{body}</div>
      </details>
      <div className="hidden rounded-2xl border border-line bg-surface p-5 lg:block">
        <h2 className="mb-3 font-semibold">
          Your Story Vault <span className="font-normal text-soft">({count})</span>
        </h2>
        {body}
      </div>
    </aside>
  );
}
