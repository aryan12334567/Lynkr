import { z } from "zod";
import { confirmedFacts } from "@/lib/db";
import { readJson } from "@/lib/http";
import { CHANNELS } from "@/lib/schemas";
import { generateOutreach } from "@/lib/outreach/draft";
import { isMock } from "@/lib/llm";
import { recordAISpend } from "@/lib/outreach/contacts-db";
import { GOAL_IDS } from "@/lib/outreach/goals";
import { getContact } from "@/lib/outreach/contacts-db";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
const Body = z.object({ contactId: z.string().uuid(), channel: z.enum(CHANNELS).default("linkedin_message") }).strict();
export const OPTIONS = preflight;
export async function POST(req: Request) {
 const auth = await extensionAuth(req); if ("error" in auth) return auth.error;
 const read = await readJson(req, 2048); if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
 const body = Body.safeParse(read.body); if (!body.success) return extJson(req, { error: "Invalid request." }, 400);
 const contact = await getContact(auth.db, auth.userId, body.data.contactId);
 if (!contact) return extJson(req, { error: "Contact not found." }, 404);
 if (!(GOAL_IDS as readonly string[]).includes(contact.goal)) return extJson(req, { error: "This goal is not available yet." }, 422);
 const facts = (await confirmedFacts(auth.db, auth.userId)).slice(0, 2).map(({ id, kind, text }) => ({ id, kind, text }));
  const briefParsed = z.array(z.object({ text: z.string().max(240) }).passthrough()).max(3).safeParse(contact.brief?.facts);
  const briefFacts = briefParsed.success ? briefParsed.data.map((f, i) => ({ id: `B${i + 1}`, text: f.text })) : [];
 if (!isMock() && (!(await recordAISpend(auth.db, auth.userId)) || !(await recordAISpend(auth.db, auth.userId)))) return extJson(req, { error: "Daily outreach draft limit reached." }, 429);
 const result = await generateOutreach({ goal: contact.goal as (typeof GOAL_IDS)[number], relationship: contact.relationship ?? "stranger", channel: body.data.channel, name: contact.name, role: contact.role, company: contact.company, facts, briefFacts });
 return extJson(req, result);
}
