"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProfileInput } from "@/lib/schemas";
import type { StoryFact } from "@/lib/schemas";
import type { Relationship } from "@/lib/checker";
import type { OutreachGoal } from "@/lib/outreach/goals";
import { loadConnections, type Connection } from "@/lib/outreach/connections";
import { ApiError, api, loadTimeline, sendToServer } from "@/lib/outreach/ui-api";
import type { UiContact } from "@/lib/outreach/ui-board";
import { createDemoApi, DEMO_CONTACT_ID } from "@/lib/outreach/ui-demo";
import { GOAL_CHIPS, bridgeFor, contactGoal, goalLabel, initialGoals, startIntent, targetCompanies } from "@/lib/outreach/ui-goals";
import { RELATIONSHIPS } from "@/lib/outreach/ui-person";
import { fieldCls } from "@/lib/outreach/ui-style";
import { WHY_MAX, type Send, type TimelineResult, type UiEvent } from "@/lib/outreach/ui-timeline";
import { LOCKED_EVENT } from "@/lib/store";
import { Button, Card, ErrorNote, Label, Pill, SectionHead } from "../ui";
import { ConnectionsImport } from "./ConnectionsImport";
import { ExtensionConnect } from "./ExtensionConnect";
import { Finder } from "./Finder";
import { GoalSetup } from "./GoalSetup";
import { PeopleBoard } from "./PeopleBoard";
import { PersonCard } from "./PersonCard";

/**
 * Outreach (U7, U17): goals, people, and one person at a time with their timeline, brief and messages.
 * A person's stage is never picked here; it follows the steps recorded on their timeline.
 * With no account or storage the workspace shows an example person so every tap can be tried; nothing is saved.
 */
