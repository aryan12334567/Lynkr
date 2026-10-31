import { z } from "zod";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { cloudReady, getDb } from "@/lib/db";
import { readJson } from "@/lib/http";
import { addContactCapped, contactBody as body, contactPatch as patch, deleteContact, listContacts, normalizeProfileUrl, updateContact } from "@/lib/outreach/contacts-db";

const status = z.enum(["to_contact", "invited", "accepted", "messaged", "replied", "meeting", "outcome"]);
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
  try { const contact=await updateContact(c.db!,c.user!.id,id,data); return contact?Response.json({contact}):Response.json({error:"Contact not found."},{status:404}); } catch { return Response.json({error:"Invalid contact data."},{status:400}); }
}
export async function DELETE(req:Request) {
  const c=await context(req); if(c.error) return c.error;
  const read=await readJson(req,1024); if("error" in read) return read.error;
  const parsed=z.object({id:z.string().uuid()}).strict().safeParse(read.body); if(!parsed.success) return Response.json({error:"Invalid contact."},{status:400});
  return (await deleteContact(c.db!,c.user!.id,parsed.data.id))?Response.json({deleted:true}):Response.json({error:"Contact not found."},{status:404});
}
