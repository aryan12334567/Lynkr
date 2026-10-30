import { z } from "zod";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { cloudReady, getDb } from "@/lib/db";
import { readJson } from "@/lib/http";
import { addContactCapped, deleteContact, listContacts, normalizeProfileUrl, updateContact, type ContactPatch } from "@/lib/outreach/contacts-db";

const status = z.enum(["to_contact", "invited", "accepted", "messaged", "replied", "outcome"]);
const body = z.object({
  name: z.string().trim().min(1).max(200), company: z.string().trim().max(200).nullable().optional(), role: z.string().trim().max(200).nullable().optional(),
  profileUrl: z.string().max(500).nullable().optional(), relationship: z.enum(["stranger", "alumni", "knows_me"]).nullable().optional(),
  bridge: z.enum(["knows_me", "worked_studied", "alumni", "event", "mutual_intro", "public_work", "live_role", "none"]),
  goal: z.enum(["job", "internship", "referral", "network", "mentor", "clients", "hiring", "funding", "buy_business", "partner", "reconnect"]),
  intent: z.enum(["learn_role", "work_question", "feedback", "explore_team", "live_job", "referral", "follow_up", "thank_you"]),
  tier: z.enum(["tier_1", "tier_2"]), source: z.enum(["connections", "manual", "finder", "extension"]).nullable().optional(),
  brief: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
const patch = body.partial().extend({id:z.string().uuid(), status:status.optional(), outcome:z.enum(["positive","negative","no_response"]).nullable().optional(), noteUsed:z.boolean().optional(), angleUsed:z.string().regex(/^angle_[a-z0-9_]+$/).nullable().optional(), invitedAt:z.iso.datetime().nullable().optional(), acceptedAt:z.iso.datetime().nullable().optional(), messagedAt:z.iso.datetime().nullable().optional(), repliedAt:z.iso.datetime().nullable().optional(), outcomeAt:z.iso.datetime().nullable().optional(), nextActionAt:z.iso.datetime().nullable().optional()}).strict();
async function context(req:Request) {
  const denied=await requireLicense(req); if(denied) return {error:denied};
  const user=await sessionUser(req); if(!user) return {error:Response.json({error:"Please sign in first."},{status:401})};
  if(!await cloudReady()) return {error:Response.json({error:"Account storage is unavailable."},{status:409})};
  const db=getDb();
  const ready=await db.query<{name:string|null}>("select to_regclass('public.contacts')::text as name");
  if(!ready.rows[0]?.name) return {error:Response.json({error:"Outreach storage is unavailable."},{status:409})};
  return {db,user};
}
export async function GET(req:Request) {
  const c=await context(req); if(c.error) return c.error;
  const query=z.object({status:status.optional()}).strict().safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if(!query.success) return Response.json({error:"Invalid query."},{status:400});
  const contacts=await listContacts(c.db!,c.user!.id);
  return Response.json({contacts:query.data.status?contacts.filter(x=>x.status===query.data.status):contacts});
}
export async function POST(req:Request) {
  const c=await context(req); if(c.error) return c.error;
  const read=await readJson(req,16*1024); if("error" in read) return read.error;
  const parsed=body.safeParse(read.body); if(!parsed.success) return Response.json({error:"Invalid contact data."},{status:400});
  try { normalizeProfileUrl(parsed.data.profileUrl); } catch { return Response.json({error:"Use a LinkedIn profile link."},{status:400}); }
  const contact=await addContactCapped(c.db!,c.user!.id,parsed.data);
  if(!contact) return Response.json({error:"You've reached your monthly contact limit. Change it in settings or wait until next month."},{status:429});
  return Response.json({contact},{status:201});
}
export async function PATCH(req:Request) {
  const c=await context(req); if(c.error) return c.error;
  const read=await readJson(req,16*1024); if("error" in read) return read.error;
  const parsed=patch.safeParse(read.body); if(!parsed.success) return Response.json({error:"Invalid contact data."},{status:400});
  const {id,...data}=parsed.data;
  try { const contact=await updateContact(c.db!,c.user!.id,id,{...data,...Object.fromEntries(["invitedAt","acceptedAt","messagedAt","repliedAt","outcomeAt","nextActionAt"].filter(k=>k in data).map(k=>[k,(data as Record<string,unknown>)[k] ? new Date((data as Record<string,string>)[k]) : null]))} as ContactPatch); return contact?Response.json({contact}):Response.json({error:"Contact not found."},{status:404}); } catch { return Response.json({error:"Invalid contact data."},{status:400}); }
}
export async function DELETE(req:Request) {
  const c=await context(req); if(c.error) return c.error;
  const read=await readJson(req,1024); if("error" in read) return read.error;
  const parsed=z.object({id:z.string().uuid()}).strict().safeParse(read.body); if(!parsed.success) return Response.json({error:"Invalid contact."},{status:400});
  return (await deleteContact(c.db!,c.user!.id,parsed.data.id))?Response.json({deleted:true}):Response.json({error:"Contact not found."},{status:404});
}