export function OutreachWorkspace({ profile, facts = [], mock = null }: { profile: ProfileInput; facts?: StoryFact[]; mock?: boolean | null }) {
  const [goals, setGoals] = useState<OutreachGoal[]>([]);
  const [preselected, setPreselected] = useState(false);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [contacts, setContacts] = useState<UiContact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageDown, setStorageDown] = useState(false);
  const [lapsed, setLapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timelines, setTimelines] = useState<Record<string, UiEvent[]>>({});
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", role: "", url: "", why: "", relationship: "stranger" as Relationship });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api<{ goals: OutreachGoal[] }>("GET", "/api/outreach/goals").then((x) => {
      const start = initialGoals(x.goals, profile.goals ?? []);
      setGoals(start.selected); setPreselected(start.source === "interview"); setConfirmed(x.goals.length > 0);
    }).catch((e) => {
      const start = initialGoals([], profile.goals ?? []);
      setGoals(start.selected); setPreselected(start.source === "interview");
      if (e instanceof ApiError && e.status === 402) setLapsed(true);
    }).finally(() => setGoalsLoaded(true));
    api<{ contacts: UiContact[] }>("GET", "/api/outreach/contacts").then((x) => setContacts(x.contacts)).catch((e) => {
      if (e instanceof ApiError && e.status === 402) setLapsed(true);
      else if (e instanceof ApiError && [401, 409, 503].includes(e.status)) setStorageDown(true);
      else setError(e.message);
    }).finally(() => setLoaded(true));
    loadConnections().then(setConnections).catch(() => {});
  }, [profile.goals]);

  // The example person: shown when nothing can be saved, or in demo mode before anyone is added (R37).
  const showExample = loaded && !lapsed && (storageDown || (mock === true && contacts.length === 0));
  const demo = useMemo(() => (showExample ? createDemoApi() : null), [showExample]);
  const [demoOverride, setDemoOverride] = useState<{ contact: UiContact; events: UiEvent[] } | null>(null);
  const demoState = useMemo(() => (demo ? demoOverride ?? { contact: demo.contact(), events: demo.events() } : null), [demo, demoOverride]);
  const people = useMemo(() => (demoState ? [demoState.contact, ...contacts] : contacts), [demoState, contacts]);
  const isExample = selectedId === DEMO_CONTACT_ID;
  const person = people.find((c) => c.id === selectedId) ?? null;
  const events = isExample ? demoState?.events ?? null : selectedId ? timelines[selectedId] ?? null : null;

  useEffect(() => {
    if (!selectedId || selectedId === DEMO_CONTACT_ID || timelines[selectedId]) return;
    let live = true;
    loadTimeline(selectedId).then((t) => {
      if (!live) return;
      setTimelines((m) => ({ ...m, [selectedId]: t.events }));
      setContacts((list) => list.map((c) => (c.id === t.contact.id ? t.contact : c)));
    }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [selectedId, timelines]);

  const send: Send = useCallback((req) => (req.contactId === DEMO_CONTACT_ID && demo ? demo.send(req) : sendToServer(req)), [demo]);
  const onTimeline = useCallback((r: TimelineResult) => {
    const id = r.contact?.id ?? r.events[0]?.contactId;
    if (!id) return;
    if (id === DEMO_CONTACT_ID) { setDemoOverride({ contact: r.contact ?? demoState!.contact, events: r.events }); return; }
    setTimelines((m) => ({ ...m, [id]: r.events }));
    if (r.contact) setContacts((list) => list.map((c) => (c.id === id ? r.contact! : c)));
  }, [demoState]);
  const onContact = useCallback((c: UiContact) => {
    if (c.id === DEMO_CONTACT_ID) setDemoOverride((s) => ({ contact: c, events: s?.events ?? demoState?.events ?? [] }));
    else setContacts((list) => list.map((x) => (x.id === c.id ? c : x)));
  }, [demoState]);

  async function saveGoals() {
    setSavingGoals(true); setError(null);
    try { await api("PUT", "/api/outreach/goals", { goals }); setConfirmed(true); setEditingGoals(false); }
    catch (e) { if (e instanceof ApiError && e.status === 402) setLapsed(true); setError((e as Error).message); }
    finally { setSavingGoals(false); }
  }

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    const goal = contactGoal(goals);
    setAdding(true); setError(null);
    try {
      const why = form.why.trim();
      const r = await api<{ contact: UiContact }>("POST", "/api/outreach/contacts", {
        name: form.name.trim(), company: form.company.trim() || null, role: form.role.trim() || null, profileUrl: form.url.trim() || null,
        relationship: form.relationship, bridge: bridgeFor(form.relationship), goal, intent: startIntent(goal, form.relationship), tier: "tier_2", source: "manual",
        ...(why ? { whyText: why, whySource: "manual" } : {}),
      });
      setContacts((c) => [r.contact, ...c]); setSelectedId(r.contact.id);
      setForm({ name: "", company: "", role: "", url: "", why: "", relationship: "stranger" });
    } catch (err) { if (err instanceof ApiError && err.status === 402) setLapsed(true); setError((err as Error).message); }
    finally { setAdding(false); }
  }

  const goal = contactGoal(goals);
  const field = profile.industry || profile.targetRole;
  const showSetup = goalsLoaded && (!confirmed || editingGoals);

  return (
    <div className="space-y-6">
      <ErrorNote message={error} />
      {lapsed && (
        <Card>
          <p role="note">Your subscription has ended, so you can&apos;t record steps or write messages. Your people, timelines and notes are kept.</p>
          <Button className="mt-3" onClick={() => window.dispatchEvent(new Event(LOCKED_EVENT))}>Subscribe to record steps</Button>
        </Card>
      )}

      {showSetup && (
        <GoalSetup selected={goals} onChange={setGoals} onSave={saveGoals} saving={savingGoals} firstVisit={!confirmed} preselected={preselected && !confirmed}
          onCancel={confirmed ? () => setEditingGoals(false) : undefined} />
      )}

      {confirmed && !editingGoals && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Your goals</h2>
                <ul className="mt-1 flex flex-wrap gap-2" aria-label="Your goals">{goals.map((g) => <li key={g}><Pill tone="accent">{GOAL_CHIPS.find((c) => c.id === g)?.label ?? goalLabel(g)}</Pill></li>)}</ul>
              </div>
              <Button variant="ghost" onClick={() => setEditingGoals(true)}>Change goals</Button>
            </div>
          </Card>

          <PeopleBoard contacts={people} selectedId={selectedId} onSelect={setSelectedId} example={demoState?.contact.id} />

          {person && (
            <PersonCard key={person.id} contact={person} events={events} example={isExample} lapsed={lapsed} send={send} onTimeline={onTimeline} onContact={onContact} onLapsed={() => setLapsed(true)} />
          )}

          <Card>
            <SectionHead title="Add a person">Someone you want to write to. You can add the LinkedIn link now or later.</SectionHead>
            <form onSubmit={addPerson} className="grid gap-3 sm:grid-cols-2">
              <label><Label>Name</Label><input className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} required /></label>
              <label><Label>Company</Label><input className={fieldCls} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} maxLength={200} /></label>
              <label><Label>Role</Label><input className={fieldCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} maxLength={200} /></label>
              <label><Label>LinkedIn profile link</Label><input className={fieldCls} type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.linkedin.com/in/..." /></label>
              <label><Label>How you know them</Label>
                <select className={fieldCls} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value as Relationship })}>
                  {RELATIONSHIPS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              <label><Label hint={`(optional, ${WHY_MAX} characters)`}>Why this person</Label><input className={fieldCls} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} maxLength={WHY_MAX} /></label>
              <div className="sm:col-span-2"><Button type="submit" disabled={!form.name.trim() || adding || lapsed}>{adding ? "Adding" : "Add person"}</Button></div>
            </form>
          </Card>

          <Finder goal={goal} field={field} subNiche={profile.specialization} companies={targetCompanies(facts)} connections={connections} />
          <ConnectionsImport
            targets={{ companies: targetCompanies(facts), roles: [profile.targetRole] }}
            defaults={{ goal, intent: startIntent(goal, "stranger"), bridge: "none", tier: "tier_2" }}
            onAdded={(c) => { const added = c as unknown as UiContact; setContacts((list) => [added, ...list]); setSelectedId(added.id); }}
          />
          <ExtensionConnect />
        </>
      )}
    </div>
  );
}
