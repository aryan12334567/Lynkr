"use client";

import { useState } from "react";
import { BRIDGES, CHANNELS, INTENTS, type Bridge, type Channel, type ConnectReply, type Intent, type Packet, type ProfileInput, type StoryFact } from "@/lib/schemas";
import { CHANNEL_RULES, checkMessage, RELATIONSHIP_LABEL, type Relationship } from "@/lib/checker";
import { openSlots, renderFilled } from "@/lib/slots";
import {
  ACCEPT_WINDOW,
  DIAGNOSE,
  MIN_FOR_RATE,
  OTHER_ROUTES,
  OUTCOME_LABEL,
  OUTCOMES,
  REPLY_WINDOW,
  STATUS_LABEL,
  addPerson,
  addedThisWeek,
  canAdd,
  funnel,
  lookFor,
  notesLeft,
  personFollowUpDue,
  removePerson,
  searchUrl,
  setOutcome,
  stagesFor,
  stepPerson,
  usesInvite,
  validateImage,
  type Connect,
  type Outcome,
  type Person,
} from "@/lib/connect";
import { BRIDGE_LABEL, CHANNEL_LABEL, INTENT_LABEL, askAdvice, contactDecision, hasSharedHistory, relationshipOf } from "@/lib/packet";
import { postJson } from "@/lib/store";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { copyText } from "./DraftCard";
import { Verdict } from "./Checker";
import { BlankInputs, Button, Card, ErrorNote, Label, Pill, SectionHead, SheetText, inputCls } from "./ui";

type Tab = "outreach" | "posts";

const numCls = inputCls.replace("w-full", "w-20") + " py-1";
const BOARD = ["considered", "invited", "accepted", "messaged", "replied"] as const;

const TIER_LABEL = { known: "Best first", shared: "Shared link", public_work: "Their public work", company: "Weaker on its own" } as const;
const TIER_TONE = { known: "good", shared: "good", public_work: "accent", company: "warn" } as const;
const FIT_LABEL = { ready_for_review: "Ready for your review", needs_context: "Needs one more detail", do_not_send: "Don't send this" } as const;
const FIT_TONE = { ready_for_review: "good", needs_context: "warn", do_not_send: "bad" } as const;
const CONTACT_TONE = { good: "good", need_detail: "warn", other_route: "warn", hold: "bad" } as const;

function readImage(file: File): Promise<{ media_type: string; data: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      resolve({ media_type: file.type, data: url.slice(url.indexOf(",") + 1) });
    };
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
}

function SearchCard({ c }: { c: ReturnType<typeof lookFor>[number] }) {
  const [q, setQ] = useState(c.search);
  return (
    <div data-look-for className="flex flex-col rounded-2xl border border-line bg-surface shadow-sm p-4 text-[0.92rem]">
      <Pill tone={TIER_TONE[c.tier]} className="self-start">
        {TIER_LABEL[c.tier]}
      </Pill>
      <p className="mt-2 font-medium">{c.who}</p>
      <p className="mt-1 text-soft">{c.why}</p>
      <label className="mt-3 block">
        <span className="mb-1 block text-[0.82rem] text-faint">Search words (edit freely)</span>
        <input className={`${inputCls} py-1.5`} value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
      </label>
      <a className="mt-2 font-medium text-accent hover:underline" href={searchUrl(q, c.firstDegree)} target="_blank" rel="noopener noreferrer">
        {c.firstDegree ? "Search your 1st connections on LinkedIn" : "Search on LinkedIn"}
      </a>
    </div>
  );
}

