/** The workspace tabs (U7, KTD2). With Outreach v2 one Outreach tab replaces Outreach and Connect; Profile fix is gone for good. */
export const TAB_LABEL = {
  today: "Today",
  vault: "Story Vault",
  outreach: "Outreach",
  posts: "Posts & comments",
  plan: "This week",
  connect: "Connect",
  check: "Check a message",
} as const;
export type TabId = keyof typeof TAB_LABEL;
const ORDER: readonly TabId[] = ["today", "vault", "outreach", "posts", "plan", "connect", "check"];

/** The tabs to show, in order. v1 is unchanged. */
export function tabIds(outreachV2: boolean): TabId[] {
  return ORDER.filter((id) => !outreachV2 || id !== "connect");
}
