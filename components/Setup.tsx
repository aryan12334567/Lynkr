"use client";

import { useState } from "react";
import { GOAL_LABEL, GOALS, ProfileInput, type Goal } from "@/lib/schemas";
import { AUDIENCE_LABEL, AUDIENCES, DOMAIN_LABEL, DOMAINS, STAGE_LABEL, STAGES, suggestDomain, type Audience, type Domain, type Stage } from "@/lib/roles";
import { Button, Card, Choice, ErrorNote, Label, inputCls } from "./ui";

/**
 * Basics plus a short content profile (prod plans: posts §3.1, profile fix §3).
 * The field is suggested from the role text only, and stays a suggestion until confirmed.
 */
export function Setup({ initial, onDone }: { initial: ProfileInput | null; onDone: (p: ProfileInput) => void }) {
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "job");
  const [targetRole, setTargetRole] = useState(initial?.targetRole ?? "");
  const [domain, setDomain] = useState<Domain>(initial?.domain ?? "not_sure");
  const [domainConfirmed, setDomainConfirmed] = useState(initial?.domainConfirmed ?? false);
  const [background, setBackground] = useState(initial?.background ?? "");
  const [stage, setStage] = useState<Stage>(initial?.stage ?? "other");
  const [audiences, setAudiences] = useState<Audience[]>(initial?.audiences ?? []);
  const [specialization, setSpecialization] = useState(initial?.specialization ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [market, setMarket] = useState(initial?.market ?? "");
  const [keepPrivate, setKeepPrivate] = useState(initial?.keepPrivate ?? "");
  const [currentProfile, setCurrentProfile] = useState(initial?.currentProfile ?? "");
  const [error, setError] = useState<string | null>(null);

  function onRole(v: string) {
    setTargetRole(v);
    if (!domainConfirmed) setDomain(suggestDomain(v));
  }

  function toggleAudience(a: Audience) {
    setAudiences((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : cur.length >= 2 ? [cur[1], a] : [...cur, a]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ProfileInput.safeParse({
      goal,
      targetRole,
      background,
      currentProfile,
      domain,
      // Continuing past a suggestion the user saw counts as accepting it; "not sure" is always fine.
      domainConfirmed: true,
      specialization,
      industry,
      stage,
      market,
      audiences,
      topics: initial?.topics ?? [],
      keepPrivate,
    });
    if (!parsed.success) {
      setError("Add the role you want and a line about your background (at least 2 characters each).");
      return;
    }
    onDone(parsed.data);
  }

  const suggested = targetRole.trim().length >= 2 && !domainConfirmed && domain !== "not_sure";

  return (
    <Card className="shadow-[0_24px_48px_-36px_rgba(26,31,61,0.45)]">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h2 className="text-xl font-bold">Start with the basics</h2>
          <p className="mt-1 text-[0.95rem] text-soft">About a minute. Then a short interview about one real piece of work.</p>
        </div>

        <fieldset>
          <legend className="contents">
            <Label>What do you want right now?</Label>
          </legend>
          <Choice label="What do you want right now?" value={goal} onChange={setGoal} options={GOALS.map((g) => ({ value: g, label: GOAL_LABEL[g] }))} />
        </fieldset>

        <label className="block">
          <Label>Target role</Label>
          <input className={inputCls} value={targetRole} onChange={(e) => onRole(e.target.value)} placeholder="e.g. Data analyst, SDR, Frontend developer" maxLength={120} />
        </label>

        <label className="block">
          <Label hint={suggested ? "(suggested from your role)" : undefined}>Closest field</Label>
          <select
            className={inputCls}
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value as Domain);
              setDomainConfirmed(true);
            }}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABEL[d]}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[0.85rem] text-faint">Change it if it&apos;s wrong. &quot;Not sure yet&quot; and &quot;Mixed&quot; are fine.</span>
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
          <Label>Where you are now</Label>
          <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
            {STAGES.map((st) => (
              <option key={st} value={st}>
                {STAGE_LABEL[st]}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="contents">
            <Label hint="(up to two)">Who do you most want to hear from?</Label>
          </legend>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <label key={a} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[0.9rem] ${audiences.includes(a) ? "border-accent bg-accent/10 text-ink" : "border-line text-soft hover:border-accent/50"}`}>
                <input type="checkbox" className="accent-[var(--accent)]" checked={audiences.includes(a)} onChange={() => toggleAudience(a)} />
                {AUDIENCE_LABEL[a]}
              </label>
            ))}
          </div>
        </fieldset>

        <details className="group rounded-md border border-line px-4 py-3">
          <summary className="cursor-pointer text-[0.95rem] font-medium">More detail for a sharper profile check (optional)</summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <Label>Specialisation</Label>
                <input className={inputCls} value={specialization} onChange={(e) => setSpecialization(e.target.value)} maxLength={80} placeholder="e.g. credit research, ML infra" />
              </label>
              <label className="block">
                <Label>Industry focus</Label>
                <input className={inputCls} value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={80} placeholder="e.g. healthcare, fintech" />
              </label>
              <label className="block">
                <Label>Market or city</Label>
                <input className={inputCls} value={market} onChange={(e) => setMarket(e.target.value)} maxLength={80} placeholder="e.g. Bengaluru, remote in India" />
              </label>
              <label className="block">
                <Label>Keep out of public drafts</Label>
                <input className={inputCls} value={keepPrivate} onChange={(e) => setKeepPrivate(e.target.value)} maxLength={200} placeholder="e.g. that I'm job hunting" />
              </label>
            </div>
            <label className="block">
              <Label>Paste your current LinkedIn headline and About</Label>
              <textarea
                className={`${inputCls} min-h-24`}
                value={currentProfile}
                onChange={(e) => setCurrentProfile(e.target.value)}
                placeholder="Headline on the first line, About below it. We never log in to LinkedIn."
                maxLength={4000}
              />
            </label>
          </div>
        </details>

        <ErrorNote message={error} />
        <Button type="submit" className="w-full sm:w-auto">
          Start the interview
        </Button>
      </form>
    </Card>
  );
}
