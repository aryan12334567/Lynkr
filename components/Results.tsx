"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, CalendarDays, House, Library, PenLine, Send, Users } from "lucide-react";
import type { Draft, Packet } from "@/lib/schemas";
import type { Relationship } from "@/lib/checker";
import { newPlan } from "@/lib/plan";
import { EMPTY_PACKET } from "@/lib/packet";
import { DOMAIN_LABEL, STAGE_LABEL } from "@/lib/roles";
import type { DraftEdit, Saved } from "@/lib/store";
import { WeekPlan } from "./WeekPlan";
import { ConnectCoach } from "./ConnectCoach";
import { OutreachWorkspace } from "./outreach/OutreachWorkspace";
import { DraftCard } from "./DraftCard";
import { Checker, RelationshipPicker } from "./Checker";
import { VaultReview } from "./VaultReview";
import { CommentHelper } from "./CommentHelper";
import { Today } from "./Today";
import { AccountMenu } from "./AccountMenu";
import type { Account } from "@/lib/auth-client";
import { ConfirmReset, DemoPill, LegalLinks, SavedHint, TrustNote, Wordmark } from "./chrome";
import { Button, Card, ErrorNote, Label, SectionHead } from "./ui";

const TABS = [
  { id: "today", label: "Today", icon: House, sub: "What to do next, from what's already in your Story Vault." },
  { id: "vault", label: "Story Vault", icon: Library, sub: "The facts every draft is built from." },
  { id: "outreach", label: "Outreach", icon: Send, sub: "First messages that match how well they know you." },
  { id: "posts", label: "Posts & comments", icon: PenLine, sub: "From your own work, and for posts you found." },
  { id: "plan", label: "This week", icon: CalendarDays, sub: "A small, steady plan. Nothing is posted for you." },
  { id: "connect", label: "Connect", icon: Users, sub: "Who to look for, and one person at a time." },
  { id: "check", label: "Check a message", icon: BadgeCheck, sub: "The person and the reason first, then the wording." },
] as const;
export type Tab = (typeof TABS)[number]["id"];
export const TAB_IDS: Tab[] = TABS.map((t) => t.id);

const LADDER: Record<Relationship, string> = {
  stranger: "Ask one specific question about their work. Don't ask a stranger for a referral: it spends their reputation on someone they don't know.",
  alumni: "Use the shared college and ask one question, or for a short chat. Save the referral ask for later.",
  knows_me: "Ask for a referral with the job ID, your resume and why you fit, and make it easy to say no.",
};

