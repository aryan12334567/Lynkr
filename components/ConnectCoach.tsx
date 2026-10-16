"use client";

import { useState } from "react";
import type { ConnectReply, GenerateReply, ProfileInput } from "@/lib/schemas";
import { RELATIONSHIP_LABEL, type Relationship } from "@/lib/checker";
import { openSlots, parseSlots, renderFilled } from "@/lib/slots";
import {
  NOTE_MAX,
  STATUS_LABEL,
  STATUS_ORDER,
  addPerson,
  addedThisWeek,
  canAdd,
  notesLeft,
  personFollowUpDue,
  removePerson,
  searchUrl,
  stepPerson,
  validateImage,
  type Connect,
  type Person,
} from "@/lib/connect";
import { postJson } from "@/lib/store";
import { RelationshipPicker } from "./Checker";
import { Button, Card, ErrorNote, Label, inputCls } from "./ui";

type Tab = "outreach" | "posts";

// Narrow number inputs: the shared input style is full width.
const numCls = inputCls.replace("w-full", "w-20") + " py-1";

const RUNG: Record<Relationship, string> = {
  stranger: "the first message to a stranger (one specific question)",
  alumni: "the message to someone from your college (15-minute chat)",
  knows_me: "the referral request",
};

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

export function ConnectCoach({
  result,
  profile,
  connect,
  onConnect,
  onGoTo,
  onRedo,
}: {
  result: GenerateReply;
  profile: ProfileInput;
  connect: Connect;
  onConnect: (c: Connect) => void;
  onGoTo: (tab: Tab, rel?: Relationship) => void;
  onRedo: () => void;
}) {
  const [rel, setRel] = useState<Relationship>("stranger");
  const [pasted, setPasted] = useState("");
  const [image, setImage] = useState<{ media_type: string; data: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<ConnectReply | null>(null);
  const [fills, setFills] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState("");
  const [personRel, setPersonRel] = useState<Relationship>("stranger");
  const [withNote, setWithNote] = useState(true);

  const left = notesLeft(connect);
  const added = addedThisWeek(connect.people);
  const lookFor = result.connect?.look_for;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return setImage(null);
    try {
      const img = await readImage(f);
      const bad = validateImage(img.media_type, img.data);
      if (bad) {
        setError(bad);
        setImage(null);
        e.target.value = "";
        return;
      }
      setImage({ ...img, name: f.name });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function writeNote(e: React.FormEvent) {
    e.preventDefault();
    if (!pasted.trim() && !image) {
      setError("Paste their headline, About or a post, or upload a screenshot.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reply = await postJson<ConnectReply>("/api/connect", {
        profile,
        facts: result.vault.map((v) => v.text).slice(0, 12),
        relationship: rel,
        text: pasted.trim(),
        image: image ? { media_type: image.media_type, data: image.data } : undefined,
      });
      setNote(reply);
      setFills([]);
      setPersonRel(rel);
      // Only prefill the tracker label with what was read, never a blank.
      if (!/\[\[/.test(reply.who)) setLabel(reply.who.slice(0, 120));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const noteText = note ? renderFilled(note.note, fills) : "";
  const blanks = note ? openSlots(note.note, fills) : 0;
  const tooLong = noteText.length > NOTE_MAX;

  function personHint(p: Person) {
    if (p.status === "to_find") return "Find them with a search above, send the request, then mark it sent.";
    if (p.status === "sent") return "Waiting for them to accept.";
    if (p.status === "accepted") return `Now send ${RUNG[p.relationship]}.`;
    if (p.status === "messaged") return personFollowUpDue(p) ? "No reply in 5 days: send the follow-up draft." : "Give it 5 to 7 days before following up.";
    return "They replied. Keep the conversation going yourself.";
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold">Connect Coach</h3>
        <p className="mt-1 text-sm text-soft">
          Lynkr tells you what kinds of people to look for and writes your note. You find each person and send everything
          yourself in LinkedIn. Lynkr never searches LinkedIn, never names people for you and never sends requests.
        </p>
      </Card>

      {/* 1. Who to look for */}
      <section aria-labelledby="look-for" className="space-y-3">
        <h3 id="look-for" className="font-semibold">
          Who to look for
        </h3>
        {!lookFor ? (
          <Card>
            <p className="text-sm">These suggestions are new. Rewrite your drafts to get them; your answers are kept.</p>
            <Button className="mt-3" onClick={onRedo}>
              Rewrite drafts
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lookFor.map((c, i) => (
              <div key={i} data-look-for className="rounded-xl border border-line bg-surface p-4 text-sm">
                <p className="font-medium">{c.who}</p>
                <p className="mt-1 text-soft">{c.why}</p>
                <a className="mt-2 inline-block text-accent hover:underline" href={searchUrl(c.search)} target="_blank" rel="noopener noreferrer">
                  Search on LinkedIn: {c.search}
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Note writer */}
      <Card>
        <form onSubmit={writeNote} className="space-y-4">
          <div>
            <h3 className="font-semibold">Write a connection note</h3>
            <p className="mt-1 text-sm text-soft">
              Found someone? Paste their headline, About or a recent post, or upload a screenshot. A profile link alone won&apos;t
              work: Lynkr can&apos;t open LinkedIn pages. Screenshots are read for this note only and not stored.
            </p>
          </div>
          <div>
            <Label>Who are they to you?</Label>
            <RelationshipPicker value={rel} onChange={setRel} />
          </div>
          <label className="block">
            <Label>Paste from their profile or post</Label>
            <textarea
              className={`${inputCls} min-h-24`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              maxLength={4000}
              placeholder="e.g. their headline and the first lines of a recent post"
            />
          </label>
          <label className="block">
            <Label hint="(optional)">Or upload a screenshot</Label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="text-sm" />
            {image && <span className="ml-2 text-xs text-soft">{image.name}</span>}
          </label>
          <ErrorNote message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Writing…" : "Write my note"}
          </Button>
        </form>

        {note && (
          <div className="mt-5 space-y-3 border-t border-line pt-4" data-note>
            <p className="text-sm">
              <span className="text-faint">Who they are: </span>
              {note.who}
            </p>
            <p className="text-sm">
              <span className="text-faint">Worth mentioning: </span>
              {note.hook}
            </p>
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
              {parseSlots(note.note).map((s, i) =>
                s.type === "text" ? (
                  <span key={i}>{s.text}</span>
                ) : (fills[s.index] ?? "").trim() ? (
                  <mark key={i} className="rounded bg-good/15 px-0.5 text-ink">
                    {fills[s.index]}
                  </mark>
                ) : (
                  <mark key={i} className="rounded bg-warn/20 px-1 text-warn">
                    [{s.label}]
                  </mark>
                ),
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {parseSlots(note.note).map((s) =>
                s.type === "slot" ? (
                  <label key={s.index} className="block">
                    <span className="mb-1 block text-xs text-soft">{s.label}</span>
                    <input
                      className={inputCls}
                      value={fills[s.index] ?? ""}
                      onChange={(e) => {
                        const next = [...fills];
                        next[s.index] = e.target.value;
                        setFills(next);
                      }}
                      placeholder="Your real answer"
                    />
                  </label>
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={blanks > 0 || tooLong}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(noteText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
              >
                {copied ? "Copied" : "Copy note"}
              </Button>
              <span className={`text-xs ${tooLong ? "text-bad" : "text-soft"}`} data-count>
                {noteText.length} / {NOTE_MAX} characters
                {blanks > 0 && ` · fill ${blanks} blank${blanks === 1 ? "" : "s"} to unlock copy`}
                {tooLong && " · too long for a LinkedIn note, shorten your blanks"}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Note budget */}
      <Card>
        <h3 className="font-semibold">Note budget</h3>
        <p className="mt-1 text-sm" data-notes-left>
          <strong className={left === 0 ? "text-bad" : "text-good"}>{left}</strong> of {connect.monthlyNotes} personalised notes left this month
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-soft">
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
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-soft">
          <li>LinkedIn&apos;s help pages say free accounts get only a few notes a month (3 or 5), so check yours and set the number above.</li>
          <li>Spend notes on strangers. People who already like or comment on your posts can get a request without a note.</li>
          <li>
            Warm up first: leave a real comment on their post before you connect.{" "}
            <button className="text-accent hover:underline" onClick={() => onGoTo("posts")}>
              Open comment drafts
            </button>
          </li>
        </ul>
      </Card>

      {/* 4. People tracker */}
      <Card>
        <h3 className="font-semibold">People you&apos;re reaching</h3>
        <p className="mt-1 text-sm text-soft">
          One person at a time. {added} added this week, cap {connect.weeklyCap}.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-xs text-soft">Who (your own label)</span>
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Analytics lead at a Pune SaaS firm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-soft">Relationship</span>
            <select className={inputCls} value={personRel} onChange={(e) => setPersonRel(e.target.value as Relationship)}>
              {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => (
                <option key={r} value={r}>
                  {RELATIONSHIP_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} />
            Used a note
          </label>
          <Button
            disabled={!label.trim() || !canAdd(connect)}
            onClick={() => {
              onConnect(addPerson(connect, label, personRel, withNote));
              setLabel("");
            }}
          >
            Add person
          </Button>
        </div>
        {!canAdd(connect) && (
          <p className="mt-2 text-sm text-warn" data-cap>
            You&apos;ve reached this week&apos;s cap of {connect.weeklyCap}. A few careful requests beat many generic ones.
          </p>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs text-soft">
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

        {connect.people.length > 0 && (
          <ul className="mt-4 space-y-2">
            {connect.people.map((p) => {
              const i = STATUS_ORDER.indexOf(p.status);
              const next = STATUS_ORDER[i + 1];
              return (
                <li key={p.id} data-person={p.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-xs text-faint">
                      {RELATIONSHIP_LABEL[p.relationship]}
                      {p.withNote ? " · note" : " · no note"}
                    </span>
                    <span className="ml-auto rounded bg-muted px-2 py-0.5 text-xs font-medium" data-status>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs ${personFollowUpDue(p) ? "text-bad" : "text-soft"}`}>{personHint(p)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {next && (
                      <button className="rounded border border-line px-2 py-1 text-xs hover:bg-muted" onClick={() => onConnect(stepPerson(connect, p.id, 1))}>
                        Mark {STATUS_LABEL[next].toLowerCase()}
                      </button>
                    )}
                    {(p.status === "accepted" || personFollowUpDue(p)) && (
                      <button className="rounded border border-line px-2 py-1 text-xs hover:bg-muted" onClick={() => onGoTo("outreach", p.relationship)}>
                        Open the draft
                      </button>
                    )}
                    {i > 0 && (
                      <button className="rounded px-2 py-1 text-xs text-faint hover:bg-muted" onClick={() => onConnect(stepPerson(connect, p.id, -1))}>
                        Back
                      </button>
                    )}
                    <button className="rounded px-2 py-1 text-xs text-faint hover:bg-muted" onClick={() => onConnect(removePerson(connect, p.id))}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
