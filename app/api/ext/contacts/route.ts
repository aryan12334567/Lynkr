import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
import { listContacts } from "@/lib/outreach/contacts-db";
export const OPTIONS = preflight;
export async function GET(req: Request) {
 const auth = await extensionAuth(req); if ("error" in auth) return auth.error;
 const contacts = await listContacts(auth.db, auth.userId);
 return extJson(req, { contacts: contacts.map(({ id, name, company, role, profileUrl, relationship, goal, intent, tier, status }) => ({ id, name, company, role, profileUrl, relationship, goal, intent, tier, status })) });
}