export function Results({
  s,
  setS,
  mock,
  error,
  tab,
  onTab,
  onHome,
  onRewrite,
  onMoreQuestions,
  onReset,
  account = null,
}: {
  s: Saved;
  setS: React.Dispatch<React.SetStateAction<Saved>>;
  mock: boolean | null;
  error: string | null;
  tab: Tab;
  onTab: (t: Tab) => void;
  onHome: () => void;
  onRewrite: () => void;
  onMoreQuestions: () => void;
  onReset: () => void;
  /** The signed-in account, if any: shown with billing and sign-out. */
  account?: Account | null;
}) {
  const [outreachV2, setOutreachV2] = useState(false);
  useEffect(() => { fetch("/api/status").then(r => r.json()).then(d => setOutreachV2(d.outreach === "v2")).catch(() => {}); }, []);
  const [rel, setRel] = useState<Relationship>("stranger");
  // The person described in Connect: in memory only, shared with the checker.
  const [packet, setPacket] = useState<Packet>(EMPTY_PACKET);
  const reduce = useReducedMotion();
  // The weekly plan exists from the first visit, so Today and This week agree.
  useEffect(() => {
    if (!s.plan) setS((prev) => (prev.plan ? prev : { ...prev, plan: newPlan() }));
  }, [s.plan, setS]);
  const result = s.result!;
  const profile = s.profile!;
  const current = TABS.find((t) => t.id === tab)!;
  // What a draft may draw on: confirmed facts, the background line and the target role.
  const groundIn = [...s.facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts).map((f) => f.text), profile.background, profile.targetRole];

  const onFill = (id: string, f: string[]) => setS((prev) => ({ ...prev, fills: { ...prev.fills, [id]: f } }));
  const onEdit = (id: string, e: DraftEdit | null) =>
    setS((prev) => {
      const edits = { ...prev.edits };
      if (e) edits[id] = e;
      else delete edits[id];
      return { ...prev, edits };
    });

  const card = (id: string, kind: "post" | "comment" | "message", draft: Draft) => (
    <DraftCard
      key={id}
      draft={draft}
      kind={kind}
      relationship={rel}
      fills={s.fills[id] ?? []}
      onFill={(f) => onFill(id, f)}
      edit={s.edits[id]}
      onEdit={(e) => onEdit(id, e)}
      facts={s.facts}
      groundIn={groundIn}
    />
  );

  function go(t: Tab) {
    // The plan is built the first time it's needed.
    if ((t === "plan" || t === "today") && !s.plan) setS((prev) => ({ ...prev, plan: prev.plan ?? newPlan() }));
    onTab(outreachV2 && t === "connect" ? "outreach" : t);
  }

  const summary = [profile.domain && profile.domain !== "not_sure" ? DOMAIN_LABEL[profile.domain] : "", profile.stage && profile.stage !== "other" ? STAGE_LABEL[profile.stage] : ""].filter(Boolean);

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="border-line bg-surface/70 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-5 sm:px-6 lg:block lg:px-5 lg:pt-7">
          <button onClick={onHome} aria-label="Lynkr home page" className="rounded-md">
            <Wordmark className="text-[1.45rem]" />
          </button>
          {mock && (
            <div className="lg:mt-4">
              <DemoPill />
            </div>
          )}
        </div>
        <div className="mx-5 mt-6 hidden rounded-xl border border-line bg-surface p-3.5 shadow-sm lg:block">
          <p className="text-[0.78rem] text-faint">Working towards</p>
          <p className="font-serif text-[1rem] font-bold leading-snug">{profile.targetRole}</p>
          {summary.map((x) => (
            <p key={x} className="text-[0.82rem] text-soft">
              {x}
            </p>
          ))}
        </div>
        <nav
          className="sticky top-0 z-20 mt-4 flex scroll-px-4 gap-1 overflow-x-auto border-b border-line bg-bg/90 px-4 py-2 backdrop-blur [scrollbar-width:none] sm:px-6 lg:static lg:mt-5 lg:flex-col lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-3 lg:py-0 lg:backdrop-blur-none"
          role="tablist"
          aria-label="Your drafts and tools"
        >
          {TABS.filter(t => !outreachV2 || t.id !== "connect").map((t) => {
            const I = t.icon;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={(e) => {
                  go(t.id);
                  // On phones the tab row scrolls sideways; keep the chosen tab visible.
                  e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                }}
                className={`relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-[0.93rem] transition-colors ${
                  on ? "font-medium text-ink" : "text-soft hover:bg-muted hover:text-ink"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-lg bg-surface shadow-sm ring-1 ring-line lg:shadow-[inset_3px_0_0_var(--accent),var(--elev-sm)]"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <I size={17} strokeWidth={1.8} className={`relative ${on ? "text-accent" : ""}`} aria-hidden />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-8 hidden space-y-3 px-5 pb-8 lg:block">
          <AccountMenu account={account} />
          <TrustNote mock={mock} />
          <ConfirmReset onReset={onReset} className="-ml-2" />
          <LegalLinks />
        </div>
      </aside>

      <main className="min-w-0 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
            <div>
              <h1 className="text-[1.75rem] font-extrabold leading-tight">{current.label}</h1>
              <p className="mt-1 text-[0.95rem] text-soft">{current.sub}</p>
            </div>
            <SavedHint />
          </div>
          <ErrorNote message={error} />

            <motion.div
              key={tab}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              {tab === "today" && <Today s={s} go={go} outreachV2={outreachV2} />}

              {tab === "vault" && (
                <VaultReview
                  mode="manage"
                  profile={profile}
                  turns={s.turns}
                  facts={s.facts}
                  onFacts={(facts) => setS((prev) => ({ ...prev, facts }))}
                  onProfile={(p) => setS((prev) => ({ ...prev, profile: p }))}
                  busy={false}
                  onWrite={onRewrite}
                  onBack={onMoreQuestions}
                  onClear={onReset}
                />
              )}

              {outreachV2 && (tab === "outreach" || tab === "connect") && <OutreachWorkspace profile={profile} />}

              {!outreachV2 && tab === "outreach" && (
                <div className="space-y-4">
                  <Card>
                    <Label>Who are you messaging?</Label>
                    <RelationshipPicker value={rel} onChange={setRel} />
                    <p className="mt-3 max-w-[62ch] text-[0.95rem] text-soft">{LADDER[rel]}</p>
                    <p className="mt-2 text-[0.9rem] text-soft">
                      These are starting templates. For one specific person, use{" "}
                      <button className="font-medium text-accent hover:underline" onClick={() => go("connect")}>
                        Write to one person
                      </button>{" "}
                      in Connect: it checks the reason first.
                    </p>
                  </Card>
                  {(() => {
                    // Ask ladder: the first message depends on how well they know you.
                    const rung = rel === "stranger" ? result.outreach.stranger : rel === "alumni" ? result.outreach.alumni : result.outreach.referral;
                    const id = rel === "stranger" ? "out:stranger" : rel === "alumni" ? "out:alumni" : "out:referral";
                    if (!rung) {
                      // Results saved before the ask ladder existed have no stranger/alumni drafts.
                      return (
                        <Card>
                          <p className="text-[0.95rem]">This message is new. Rewrite your drafts to get it; your answers are kept.</p>
                          <Button className="mt-3" onClick={onRewrite}>
                            Rewrite drafts
                          </Button>
                        </Card>
                      );
                    }
                    return card(id, "message", rung);
                  })()}
                  {card("out:follow", "message", result.outreach.follow_up)}
                  <details className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                    <summary className="cursor-pointer text-[0.95rem] font-medium">Other drafts: cold message to a hiring manager</summary>
                    <div className="mt-4">{card("out:hm", "message", result.outreach.hiring_manager)}</div>
                  </details>
                </div>
              )}

              {tab === "posts" && (
                <div className="space-y-8">
                  <section className="space-y-4">
                    <SectionHead title="Posts from your own work">
                      Each starts with something you did. A closing question only belongs if you really want the answer.
                    </SectionHead>
                    {result.posts.map((p, i) => card(`post:${i}`, "post", p))}
                  </section>
                  <section id="comments" className="space-y-4">
                    <CommentHelper profile={profile} facts={s.facts} mock={mock} kept={s.keptComments} onKeep={(k) => setS((prev) => ({ ...prev, keptComments: k }))} />
                    <details className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                      <summary className="cursor-pointer text-[0.95rem] font-medium">Example comment patterns</summary>
                      <div className="mt-4 space-y-4">{result.comments.map((c, i) => card(`comment:${i}`, "comment", c))}</div>
                    </details>
                  </section>
                </div>
              )}

              {tab === "plan" && s.plan && (
                <WeekPlan
                  plan={s.plan}
                  onPlan={(plan) => setS((prev) => ({ ...prev, plan }))}
                  result={result}
                  fills={s.fills}
                  onOpenDraft={(draftId) => go(draftId.startsWith("out:") ? "outreach" : "posts")}
                />
              )}

              {!outreachV2 && tab === "connect" && (
                <ConnectCoach
                  profile={profile}
                  facts={s.facts}
                  connect={s.connect}
                  onConnect={(connect) => setS((prev) => ({ ...prev, connect }))}
                  packet={packet}
                  onPacket={setPacket}
                  mock={mock}
                  onGoTo={(t, r) => {
                    if (r) setRel(r);
                    go(t);
                  }}
                />
              )}

              {tab === "check" && <Checker facts={s.facts} packet={packet} mock={mock} />}
            </motion.div>

          <div className="pt-10 lg:hidden">
            <AccountMenu account={account} className="mb-4" />
            <TrustNote mock={mock} />
            <ConfirmReset onReset={onReset} className="mt-2 -ml-2" />
            <LegalLinks className="mt-3" />
          </div>
        </div>
      </main>
    </div>
  );
}
