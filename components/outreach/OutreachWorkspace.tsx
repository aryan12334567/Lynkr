"use client";

import { useEffect, useState } from "react";
import type { ProfileInput } from "@/lib/schemas";
import type { Relationship } from "@/lib/checker";
import type { Contact, ContactStatus } from "@/lib/outreach/contacts-db";
import { GOALS, preselectGoals, defaultIntent, type OutreachGoal } from "@/lib/outreach/goals";
import { type DraftResult } from "@/lib/outreach/draft";
import { downloadOutreachIcs, outreachGoogleCalendarUrl, saveOutreachEvent, removeOutreachEvent, OUTREACH_EVENT_TYPES, type OutreachEvent, type OutreachEventType } from "@/lib/outreach/calendar";
import { todayIST } from "@/lib/ist";
import { nextAction } from "@/lib/outreach/followup";
import { targetLinks } from "@/lib/outreach/finder";
import { readConnections, rankConnections, saveConnections, loadConnections, clearConnections, type Connection } from "@/lib/outreach/connections";
import { loadLicense, postJson } from "@/lib/store";
import { Button, Card, ErrorNote, Label, inputCls } from "../ui";
import { copyText } from "../DraftCard";

const stages: {id: ContactStatus; label: string}[] = [
  {id:"to_contact",label:"To contact"},{id:"invited",label:"Invited"},{id:"accepted",label:"Accepted"},
  {id:"messaged",label:"Messaged"},{id:"replied",label:"Replied"},{id:"outcome",label:"Outcome"},
];
async function request<T>(method: string, body?: unknown, path = "/api/outreach/contacts"): Promise<T> {
  const license = loadLicense();
  const res = await fetch(path, { method, headers: { ...(body ? {"Content-Type":"application/json"} : {}), ...(license ? {"x-lynkr-license":license.key,"x-lynkr-instance":license.instanceId} : {}) }, ...(body ? {body: JSON.stringify(body)} : {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load outreach. Please try again.");
  return data as T;
}

export function OutreachWorkspace({ profile }: {profile: ProfileInput}) {
  const [goals, setGoals] = useState<OutreachGoal[]>(() => preselectGoals(profile.goals ?? []));
  const [confirmed, setConfirmed] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [url, setUrl] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("stranger");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [tokens, setTokens] = useState<{id:string; expiresAt:string; revokedAt:string | null}[]>([]);
  const [candidates, setCandidates] = useState<{title:string; url:string; date:string}[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [eventDay, setEventDay] = useState(() => todayIST());
  const [eventTime, setEventTime] = useState("10:00");
  const [eventType, setEventType] = useState<OutreachEventType>("follow_up_due");
  const [eventReason, setEventReason] = useState("");
  const [busy, setBusy] = useState(false);
  const goal = goals[0] ?? "network";
  const person = contacts.find(c => c.id === selected);
  const events = (Array.isArray(person?.brief?.calendarEvents) ? person.brief.calendarEvents : []) as OutreachEvent[];
  const action = person ? nextAction({ ...person, secondPersonSuggested: person.brief?.secondPersonSuggested === true, followUpSent: person.brief?.followUpSent === true }) : null;
  useEffect(() => { request<{contacts:Contact[]}>("GET").then(x=>setContacts(x.contacts)).catch(e=>setError(e.message)); loadConnections().then(setConnections).catch(()=>{}); request<{goals:OutreachGoal[]}>("GET", undefined, "/api/outreach/goals").then(x=>{if(x.goals.length){setGoals(x.goals);setConfirmed(true);}}).catch(()=>{}); request<{tokens:typeof tokens}>("GET", undefined, "/api/ext/revoke").then(x=>setTokens(x.tokens)).catch(()=>{}); }, []);
  async function add(data: {name:string; company:string; role:string; profileUrl:string}, source: "manual" | "connections") {
    setBusy(true); setError(null);
    try {
      const response = await request<{contact:Contact}>("POST", {name:data.name, company:data.company || null, role:data.role || null, profileUrl:data.profileUrl || null, relationship, bridge:relationship === "knows_me" ? "knows_me" : relationship === "alumni" ? "alumni" : "none", goal, intent:defaultIntent(goal,relationship), tier:"tier_2", source});
      setContacts(c=>[response.contact,...c]); setSelected(response.contact.id); setDraft(null);
      setName(""); setCompany(""); setRole(""); setUrl("");
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function move(c:Contact, status:ContactStatus) {
    setError(null);
    const key = ({invited:"invitedAt",accepted:"acceptedAt",messaged:"messagedAt",replied:"repliedAt",outcome:"outcomeAt"} as Partial<Record<ContactStatus,string>>)[status];
    try { const result=await request<{contact:Contact}>("PATCH", {id:c.id,status,...(key ? {[key]:new Date().toISOString()} : {})}); setContacts(list=>list.map(x=>x.id===c.id?result.contact:x)); } catch(e) {setError((e as Error).message);}
  }
  async function patchPerson(c: Contact, data: Record<string, unknown>) {
    setError(null);
    try { const result = await request<{contact:Contact}>("PATCH", {id:c.id,...data}); setContacts(list => list.map(x => x.id === c.id ? result.contact : x)); }
    catch(e) { setError((e as Error).message); }
  }
  async function importFile(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0]; e.target.value=""; if(!file)return;
    try { const rows=await readConnections([{name:file.name,buffer:await file.arrayBuffer()}]); await saveConnections(rows); setConnections(rows); setNotice(`${rows.length} connections saved on this device.`); } catch(err) {setError((err as Error).message);}
  }
  return <div className="space-y-6">
    <ErrorNote message={error}/>
    <Card><h2 className="text-xl font-bold">What do you want to do?</h2><p className="mt-1 text-soft">Choose your goals. You can change them at any time.</p>
      <div className="mt-4 flex flex-wrap gap-2">{GOALS.map(g=><button key={g.id} type="button" aria-pressed={goals.includes(g.id)} onClick={()=>setGoals(x=>x.includes(g.id)?x.filter(a=>a!==g.id):[...x,g.id])} className={`rounded-full border px-4 py-2 text-sm ${goals.includes(g.id)?"border-accent bg-accent-wash text-accent":"border-line"}`}>{g.label}</button>)}</div>
      <Button className="mt-4" disabled={!goals.length || busy} onClick={async()=>{setBusy(true);setError(null);try { await request("PUT",{goals},"/api/outreach/goals"); setConfirmed(true); } catch(e) {setError((e as Error).message);} finally {setBusy(false);}}}>{confirmed ? "Save goals" : "Continue"}</Button>
    </Card>
    {confirmed && <>
      <Card><h2 className="text-lg font-bold">Find people</h2><p className="mt-1 text-soft">Open a search and choose people yourself.</p><div className="mt-3 flex flex-wrap gap-4">{targetLinks(goal, profile.targetRole, []).map(x=><a key={x.url} className="text-accent underline" href={x.url} target="_blank" rel="noopener noreferrer">{x.label}</a>)}</div></Card>
      <Card><h2 className="text-lg font-bold">Add a person</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label><Label>Name</Label><input className={inputCls} value={name} onChange={e=>setName(e.target.value)} maxLength={200}/></label>
        <label><Label>Company</Label><input className={inputCls} value={company} onChange={e=>setCompany(e.target.value)} maxLength={200}/></label>
        <label><Label>Role</Label><input className={inputCls} value={role} onChange={e=>setRole(e.target.value)} maxLength={200}/></label>
        <label><Label>LinkedIn profile link</Label><input className={inputCls} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.linkedin.com/in/..."/></label>
        <label><Label>How you know them</Label><select className={inputCls} value={relationship} onChange={e=>setRelationship(e.target.value as Relationship)}><option value="stranger">Stranger</option><option value="alumni">Alumni</option><option value="knows_me">They know me</option></select></label>
      </div><Button className="mt-4" disabled={!name.trim()||busy} onClick={()=>add({name,company,role,profileUrl:url},"manual")}>Add person</Button></Card>
      <Card><h2 className="text-lg font-bold">Your connections</h2><p className="mt-1 text-soft">Import your Connections.csv or archive on this device. Only a person you add is sent to Lynkr.</p><input type="file" accept=".zip,.csv" aria-label="Import connections" onChange={importFile} className="mt-3 block"/>{notice && <p role="status" className="mt-2 text-soft">{notice}</p>}{connections.length>0 && <><Button variant="quiet" onClick={async()=>{try {await clearConnections(); setConnections([]); setNotice("Connections removed from this device.");} catch {setError("Could not remove connections from this device.");}}}>Remove from this device</Button><ul className="mt-3 space-y-2">{rankConnections(connections,{companies:[],roles:[profile.targetRole]}).slice(0,20).map((c,i)=><li key={`${c.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2"><span>{c.name} {c.role && `· ${c.role}`} {c.company && `· ${c.company}`} {c.dormant && "· connected over 2 years ago"}</span><Button variant="ghost" disabled={busy} onClick={()=>add(c,"connections")}>Add</Button></li>)}</ul></>}</Card>
      <Card><h2 className="text-lg font-bold">Chrome extension</h2><p className="mt-1 text-soft">Create a pairing token for the Lynkr extension. Treat it like a password.</p><Button className="mt-3" variant="ghost" onClick={async()=>{setError(null);try {const r=await request<{token:string}>("POST",{},"/api/ext/pair");setPairToken(r.token);const list=await request<{tokens:typeof tokens}>("GET",undefined,"/api/ext/revoke");setTokens(list.tokens);}catch(e){setError((e as Error).message);}}}>Create pairing token</Button>{pairToken && <div className="mt-3"><label className="block"><Label>Pairing token, shown once</Label><input className={inputCls} readOnly value={pairToken}/></label><Button variant="quiet" onClick={async()=>{if(await copyText(pairToken)) setNotice("Pairing token copied.");}}>Copy token</Button><Button variant="quiet" onClick={()=>setPairToken("")}>Hide token</Button></div>}{tokens.filter(t=>!t.revokedAt).map(t=><div key={t.id} className="mt-3 flex items-center gap-3"><span className="text-sm text-soft">Access expires {new Date(t.expiresAt).toLocaleDateString("en-IN")}</span><Button variant="quiet" onClick={async()=>{try {await request("POST",{id:t.id},"/api/ext/revoke");setTokens(x=>x.filter(item=>item.id!==t.id));setPairToken("");}catch(e){setError((e as Error).message);}}}>Revoke</Button></div>)}</Card>
      <Card><h2 className="text-lg font-bold">People</h2>{contacts.length===0 ? <p className="mt-2 text-soft">No people added yet.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{contacts.map(c=><button key={c.id} onClick={()=>{setSelected(c.id);setDraft(null);setCandidates([]);setSelectedUrls([]);setSelectedText("");}} className={`rounded-xl border p-3 text-left ${selected===c.id?"border-accent":"border-line"}`}><span className="font-medium">{c.name}</span><span className="block text-sm text-soft">{[c.role,c.company,stages.find(s=>s.id===c.status)?.label].filter(Boolean).join(" · ")}</span></button>)}</div>}</Card>
      {person && <Card><h2 className="text-lg font-bold">{person.name}</h2><p className="text-soft">{[person.role,person.company].filter(Boolean).join(" · ")}</p>
        <a className="mt-2 inline-block text-accent underline" target="_blank" rel="noopener noreferrer" href={person.profileUrl || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([person.name,person.company].filter(Boolean).join(" "))}`}>{person.profileUrl?"Open profile":"Find on LinkedIn"}</a>
        <label className="mt-4 block"><Label>Stage</Label><select className={inputCls} value={person.status} onChange={e=>move(person,e.target.value as ContactStatus)}>{stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <div className="mt-4 rounded-lg border border-line p-4"><h3 className="font-bold">Research this person</h3><p className="mt-1 text-sm text-soft">Search public pages, then choose which sources to use. Check that each result is the right person.</p>
          <Button className="mt-3" variant="ghost" disabled={busy} onClick={async()=>{setBusy(true);setError(null);try {const r=await request<{connected:boolean;candidates:typeof candidates;note?:string}>("POST",{action:"search",contactId:person.id},"/api/outreach/brief");setCandidates(r.candidates);setSelectedUrls([]);setNotice(r.note || (r.candidates.length ? "Choose sources to use." : "No public sources found."));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Search public sources</Button>
          {notice && <p role="status" className="mt-2 text-sm text-soft">{notice}</p>}
          {candidates.map(c=><label key={c.url} className="mt-2 flex items-start gap-2"><input type="checkbox" checked={selectedUrls.includes(c.url)} onChange={e=>setSelectedUrls(x=>e.target.checked?[...x,c.url]:x.filter(u=>u!==c.url))}/><span><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{c.title || c.url}</a> {c.date && <span className="text-sm text-soft">{c.date}</span>}</span></label>)}
          <label className="mt-3 block"><Label>Or paste professional text you selected</Label><textarea className={inputCls} maxLength={4000} value={selectedText} onChange={e=>setSelectedText(e.target.value)}/></label>
          <Button className="mt-3" variant="ghost" disabled={busy || (!selectedUrls.length && !selectedText.trim())} onClick={async()=>{setBusy(true);setError(null);try {await request("POST",{action:"confirm",contactId:person.id,urls:selectedUrls,selectedText},"/api/outreach/brief");const r=await request<{contacts:Contact[]}>("GET");setContacts(r.contacts);setNotice("Brief updated. Review the facts before using them.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Build brief from selected sources</Button>
          {Array.isArray(person.brief?.facts) && <ul className="mt-3 space-y-2">{(person.brief.facts as {text:string;source:string;quote:string}[]).map((f,i)=><li key={i} className="text-sm"><p>{f.text}</p><p className="text-soft">Source: {f.source} ? ?{f.quote}?</p></li>)}</ul>}
        </div>
        {action && <div className="mt-4 rounded-lg border border-line p-4"><p>{action.kind === "second_person" ? "Consider another person at the same company." : action.kind === "follow_up" ? "A follow-up is due. Add something new, then close the loop." : "Consider withdrawing the unanswered invitation."}</p>{action.kind !== "withdraw" && <Button variant="ghost" className="mt-2" onClick={()=>patchPerson(person,{brief:{...person.brief,[action.kind === "follow_up" ? "followUpSent" : "secondPersonSuggested"]:true}})}>{action.kind === "follow_up" ? "Mark follow-up sent" : "Dismiss suggestion"}</Button>}</div>}
        <div className="mt-4 rounded-lg border border-line p-4"><h3 className="font-bold">Calendar reminders</h3><p className="mt-1 text-sm text-soft">Save an activity or reminder, then export it to your calendar. Lynkr does not send invitations.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><Label>Activity</Label><select className={inputCls} value={eventType} onChange={e=>setEventType(e.target.value as OutreachEventType)}>{OUTREACH_EVENT_TYPES.map(t=><option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}</select></label>
          <label><Label>Date</Label><input className={inputCls} type="date" value={eventDay} onChange={e=>setEventDay(e.target.value)}/></label><label><Label>Time (IST)</Label><input className={inputCls} type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)}/></label><label><Label>Reason (optional)</Label><input className={inputCls} maxLength={300} value={eventReason} onChange={e=>setEventReason(e.target.value)}/></label></div>
          <Button className="mt-3" variant="ghost" disabled={!eventDay || !eventTime} onClick={async()=>{const event:OutreachEvent={id:crypto.randomUUID(),contactId:person.id,person:person.name,type:eventType,day:eventDay,time:eventTime,goal:person.goal,intent:person.intent,reason:eventReason,connectionStatus:person.status};await patchPerson(person,{brief:{...person.brief,calendarEvents:saveOutreachEvent(events,event)}});setEventReason("");}}>Save reminder</Button>
          {events.map(event=><div key={event.id} className="mt-3 border-t border-line pt-3"><p className="text-sm">{event.type.replaceAll("_"," ")} ? {event.day} {event.time} IST</p><div className="flex flex-wrap items-center gap-2"><Button variant="quiet" onClick={()=>downloadOutreachIcs("lynkr-reminder.ics",[event])}>Download .ics</Button><a className="text-sm text-accent underline" href={outreachGoogleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">Open Google Calendar</a><Button variant="quiet" onClick={()=>patchPerson(person,{brief:{...person.brief,calendarEvents:removeOutreachEvent(events,event.id)}})}>Remove</Button></div></div>)}
        </div>
        <label className="mt-4 block"><Label>Outcome</Label><select className={inputCls} value={person.outcome ?? ""} onChange={e=>patchPerson(person,{outcome:e.target.value || null,...(e.target.value ? {status:"outcome",outcomeAt:new Date().toISOString()} : {})})}><option value="">No outcome yet</option><option value="positive">Positive</option><option value="negative">Negative</option><option value="no_response">No response</option></select></label>
        <Button className="mt-4" disabled={busy} onClick={async()=>{setBusy(true);setError(null);try {setDraft(await postJson<DraftResult>("/api/outreach/draft",{contactId:person.id,channel:"linkedin_message"}));} catch(e) {setError((e as Error).message);} finally {setBusy(false);}}}>{busy ? "Writing?" : "Write a message"}</Button>
        {draft && <div className="mt-4 space-y-3">{notice && <p role="status" className="text-sm text-soft">{notice}</p>}<p className="text-sm text-soft">{draft.recommendation}</p>{draft.versions.map((v,i)=><div key={i} className="rounded-lg border border-line p-3"><p className="whitespace-pre-wrap">{v.body}</p><p className="mt-2 text-sm text-soft">{v.verdict}</p><Button variant="ghost" className="mt-2" disabled={v.verdict==="Do not send yet"} onClick={async()=>setNotice(await copyText(v.body)?"Copied. Review and send it yourself.":"Copy was blocked. Select the text and copy it.")}>Copy</Button></div>)}{draft.strongerQuestion && <p className="text-sm text-soft">{draft.strongerQuestion}</p>}</div>}
      </Card>}
    </>}
  </div>;
}
