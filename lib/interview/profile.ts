import { ProfileInput, type Bucket, type Goal } from "../schemas";
import type { Stage } from "../roles";
import { briefFrom, type Answer, type Brief } from "./engine";

/**
 * The interview's context brief as the ProfileInput every existing feature already reads
 * (profile fix, outreach, Connect, comments, plan), so the new interview plugs into the old drafts.
 */
export function profileFrom(bucket: Bucket, answers: Answer[], importText = ""): ProfileInput | null {
  const b: Brief = briefFrom(bucket, answers);
  const said = (qid: string) => answers.find((a) => a.qid === qid && a.attempt === 0 && a.status === "answered")?.text ?? "";
  const goal: Goal = b.goals.includes("internship")
    ? "internship"
    : b.goals.includes("referral")
      ? "referral"
      : bucket === "networker" || (b.goals.length > 0 && b.goals.every((g) => g === "network" || g === "mentor" || g === "clients"))
        ? "network"
        : "job";
  const stage: Stage = bucket === "fresher" ? (/final year/i.test(b.currentRole) ? "final_year" : "recent_grad") : bucket === "switcher" ? "switching" : "experienced";
  const background = [b.currentRole, said("A2") && `People come to me for: ${said("A2")}`].filter(Boolean).join(". ").slice(0, 400);
  const parsed = ProfileInput.safeParse({
    goal,
    targetRole: (b.targetRoles || b.currentRole).slice(0, 120),
    background: background || "Not given yet",
    currentProfile: importText.slice(0, 4000),
    domain: b.field,
    domainConfirmed: true,
    stage,
    keepPrivate: b.privateSearch ? "My job search" : "",
    bucket,
    goals: b.goals,
    mustHaves: b.mustHaves,
    privateSearch: b.privateSearch,
    weeklyTime: b.weeklyTime,
  });
  return parsed.success ? parsed.data : null;
}
