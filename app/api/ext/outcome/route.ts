import { z } from "zod";
import { readJson } from "@/lib/http";
import { updateContact } from "@/lib/outreach/contacts-db";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
const Body = z.object({ contactId: z.string().uuid(), status: z.enum(["invited", "accepted", "messaged", "replied", "outcome"]), outcome: z.enum(["positive", "negative", "no_response"]).optional() }).strict().refine((b) => b.status !== "outcome" || !!b.outcome);
export const OPTIONS = preflight;
export async function POST(req: Request) {
 const auth = await extensionAuth(req); if ("error" in auth) return auth.error;
 const read = await readJson(req, 2048); if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
 const body = Body.safeParse(read.body); if (!body.success) return extJson(req, { error: "Invalid request." }, 400);
 const { contactId, status, outcome } = body.data;
 const dateKey = { invited: "invitedAt", accepted: "acceptedAt", messaged: "messagedAt", replied: "repliedAt", outcome: "outcomeAt" }[status];
 const contact = await updateContact(auth.db, auth.userId, contactId, { status, [dateKey]: new Date(), ...(outcome ? { outcome } : {}) });
 return contact ? extJson(req, { contact: { id: contact.id, status: contact.status, outcome: contact.outcome } }) : extJson(req, { error: "Contact not found." }, 404);
}
