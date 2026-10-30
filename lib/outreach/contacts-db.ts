import { createHash, randomUUID } from "node:crypto";
import type { Db } from "../db";
import type { Bridge, Intent } from "../schemas";
import type { Relationship } from "../checker";

export type OutreachGoal = "job" | "internship" | "referral" | "network" | "mentor" | "clients" | "hiring" | "funding" | "buy_business" | "partner" | "reconnect";
export type ContactStatus = "to_contact" | "invited" | "accepted" | "messaged" | "replied" | "outcome";
export type Contact = {
  id: string; userId: string; name: string; company: string | null; role: string | null;
  profileUrl: string | null; relationship: Relationship | null; bridge: Bridge; goal: OutreachGoal;
  intent: Intent; tier: "tier_1" | "tier_2"; source: "connections" | "manual" | "finder" | "extension" | null;
  status: ContactStatus; invitedAt: Date | null; acceptedAt: Date | null; messagedAt: Date | null;
  repliedAt: Date | null; outcomeAt: Date | null; nextActionAt: Date | null;
  outcome: "positive" | "negative" | "no_response" | null; noteUsed: boolean; angleUsed: string | null;
  brief: Record<string, unknown> | null; createdAt: Date; updatedAt: Date;
};
export type ContactInput = Pick<Contact, "name" | "bridge" | "goal" | "intent" | "tier"> & Partial<Pick<Contact, "company" | "role" | "profileUrl" | "relationship" | "source" | "brief">>;
export type ContactPatch = Partial<Omit<Contact, "id" | "userId" | "createdAt" | "updatedAt">>;
const date = (x: unknown) => x ? new Date(x as string) : null;
const toContact = (r: Record<string, unknown>): Contact => ({
  id: r.id as string, userId: r.user_id as string, name: r.name as string, company: r.company as string | null,
  role: r.role as string | null, profileUrl: r.profile_url as string | null, relationship: r.relationship as Relationship | null,
  bridge: r.bridge as Bridge, goal: r.goal as OutreachGoal, intent: r.intent as Intent, tier: r.tier as Contact["tier"],
  source: r.source as Contact["source"], status: r.status as ContactStatus, invitedAt: date(r.invited_at), acceptedAt: date(r.accepted_at),
  messagedAt: date(r.messaged_at), repliedAt: date(r.replied_at), outcomeAt: date(r.outcome_at), nextActionAt: date(r.next_action_at),
  outcome: r.outcome as Contact["outcome"], noteUsed: r.note_used as boolean, angleUsed: r.angle_used as string | null,
  brief: r.brief as Contact["brief"], createdAt: new Date(r.created_at as string), updatedAt: new Date(r.updated_at as string),
});
export function normalizeProfileUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u: URL; try { u = new URL(raw); } catch { throw new Error("Invalid LinkedIn profile URL"); }
  const m = /^\/in\/([a-z0-9-]+)\/?$/i.exec(u.pathname);
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== "www.linkedin.com" || u.port || u.username || u.password || !m) throw new Error("Invalid LinkedIn profile URL");
  return `https://www.linkedin.com/in/${m[1].toLowerCase()}/`;
}
export async function listContacts(db: Db, userId: string): Promise<Contact[]> {
  return (await db.query("select * from contacts where user_id = $1 order by updated_at desc, created_at desc", [userId])).rows.map(toContact);
}
export async function getContact(db: Db, userId: string, contactId: string): Promise<Contact | null> {
  const r = await db.query("select * from contacts where user_id = $1 and id = $2", [userId, contactId]); return r.rows[0] ? toContact(r.rows[0]) : null;
}
export async function addContact(db: Db, userId: string, data: ContactInput): Promise<Contact> {
  const r = await db.query(`insert into contacts (id,user_id,name,company,role,profile_url,relationship,bridge,goal,intent,tier,source,brief)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) returning *`,
    [randomUUID(), userId, data.name.trim(), data.company ?? null, data.role ?? null, normalizeProfileUrl(data.profileUrl), data.relationship ?? null, data.bridge, data.goal, data.intent, data.tier, data.source ?? "manual", data.brief ? JSON.stringify(data.brief) : null]);
  return toContact(r.rows[0]);
}
/** Atomically reserve one monthly slot and insert the contact in the same statement.
 * A deletion never gives back a slot. Concurrent requests serialize on the user's quota row.
 */
