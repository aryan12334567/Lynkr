import { z } from "zod";
import { readJson } from "@/lib/http";
import { normalizeProfileUrl, updateContact } from "@/lib/outreach/contacts-db";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
const Body = z.object({ contactId: z.string().uuid(), profileUrl: z.string().max(500) }).strict();
export const OPTIONS = preflight;
export async function POST(req: Request) {
 const auth = await extensionAuth(req); if ("error" in auth) return auth.error;
 const read = await readJson(req, 2048); if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
 const body = Body.safeParse(read.body); if (!body.success) return extJson(req, { error: "Invalid request." }, 400);
 try {
   const profileUrl = normalizeProfileUrl(body.data.profileUrl);
   if (!profileUrl) return extJson(req, { error: "Open a LinkedIn profile first." }, 400);
   const contact = await updateContact(auth.db, auth.userId, body.data.contactId, { profileUrl });
   return contact ? extJson(req, { contact: { id: contact.id, profileUrl: contact.profileUrl } }) : extJson(req, { error: "Contact not found." }, 404);
 } catch { return extJson(req, { error: "Open a LinkedIn profile first." }, 400); }
}
