"use client";

import { useState } from "react";
import type { GenerateReply, ProfileInput } from "@/lib/schemas";
import type { Relationship } from "@/lib/checker";
import { newPlan, type Plan } from "@/lib/plan";
import { WeekPlan } from "./WeekPlan";
import { ConnectCoach } from "./ConnectCoach";
import type { Connect } from "@/lib/connect";
import { DraftCard } from "./DraftCard";
import { Checker, RelationshipPicker } from "./Checker";
import { Button, Card, Label } from "./ui";

const TABS = [
  { id: "vault", label: "Story Vault" },
  { id: "profile", label: "Profile fix" },
  { id: "outreach", label: "Outreach" },
  { id: "posts", label: "Posts & comments" },
  { id: "plan", label: "This week" },
  { id: "connect", label: "Connect" },
  { id: "check", label: "Check a message" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const LADDER: Record<Relationship, string> = {
  stranger: "Ask one specific question about their work. Don't ask a stranger for a referral: it spends their reputation on someone they don't know.",
  alumni: "Use the shared college and ask for a 15-minute chat. Save the referral ask for later.",
  knows_me: "Ask for a referral with the job ID, your resume and why you fit, and make it easy to say no.",
};

const KIND_LABEL: Record<string, string> = {
  story: "Story",
  number: "Number",
  proof: "Proof",
  skill: "Skill",
  opinion: "Opinion",
  constraint: "Constraint",
  target: "Target",
};

export function Results({
  result,
  fills,
  onFill,
  onClearVault,
  onRedo,
  plan,
  onPlan,
  profile,
  connect,
  onConnect,
}: {
  result: GenerateReply;
  fills: Record<string, string[]>;
  onFill: (id: string, f: string[]) => void;
  onClearVault: () => void;
  onRedo: () => void;
  plan: Plan | null;
  onPlan: (p: Plan) => void;
  profile: ProfileInput;
  connect: Connect;
  onConnect: (c: Connect) => void;
}) {
  const [tab, setTab] = useState<Tab>("vault");
  const [rel, setRel] = useState<Relationship>("stranger");
  const card = (id: string, kind: "post" | "comment" | "message", draft: GenerateReply["posts"][number]) => (
    <DraftCard
      key={id}
      draft={draft}
      kind={kind}
      relationship={rel}
      fills={fills[id] ?? []}
      onFill={(f) => onFill(id, f)}
    />
  );

  return (
    <div className="space-y-4">
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={(e) => {
              // The plan is built the first time this tab opens, from the current drafts.
              if (t.id === "plan" && !plan) onPlan(newPlan());
              setTab(t.id);
              // On phones the tab row scrolls sideways; keep the chosen tab visible.
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              tab === t.id ? "bg-ink text-bg" : "text-soft hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "vault" && (
        <Card>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Facts from your own answers</h3>
              <p className="text-sm text-soft">
                Every draft is built only from these. Stored in this browser only.
              </p>
            </div>
            <Button variant="danger" onClick={onClearVault}>
              Clear everything
            </Button>
          </div>
          {result.vault.length === 0 ? (
            <p className="text-sm text-faint">No facts yet. Answer a few interview questions.</p>
          ) : (
            <ul className="space-y-2">
              {result.vault.map((v, i) => (
                <li key={i} className="flex gap-3 rounded-lg bg-muted p-3 text-sm">
                  <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-faint">
                    {KIND_LABEL[v.kind] ?? v.kind}
                  </span>
                  <span>{v.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "profile" && (
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-semibold">Headline options</h3>
            <ol className="space-y-2 text-sm">
              {result.profile.headlines.map((h, i) => (
                <li key={i} className="rounded-lg bg-muted p-3">
                  {h}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-faint">Replace anything in [[brackets]] with your real detail.</p>
          </Card>
          {card("profile:about", "comment", { title: "About section", body: result.profile.about, why: "Built from your facts and the words recruiters search for." })}
          <Card>
            <h3 className="mb-3 font-semibold">Fix these on your profile</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {result.profile.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "outreach" && (
        <div className="space-y-4">
          <Card>
            <Label>Who are you messaging?</Label>
            <RelationshipPicker value={rel} onChange={setRel} />
            <p className="mt-3 text-sm text-soft">{LADDER[rel]}</p>
          </Card>
          {(() => {
            // Ask ladder: the first message depends on how well they know you.
            const rung = rel === "stranger" ? result.outreach.stranger : rel === "alumni" ? result.outreach.alumni : result.outreach.referral;
            const id = rel === "stranger" ? "out:stranger" : rel === "alumni" ? "out:alumni" : "out:referral";
            if (!rung) {
              // Results saved before the ask ladder existed have no stranger/alumni drafts.
              return (
                <Card>
                  <p className="text-sm">This message is new. Rewrite your drafts to get it; your answers are kept.</p>
                  <Button className="mt-3" onClick={onRedo}>
                    Rewrite drafts
                  </Button>
                </Card>
              );
            }
            return card(id, "message", rung);
          })()}
          {card("out:follow", "message", result.outreach.follow_up)}
          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">Other drafts: cold message to a hiring manager</summary>
            <div className="mt-4">{card("out:hm", "message", result.outreach.hiring_manager)}</div>
          </details>
        </div>
      )}

      {tab === "posts" && (
        <div className="space-y-4">
          {result.posts.map((p, i) => card(`post:${i}`, "post", p))}
          <h3 className="pt-2 font-semibold">Comments to leave on posts in your field</h3>
          {result.comments.map((c, i) => card(`comment:${i}`, "comment", c))}
        </div>
      )}

      {tab === "plan" && plan && <WeekPlan plan={plan} onPlan={onPlan} result={result} fills={fills} />}

      {tab === "connect" && (
        <ConnectCoach
          result={result}
          profile={profile}
          connect={connect}
          onConnect={onConnect}
          onRedo={onRedo}
          onGoTo={(t, r) => {
            if (r) setRel(r);
            setTab(t);
          }}
        />
      )}

      {tab === "check" && <Checker />}

      <div className="pt-2">
        <Button variant="ghost" onClick={onRedo}>
          Answer more questions and rewrite
        </Button>
      </div>
    </div>
  );
}
