import type { FactKind, Channel, Intent } from "../schemas";
import type { Relationship } from "../checker";
import { GOAL_IDS, type OutreachGoal, defaultIntent } from "./goals";
export type Playbook = { goal: OutreachGoal; relationship: Relationship; intent: Intent; angles: readonly string[]; ask: string; proof: readonly FactKind[]; lengths: Record<Channel, number>; followUp: string; forbidden: readonly string[] };
const asks: Record<OutreachGoal,string> = {
 job:"What would you suggest someone focus on when learning about this work?",
 referral:"What would you suggest someone focus on when learning about this work?",
 network:"What has been most useful to you in this work?",
 mentor:"What would you suggest someone focus on when learning this work?",
 clients:"Would you be open to a conversation about your team's priorities?",
 hiring:"Would you be open to a conversation about your work?",
 funding:"Would you be open to a conversation about your investment interests?",
 buy_business:"Would you be open to a confidential conversation about your business?",
 partner:"Would you be open to exploring a possible collaboration?",
 reconnect:"Would you be open to catching up?",
};
export function playbookFor(goal: OutreachGoal, relationship: Relationship): Playbook {
 const intent = defaultIntent(goal, relationship);
 return { goal, relationship, intent, angles:["direct", "context"], ask: intent === "referral" ? "Would you be comfortable referring me?" : asks[goal], proof:["project","contribution","evidence","offer"], lengths:{connection_note:200,linkedin_message:90,inmail:120,email:150}, followUp:"Share one relevant update, then ask once.", forbidden:relationship === "stranger" ? ["referral to a stranger", "invented relationship"] : ["invented relationship"] };
}
export const PLAYBOOKS: readonly Playbook[] = GOAL_IDS.flatMap(goal => (["stranger","alumni","knows_me"] as const).map(relationship => playbookFor(goal, relationship)));
