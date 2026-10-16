"use client";

import { useState } from "react";
import type { GenerateReply } from "@/lib/schemas";
import type { Relationship } from "@/lib/checker";
import { DraftCard } from "./DraftCard";
import { Checker, RelationshipPicker } from "./Checker";
import { Button, Card, Label } from "./ui";

const TABS = [
  { id: "vault", label: "Story Vault" },
  { id: "profile", label: "Profile fix" },
  { id: "outreach", label: "Outreach" },
  { id: "posts", label: "Posts & comments" },
  { id: "check", label: "Check a message" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const KIND_LABEL: Record<string, string> = {
  story: "Story",
  number: "Number",
  proof: "Proof",
  skill: "Skill",
  opinion: "Opinion",
  constraint: "Constraint",
};

export function Results({
  result,
  fills,
  onFill,
  onClearVault,
  onRedo,
}: {
  result: GenerateReply;
  fills: Record<string, string[]>;
  onFill: (id: string, f: string[]) => void;
  onClearVault: () => void;
  onRedo: () => void;
}) {
  const [tab, setTab] = useState<Tab>("vault");
  const [rel, setRel] = useState<Relationship>("knows_me");
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
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
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
            <Label>Who are you messaging? The checker judges each draft against this.</Label>
            <RelationshipPicker value={rel} onChange={setRel} />
            {rel === "stranger" && (
              <p className="mt-3 text-sm text-warn">
                Strangers rarely refer strangers: a referral spends their reputation. Use the hiring-manager style message or
                ask one specific question first.
              </p>
            )}
          </Card>
          {card("out:referral", "message", result.outreach.referral)}
          {card("out:hm", "message", result.outreach.hiring_manager)}
          {card("out:follow", "message", result.outreach.follow_up)}
        </div>
      )}

      {tab === "posts" && (
        <div className="space-y-4">
          {result.posts.map((p, i) => card(`post:${i}`, "post", p))}
          <h3 className="pt-2 font-semibold">Comments to leave on posts in your field</h3>
          {result.comments.map((c, i) => card(`comment:${i}`, "comment", c))}
        </div>
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
