// Made-up recipients for the outreach evaluation (build plan U12). No real people.
// Some have no role or no company, because a contact added from a connections file often has neither.
export type Recipient = { name: string; role: string | null; company: string | null };

export const RECIPIENTS: Recipient[] = [
  { name: "Riya Shah", role: "analyst", company: "Example Co" },
  { name: "Dev Patel", role: "engineering manager", company: "Northwind Logistics" },
  { name: "Ananya Iyer", role: "founder", company: null },
  { name: "Tomas O'Neill", role: null, company: "Harbor Analytics" },
  { name: "Mei Lin", role: null, company: null },
  { name: "Sanjay Rao", role: "head of operations", company: "Kaveri Foods" },
];

/** Deterministic: the same index always gives the same recipient, so a run can be repeated. */
export const recipientAt = (i: number): Recipient => RECIPIENTS[i % RECIPIENTS.length];
