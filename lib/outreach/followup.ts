import { addDays, todayIST, weekdayIndex } from "../ist";

/** Add business days to an IST calendar date. Weekends are excluded. */
export function addBusinessDays(day: string, count: number): string {
  let current = day;
  for (let done = 0; done < count;) {
    current = addDays(current, 1);
    if (weekdayIndex(current) < 5) done++;
  }
  return current;
}

export type FollowupContact = {
  status: string;
  invitedAt?: string | Date | null;
  acceptedAt?: string | Date | null;
  messagedAt?: string | Date | null;
  repliedAt?: string | Date | null;
  outcome?: string | null;
  secondPersonSuggested?: boolean;
  followUpSent?: boolean;
};
export type NextAction = { kind: "second_person" | "follow_up" | "withdraw"; day: string } | null;
const dayOf = (value: string | Date) => todayIST(new Date(value));

/** A suggestion only: the person sends or withdraws manually. */
export function nextAction(contact: FollowupContact, now = new Date()): NextAction {
  if (contact.repliedAt || contact.outcome || ["replied", "outcome", "closed"].includes(contact.status)) return null;
  const today = todayIST(now);
  if (contact.status === "invited" && contact.invitedAt && !contact.acceptedAt) {
    const due = addDays(dayOf(contact.invitedAt), 21);
    return today >= due ? { kind: "withdraw", day: due } : null;
  }
  if (contact.status !== "messaged" || !contact.messagedAt || contact.followUpSent) return null;
  const sent = dayOf(contact.messagedAt);
  const follow = addBusinessDays(sent, 7);
  if (today >= follow) return { kind: "follow_up", day: follow };
  const second = addBusinessDays(sent, 3);
  return today >= second && !contact.secondPersonSuggested ? { kind: "second_person", day: second } : null;
}

/** Always display the denominator; rates are withheld for small samples. */
export function replySummary(replied: number, eligible: number): string {
  return eligible < 5 ? `${replied} of ${eligible}` : `${replied} of ${eligible} (${Math.round(replied / eligible * 100)}%)`;
}
