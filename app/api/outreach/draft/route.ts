import { z } from "zod";
import { requireLicense } from "@/lib/billing";
import { accountContext } from "@/lib/account";
import { confirmedFacts } from "@/lib/db";
import { readJson } from "@/lib/http";
import { CHANNELS } from "@/lib/schemas";
import { getContact } from "@/lib/outreach/contacts-db";
import { generateOutreach } from "@/lib/outreach/draft";
import { isMock } from "@/lib/llm";
import { recordAISpend } from "@/lib/outreach/contacts-db";
import { GOAL_IDS, type OutreachGoal } from "@/lib/outreach/goals";

const Body = z.object({ contactId: z.string().uuid(), channel: z.enum(CHANNELS), noteLimit: z.union([z.literal(200), z.literal(300)]).optional() }).strict();
export async function POST(req: Request) {
  const locked = await requireLicense(req);
  if (locked) return locked;
  const ctx = await accountContext(req);
  if (!ctx) return Response.json({ error: "Sign in to use outreach." }, { status: 401 });
  const read = await readJson(req, 4096);
  if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Check the contact and channel." }, { status: 400 });
  const contact = await getContact(ctx.db, ctx.userId, parsed.data.contactId);
  if (!contact) return Response.json({ error: "Contact not found." }, { status: 404 });
  const facts = (await confirmedFacts(ctx.db, ctx.userId)).slice(0, 2).map(({ id, kind, text }) => ({ id, kind, text }));
  const briefParsed = z.array(z.object({ text: z.string().max(240) }).passthrough()).max(3).safeParse(contact.brief?.facts);
  const briefFacts = briefParsed.success ? briefParsed.data.map((f, i) => ({ id: `B${i + 1}`, text: f.text })) : [];
  const goal: OutreachGoal = (GOAL_IDS as readonly string[]).includes(contact.goal) ? contact.goal as OutreachGoal : "job";
  if (!isMock() && (!(await recordAISpend(ctx.db, ctx.userId)) || !(await recordAISpend(ctx.db, ctx.userId)))) return Response.json({ error: "Daily outreach draft limit reached." }, { status: 429 });
  return Response.json(await generateOutreach({ goal, relationship: contact.relationship ?? "stranger", channel: parsed.data.channel, name: contact.name, role: contact.role, company: contact.company, facts, briefFacts, noteLimit: parsed.data.noteLimit }));
}