export function ConnectCoach({
  profile,
  facts,
  connect,
  onConnect,
  onGoTo,
  packet,
  onPacket,
  mock,
}: {
  profile: ProfileInput;
  facts: StoryFact[];
  connect: Connect;
  onConnect: (c: Connect) => void;
  onGoTo: (tab: Tab, rel?: Relationship) => void;
  packet: Packet;
  onPacket: (p: Packet) => void;
  mock: boolean | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [pasted, setPasted] = useState("");
  const [image, setImage] = useState<{ media_type: string; data: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<ConnectReply | null>(null);
  const [noteFills, setNoteFills] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState("");
  const [personRel, setPersonRel] = useState<Relationship>("stranger");
  const [personChannel, setPersonChannel] = useState<Channel>("connection_note");
  const [withNote, setWithNote] = useState(true);
  const [stuck, setStuck] = useState<string>("");
  const reduce = useReducedMotion();

  const confirmed = facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts);
  const chosen = confirmed.filter((f) => picked.includes(f.id));
  const cards = lookFor(profile, confirmed);
  const left = notesLeft(connect);
  const added = addedThisWeek(connect.people);
  const decision = contactDecision(packet);
  const advice = askAdvice(packet);
  const set = (patch: Partial<Packet>) => onPacket({ ...packet, ...patch });
  const rule = CHANNEL_RULES[packet.channel];
  const f = funnel(connect.people);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return setImage(null);
    try {
      const img = await readImage(file);
      const bad = validateImage(img.media_type, img.data);
      if (bad) {
        setError(bad);
        setImage(null);
        e.target.value = "";
        return;
      }
      setImage({ ...img, name: file.name });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function write(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const reply = await postJson<ConnectReply>("/api/connect", {
        profile,
        facts: chosen.slice(0, 2).map((x) => ({ id: x.id, kind: x.kind, text: x.text })),
        packet,
        text: pasted.trim(),
        image: image ? { media_type: image.media_type, data: image.data } : undefined,
      });
      setNote(reply);
      setNoteFills([]);
      setPersonRel(relationshipOf(packet.bridge));
      setPersonChannel(packet.channel);
      if (packet.recipientRole.trim()) setLabel(packet.recipientRole.trim().slice(0, 120));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const noteText = note ? renderFilled(note.body, noteFills) : "";
  const blanks = note ? openSlots(note.body, noteFills) : 0;
  const size = rule.unit === "chars" ? noteText.length : noteText.trim() ? noteText.trim().split(/\s+/).length : 0;
  const tooLong = size > rule.max;

  function personHint(p: Person) {
    if (p.outcome) return `Outcome: ${OUTCOME_LABEL[p.outcome]}.`;
    if (p.status === "considered") return usesInvite(p) ? "Find them with a search above, send the request, then mark it invited." : "Send your message, then mark it messaged.";
    if (p.status === "invited") return "Waiting for them to accept. Many never do; that's normal.";
    if (p.status === "accepted") return "Now send one short, low-effort question about their work.";
    if (p.status === "messaged") return personFollowUpDue(p) ? "No reply in 5 days. One follow-up with something new is fine, then stop." : "Give it 5 to 7 days before any follow-up.";
    return "They replied. Keep the conversation going yourself.";
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="look-for">
        <SectionHead id="look-for" title="Who to look for">
          Kinds of people, best link first. Lynkr never searches LinkedIn for you and never names anyone. Search results can be out of date, so
          check someone&apos;s current role yourself before you write.
        </SectionHead>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c, i) => (
            <SearchCard key={`${c.tier}-${i}`} c={c} />
          ))}
        </div>
        <details className="mt-3 text-[0.92rem]">
          <summary className="cursor-pointer text-soft">Other places to find people (you search them yourself)</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-soft">
            {OTHER_ROUTES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="one-person">
        <Card>
          <h3 id="one-person" className="text-lg font-bold">
            Write to one person
          </h3>
          <p className="mt-1 max-w-[62ch] text-[0.95rem] text-soft">
            About a minute. Lynkr checks there&apos;s a real reason to write before it helps with wording. Only what you type here and the facts you
            tick are used. A profile link alone won&apos;t work: Lynkr can&apos;t open LinkedIn pages.
          </p>

          <div className="mt-5 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
          <form onSubmit={write} className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <Label>What you want</Label>
                <select className={inputCls} value={packet.intent} onChange={(e) => set({ intent: e.target.value as Intent })}>
                  {INTENTS.map((i) => (
                    <option key={i} value={i}>
                      {INTENT_LABEL[i]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <Label>How you know them</Label>
                <select className={inputCls} value={packet.bridge} onChange={(e) => set({ bridge: e.target.value as Bridge })}>
                  {BRIDGES.map((b) => (
                    <option key={b} value={b}>
                      {BRIDGE_LABEL[b]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <Label>Where you&apos;ll send it</Label>
                <select className={inputCls} value={packet.channel} onChange={(e) => set({ channel: e.target.value as Channel })}>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <Label hint="(no name needed)">Their role and team</Label>
                <input className={inputCls} value={packet.recipientRole} maxLength={160} onChange={(e) => set({ recipientRole: e.target.value, roleChecked: false })} placeholder="e.g. Credit analyst at a Mumbai NBFC" />
                <label className="mt-1.5 flex items-center gap-2 text-[0.88rem] text-soft">
                  <input type="checkbox" className="accent-[var(--accent)]" checked={packet.roleChecked} onChange={(e) => set({ roleChecked: e.target.checked })} />I checked this is their current role
                </label>
              </label>
              <label className="block">
                <Label hint="(a label or link, never opened)">Where you saw it</Label>
                <input className={inputCls} value={packet.anchorSource} maxLength={300} onChange={(e) => set({ anchorSource: e.target.value })} placeholder="e.g. LinkedIn post, 12 Oct" />
              </label>
            </div>

            <label className="block">
              <Label>One real thing you noticed</Label>
              <textarea
                className={`${inputCls} min-h-16`}
                value={packet.anchor}
                maxLength={300}
                onChange={(e) => set({ anchor: e.target.value })}
                placeholder="e.g. post on why debt coverage ratios mislead for seasonal businesses"
              />
              <span className="mt-1 block text-[0.85rem] text-faint">Their work, a talk, a project or where you met. Not &quot;your profile&quot; or &quot;you work at X&quot;.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <Label>Why this person, for your goal</Label>
                <input className={inputCls} value={packet.whyThem} maxLength={300} onChange={(e) => set({ whyThem: e.target.value })} placeholder="e.g. they do the credit research work I'm aiming for" />
              </label>
              <label className="block">
                <Label>Your one ask</Label>
                <input className={inputCls} value={packet.ask} maxLength={300} onChange={(e) => set({ ask: e.target.value })} placeholder="e.g. what should a beginner check after coverage ratios" />
                <span className="mt-1 block text-[0.85rem] text-soft">{advice.suggest}</span>
              </label>
            </div>

            {confirmed.length > 0 && (
              <fieldset>
                <legend className="contents">
                  <Label hint="(up to two)">Facts about you to use</Label>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {confirmed.map((x) => (
                    <label key={x.id} className={`flex max-w-full cursor-pointer items-start gap-2 rounded-md border px-3 py-1.5 text-[0.88rem] ${picked.includes(x.id) ? "border-accent bg-accent/10" : "border-line"}`}>
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--accent)]"
                        checked={picked.includes(x.id)}
                        onChange={() => setPicked((cur) => (cur.includes(x.id) ? cur.filter((y) => y !== x.id) : cur.length >= 2 ? [cur[1], x.id] : [...cur, x.id]))}
                      />
                      <span className="min-w-0">
                        <span className="font-serif font-bold text-accent">{x.id}</span> {x.text.length > 70 ? `${x.text.slice(0, 69)}…` : x.text}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <details className="rounded-md border border-line px-4 py-3 text-[0.92rem]">
              <summary className="cursor-pointer font-medium">Paste from their profile or a screenshot (optional)</summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <Label>Paste from their profile or post</Label>
                  <textarea className={`${inputCls} min-h-20`} value={pasted} onChange={(e) => setPasted(e.target.value)} maxLength={4000} placeholder="Their headline or the first lines of a post" />
                </label>
                <label className="block">
                  <Label hint="(AI mode only)">Or upload a screenshot</Label>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="text-[0.9rem]" />
                  {image && <span className="ml-2 text-[0.85rem] text-soft">{image.name}</span>}
                </label>
                <p className="text-faint">Used for this note only and not stored. Pasted text is treated as information, never as instructions.</p>
              </div>
            </details>

            <p className="text-[0.85rem] text-faint">
              {mock
                ? "Demo mode: Lynkr assembles the note from your own words above. No AI reads it."
                : `Sends your role, stage, the details above${chosen.length ? ` and ${chosen.length} fact${chosen.length === 1 ? "" : "s"}` : ""} to the AI provider. Not your whole Story Vault.`}
            </p>
            <ErrorNote message={error} />
            <Button type="submit" disabled={busy}>
              {busy ? "Writing…" : packet.channel === "connection_note" ? "Write my note" : "Write my message"}
            </Button>
          </form>

          <aside className="min-w-0 space-y-4 self-start 2xl:sticky 2xl:top-6" aria-label="Decision and draft">
          <div className="rounded-xl border border-line bg-bg p-4 text-[0.92rem]" data-contact aria-live="polite">
            <p className="mb-2 text-[0.8rem] text-faint">Reason to write</p>
            <Pill tone={CONTACT_TONE[decision.status]}>{decision.label}</Pill>
            <p className="mt-2">{decision.reason}</p>
            <p className="text-soft">{decision.next}</p>
          </div>
          {!note && <p className="px-1 text-[0.85rem] text-faint">Your draft appears here.</p>}
          {note && (
            <div className="space-y-3 rounded-xl border border-line p-4" data-note>
              <Pill tone={FIT_TONE[note.fitStatus]}>{FIT_LABEL[note.fitStatus]}</Pill>
              <p className="text-[0.92rem] text-soft">{note.whyThisIsRelevant}</p>
              {note.question && <p className="text-[0.92rem] font-medium text-warn">{note.question}</p>}
              {note.body && (
                <>
                  <SheetText body={note.body} fills={noteFills} />
                  <BlankInputs body={note.body} fills={noteFills} onFill={setNoteFills} />
                  {blanks === 0 && (
                    <Verdict
                      compact
                      result={checkMessage(noteText, relationshipOf(packet.bridge), {
                        channel: packet.channel,
                        intent: packet.intent,
                        facts: chosen.length ? chosen.map((x) => x.text) : undefined,
                        sharedHistory: hasSharedHistory(packet.bridge),
                      })}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={blanks > 0 || tooLong}
                      onClick={async () => {
                        if (await copyText(noteText)) {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }
                      }}
                    >
                      {copied ? "Copied" : packet.channel === "connection_note" ? "Copy note" : "Copy message"}
                    </Button>
                    <span className={`text-[0.85rem] ${tooLong ? "text-bad" : "text-soft"}`} data-count>
                      {size} / {rule.max} {rule.unit === "chars" ? "characters" : "words"}
                      {blanks > 0 && `. Fill ${blanks} blank${blanks === 1 ? "" : "s"} before you copy`}
                      {tooLong && `. Too long for a ${rule.label.toLowerCase()}; shorten your blanks`}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          </aside>
          </div>
        </Card>
      </section>

      <section aria-labelledby="budget">
        <Card>
          <h3 id="budget" className="text-lg font-bold">
            Note budget
          </h3>
          <p className="mt-1 text-[0.95rem]" data-notes-left>
            <strong className={left === 0 ? "text-bad" : "text-good"}>{left}</strong> of {connect.monthlyNotes} personalised notes left this month
          </p>
          <label className="mt-3 flex items-center gap-2 text-[0.92rem] text-soft">
            Notes you get per month
            <input
              type="number"
              min={0}
              max={100}
              className={numCls}
              value={connect.monthlyNotes}
              onChange={(e) => onConnect({ ...connect, monthlyNotes: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
          </label>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[0.92rem] text-soft">
            <li>Free accounts get only a few notes a month, and LinkedIn changes this. Check yours and set the number above.</li>
            <li>LinkedIn advises inviting people you know or have a real reason to know. Many invites to strangers can get your account restricted.</li>
            <li>
              Warm up first: leave a real comment on their post before you connect.{" "}
              <button className="font-medium text-accent hover:underline" onClick={() => onGoTo("posts")}>
                Open the comment helper
              </button>
            </li>
          </ul>
        </Card>
      </section>

      <section aria-labelledby="tracker">
        <Card>
          <h3 id="tracker" className="text-lg font-bold">
            People you&apos;re reaching
          </h3>
          <p className="mt-1 text-[0.95rem] text-soft">
            One person at a time, kept in this browser. {added} added this week, cap {connect.weeklyCap}. Your messages and their replies are not stored.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[0.85rem] text-soft">Who (your own label)</span>
              <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Analytics lead at a Pune SaaS firm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.85rem] text-soft">Relationship</span>
              <select className={inputCls} value={personRel} onChange={(e) => setPersonRel(e.target.value as Relationship)}>
                {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => (
                  <option key={r} value={r}>
                    {RELATIONSHIP_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.85rem] text-soft">Channel</span>
              <select className={inputCls} value={personChannel} onChange={(e) => setPersonChannel(e.target.value as Channel)}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {personChannel === "connection_note" && (
              <label className="flex items-center gap-2 text-[0.92rem]">
                <input type="checkbox" className="accent-[var(--accent)]" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} />
                Used a note
              </label>
            )}
            <Button
              disabled={!label.trim() || !canAdd(connect)}
              onClick={() => {
                onConnect(addPerson(connect, label, personRel, withNote, new Date(), { channel: personChannel, intent: packet.intent, bridge: packet.bridge }));
                setLabel("");
              }}
            >
              Add person
            </Button>
            <label className="flex items-center gap-2 text-[0.85rem] text-soft">
              New people per week
              <input
                type="number"
                min={1}
                max={20}
                className={numCls}
                value={connect.weeklyCap}
                onChange={(e) => onConnect({ ...connect, weeklyCap: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              />
            </label>
          </div>
          {!canAdd(connect) && (
            <p className="mt-2 text-[0.92rem] text-warn" data-cap>
              You&apos;ve reached this week&apos;s cap of {connect.weeklyCap}. A few careful messages beat many generic ones.
            </p>
          )}

          {connect.people.length > 0 && (
            <LayoutGroup>
            <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-2" data-board>
            <div className="grid min-w-[50rem] grid-cols-5 gap-3">
            {BOARD.map((col) => {
              const inCol = connect.people.filter((p) => p.status === col);
              return (
              <section key={col} aria-label={`${STATUS_LABEL[col]}: ${inCol.length}`} className="rounded-xl bg-muted/70 p-2.5">
                <h4 className="flex items-center justify-between px-1 pb-2 text-[0.85rem] font-medium text-soft">
                  {STATUS_LABEL[col]}
                  <span className="rounded-full bg-surface px-2 text-[0.75rem] text-faint">{inCol.length}</span>
                </h4>
                <ul className="space-y-2">
              {inCol.map((p) => {
                const stages = stagesFor(p);
                const i = stages.indexOf(p.status);
                const next = stages[i + 1];
                return (
                  <motion.li
                    layout
                    layoutId={p.id}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                    key={p.id}
                    data-person={p.id}
                    className="rounded-lg border border-line bg-surface p-3 text-[0.88rem] shadow-sm"
                  >
                    <p className="font-medium leading-snug">{p.label}</p>
                    <p className="mt-0.5 text-[0.8rem] text-faint">
                      {RELATIONSHIP_LABEL[p.relationship]}, {CHANNEL_LABEL[p.channel ?? "connection_note"].toLowerCase()}
                      {usesInvite(p) ? (p.withNote ? ", with note" : ", no note") : ""}
                    </p>
                    <span className="sr-only" data-status>
                      {STATUS_LABEL[p.status]}
                    </span>
                    {p.outcome && <span className="mt-1.5 inline-block rounded-full bg-good/10 px-2 py-0.5 text-[0.75rem] text-good">{OUTCOME_LABEL[p.outcome]}</span>}
                    <p data-hint className={`mt-1.5 text-[0.82rem] ${personFollowUpDue(p) ? "text-bad" : "text-soft"}`}>{personHint(p)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {next && !p.outcome && (
                        <button className="rounded-md border border-line px-2.5 py-1 text-[0.85rem] hover:border-accent/50" onClick={() => onConnect(stepPerson(connect, p.id, 1))}>
                          Mark {STATUS_LABEL[next].toLowerCase()}
                        </button>
                      )}
                      {(p.status === "accepted" || personFollowUpDue(p)) && (
                        <button className="rounded-md border border-line px-2.5 py-1 text-[0.85rem] hover:border-accent/50" onClick={() => onGoTo("outreach", p.relationship)}>
                          Open the draft
                        </button>
                      )}
                      {i > 0 && (
                        <button className="rounded-md px-2.5 py-1 text-[0.85rem] text-faint hover:bg-muted" onClick={() => onConnect(stepPerson(connect, p.id, -1))}>
                          Back
                        </button>
                      )}
                      <label className="sr-only" htmlFor={`outcome-${p.id}`}>
                        Outcome for {p.label}
                      </label>
                      <select
                        id={`outcome-${p.id}`}
                        className="rounded-md border border-line bg-surface px-2 py-1 text-[0.85rem]"
                        value={p.outcome ?? ""}
                        onChange={(e) => onConnect(setOutcome(connect, p.id, (e.target.value || undefined) as Outcome | undefined))}
                      >
                        <option value="">Outcome…</option>
                        {OUTCOMES.map((o) => (
                          <option key={o} value={o}>
                            {OUTCOME_LABEL[o]}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md px-2.5 py-1 text-[0.85rem] text-faint hover:bg-muted" onClick={() => onConnect(removePerson(connect, p.id))}>
                        Remove
                      </button>
                    </div>
                  </motion.li>
                );
              })}
                </ul>
                {inCol.length === 0 && <p className="px-1 py-3 text-[0.8rem] text-faint">Nobody here yet.</p>}
              </section>
              );
            })}
            </div>
            </div>
            </LayoutGroup>
          )}

          {connect.people.length > 0 && (
            <div className="mt-6 border-t border-line pt-5" data-funnel>
              <h4 className="text-[1rem] font-bold">How it&apos;s going</h4>
              <dl className="mt-3 grid gap-3 text-[0.92rem] sm:grid-cols-3">
                <div className="rounded-md bg-muted p-3">
                  <dt className="text-soft">Invitations accepted</dt>
                  <dd className="mt-1 font-medium">
                    {f.acceptedOfMature} of {f.invitedMature} sent {ACCEPT_WINDOW}+ days ago
                  </dd>
                  <dd className="text-[0.85rem] text-faint">
                    {f.pendingMature} still pending after {ACCEPT_WINDOW} days. {f.invited - f.invitedMature} too recent to judge.
                  </dd>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <dt className="text-soft">Messages answered</dt>
                  <dd className="mt-1 font-medium">
                    {f.repliedOfMature} of {f.messagedMature} sent {REPLY_WINDOW}+ days ago
                  </dd>
                  <dd className="text-[0.85rem] text-faint">{f.messaged - f.messagedMature} too recent to judge.</dd>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <dt className="text-soft">Useful outcomes</dt>
                  <dd className="mt-1 font-medium">{f.useful}</dd>
                  <dd className="text-[0.85rem] text-faint">Answers, chats, introductions or referrals you marked.</dd>
                </div>
              </dl>
              <p className="mt-3 text-[0.85rem] text-faint">
                {f.invitedMature < MIN_FOR_RATE && f.messagedMature < MIN_FOR_RATE
                  ? `Too few to compare yet (under ${MIN_FOR_RATE} old enough), so these are counts, not rates.`
                  : "Acceptance and replies are counted separately. Small numbers swing a lot, and timing, the person and the job market all matter, not just your wording."}
              </p>
              <label className="mt-4 block max-w-md">
                <Label>Where does it feel stuck?</Label>
                <select className={inputCls} value={stuck} onChange={(e) => setStuck(e.target.value)}>
                  <option value="">Choose one</option>
                  {Object.entries(DIAGNOSE).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              {stuck && <p className="mt-2 max-w-[62ch] text-[0.92rem]">{DIAGNOSE[stuck].advice}</p>}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