export async function addContactCapped(db: Db, userId: string, data: ContactInput): Promise<Contact | null> {
  const url = normalizeProfileUrl(data.profileUrl);
  const r = await db.query(`with quota as (
    insert into lynkr_user_outreach (user_id, last_monthly_contacts_count, contacts_count_month)
    values ($2, 1, date_trunc('month', now() at time zone 'Asia/Kolkata')::date)
    on conflict (user_id) do update set
      last_monthly_contacts_count = case when lynkr_user_outreach.contacts_count_month = excluded.contacts_count_month
        then lynkr_user_outreach.last_monthly_contacts_count + 1 else 1 end,
      contacts_count_month = excluded.contacts_count_month, updated_at = now()
    where lynkr_user_outreach.contacts_count_month <> excluded.contacts_count_month
       or lynkr_user_outreach.last_monthly_contacts_count < lynkr_user_outreach.monthly_new_contacts_limit
    returning user_id
  )
  insert into contacts (id,user_id,name,company,role,profile_url,relationship,bridge,goal,intent,tier,source,brief)
  select $1,quota.user_id,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb from quota returning *`,
    [randomUUID(), userId, data.name.trim(), data.company ?? null, data.role ?? null, url, data.relationship ?? null,
     data.bridge, data.goal, data.intent, data.tier, data.source ?? "manual", data.brief ? JSON.stringify(data.brief) : null]);
  return r.rows[0] ? toContact(r.rows[0]) : null;
}
const COLUMNS: Record<keyof ContactPatch, string> = { name:"name", company:"company", role:"role", profileUrl:"profile_url", relationship:"relationship", bridge:"bridge", goal:"goal", intent:"intent", tier:"tier", source:"source", status:"status", invitedAt:"invited_at", acceptedAt:"accepted_at", messagedAt:"messaged_at", repliedAt:"replied_at", outcomeAt:"outcome_at", nextActionAt:"next_action_at", outcome:"outcome", noteUsed:"note_used", angleUsed:"angle_used", brief:"brief" };
export async function updateContact(db: Db, userId: string, contactId: string, data: ContactPatch): Promise<Contact | null> {
  const entries = Object.entries(data).filter(([key, value]) => key in COLUMNS && value !== undefined);
  if (!entries.length) return getContact(db,userId,contactId);
  const values: unknown[] = [userId, contactId];
  const set = entries.map(([key, val]) => { values.push(key === "profileUrl" ? normalizeProfileUrl(val as string | null) : key === "brief" && val !== null ? JSON.stringify(val) : val); return `${COLUMNS[key as keyof ContactPatch]} = $${values.length}${key === "brief" ? "::jsonb" : ""}`; });
  const r = await db.query(`update contacts set ${set.join(", ")}, updated_at = now() where user_id = $1 and id = $2 returning *`, values);
  return r.rows[0] ? toContact(r.rows[0]) : null;
}
export async function deleteContact(db: Db, userId: string, contactId: string): Promise<boolean> {
  return (await db.query("delete from contacts where user_id = $1 and id = $2 returning id", [userId,contactId])).rows.length > 0;
}
export type ExtensionToken = { id: string; userId: string; expiresAt: Date; revokedAt: Date | null; lastUsedAt: Date | null };
const token = (r: Record<string,unknown>): ExtensionToken => ({ id:r.id as string,userId:r.user_id as string,expiresAt:new Date(r.expires_at as string),revokedAt:date(r.revoked_at),lastUsedAt:date(r.last_used_at) });
export async function createExtensionToken(db: Db,userId:string,rawToken:string):Promise<ExtensionToken> {
  const hash=createHash("sha256").update(rawToken).digest("hex");
  const r=await db.query("insert into ext_tokens (id,user_id,token_hash,expires_at) values ($1,$2,$3,now()+interval '90 days') returning *",[randomUUID(),userId,hash]); return token(r.rows[0]);
}
export async function listExtensionTokens(db:Db,userId:string):Promise<ExtensionToken[]> { return (await db.query("select * from ext_tokens where user_id=$1 order by created_at desc",[userId])).rows.map(token); }
export async function getExtensionToken(db:Db,userId:string,id:string):Promise<ExtensionToken|null> { const r=await db.query("select * from ext_tokens where user_id=$1 and id=$2",[userId,id]); return r.rows[0]?token(r.rows[0]):null; }
export async function revokeExtensionToken(db:Db,userId:string,id:string):Promise<ExtensionToken|null> { const r=await db.query("update ext_tokens set revoked_at=now() where user_id=$1 and id=$2 and revoked_at is null returning *",[userId,id]); return r.rows[0]?token(r.rows[0]):null; }
export type OutreachSettings = { monthlyNewContactsLimit:number; lastMonthlyContactsCount:number };
export async function addOutreachSettings(db:Db,userId:string):Promise<void> { await db.query("insert into lynkr_user_outreach (user_id) values ($1) on conflict do nothing",[userId]); }
export async function getOutreachSettings(db:Db,userId:string):Promise<OutreachSettings> { await addOutreachSettings(db,userId); const r=await db.query("select monthly_new_contacts_limit,last_monthly_contacts_count from lynkr_user_outreach where user_id=$1",[userId]); return {monthlyNewContactsLimit:r.rows[0].monthly_new_contacts_limit as number,lastMonthlyContactsCount:r.rows[0].last_monthly_contacts_count as number}; }
export async function updateOutreachSettings(db:Db,userId:string,data:{monthlyNewContactsLimit?:number}):Promise<OutreachSettings> { await addOutreachSettings(db,userId); if(data.monthlyNewContactsLimit!==undefined) await db.query("update lynkr_user_outreach set monthly_new_contacts_limit=$2, updated_at=now() where user_id=$1",[userId,data.monthlyNewContactsLimit]); return getOutreachSettings(db,userId); }
export async function incrementMonthlyContacts(db:Db,userId:string):Promise<void> { await addOutreachSettings(db,userId); await db.query("update lynkr_user_outreach set last_monthly_contacts_count=last_monthly_contacts_count+1, updated_at=now() where user_id=$1",[userId]); }
export async function recordAISpend(db:Db,userId:string):Promise<boolean> { return (await db.query(`insert into outreach_daily_usage(user_id,day,chat_model_calls) values ($1,(now() at time zone 'Asia/Kolkata')::date,1) on conflict(user_id,day) do update set chat_model_calls=outreach_daily_usage.chat_model_calls+1 where outreach_daily_usage.chat_model_calls<60 returning 1`,[userId])).rows.length>0; }
export async function getAISpend(db:Db,userId:string):Promise<{calls:number;date:Date}> { const r=await db.query("select chat_model_calls,day from outreach_daily_usage where user_id=$1 and day=(now() at time zone 'Asia/Kolkata')::date",[userId]); return {calls:(r.rows[0]?.chat_model_calls as number)??0,date:r.rows[0]?new Date(r.rows[0].day as string):new Date()}; }
export async function exportContacts(db:Db,userId:string):Promise<Record<string,unknown>[]> { return (await db.query("select * from contacts where user_id=$1",[userId])).rows.map(({user_id,...rest})=>(void user_id,rest)); }
export async function inactiveContacts(db:Db,before:Date):Promise<string[]> { const r=await db.query<{id:string}>("select id from contacts where updated_at<$1 order by updated_at limit 500",[before]); return r.rows.map(x=>x.id); }
export async function expiredExtensionTokens(db:Db):Promise<{token_id:string;user_id:string}[]> { return (await db.query<{token_id:string;user_id:string}>("select id as token_id,user_id from ext_tokens where expires_at<now() and revoked_at is null")).rows; }
