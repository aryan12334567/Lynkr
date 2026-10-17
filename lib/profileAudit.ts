/**
 * Profile diagnosis (prod/lynkr-profile-fix-intelligence-plan.md §5 and §8).
 * Deterministic: every finding points at what it was based on (your pasted or
 * imported profile, a Story Vault fact, a job description, or the role pattern).
 * No score, no ranking, no claim about LinkedIn's algorithm, and no judgement of
 * how anyone looks.
 */
import type { ProfileInput, StoryFact } from "./schemas";
import { PACK, ROLES, matchRole } from "./roles";
import type { ImportedProfile } from "./linkedinExport";
import type { ExternalContextPacket } from "./schemas";
import { packetText } from "./requirements";

export type FindingStatus = "fix_first" | "consider" | "strong" | "not_applicable" | "cannot_assess";

export const STATUS_LABEL: Record<FindingStatus, string> = {
  fix_first: "Fix first",
  consider: "Optional",
  strong: "Strong",
  not_applicable: "Not needed",
  cannot_assess: "Check yourself",
};

export type ProfileFinding = {
  id: string;
  section: string;
  status: FindingStatus;
  observedSignal: string;
  issue: string;
  whyForThisGoal: string;
  proposedChange?: string;
  evidenceRefs: string[];
  benchmarkRefs: string[];
  confidence: "high" | "medium" | "low";
  userAction: string;
};

export type AuditInput = {
  profile: ProfileInput;
  facts: StoryFact[];
  imported: ImportedProfile | null;
  jobDescription: string;
  headlines: string[];
  about: string;
  /** An imported job page. Used only once the user has approved it. */
  requirements?: ExternalContextPacket | null;
};

const STOCK = /\b(passionate|guru|ninja|rockstar|wizard|enthusiast|hardworking|dynamic|go-getter|self-motivated|results-driven)\b/i;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};
const has = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(text.toLowerCase());

/** The pasted "headline and About" box: first line is the headline, the rest is About. */
export function splitPasted(text: string): { headline: string; about: string } {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { headline: "", about: "" };
  if (lines.length === 1) return lines[0].length <= 220 ? { headline: lines[0], about: "" } : { headline: "", about: lines[0] };
  return { headline: lines[0], about: lines.slice(1).join("\n") };
}

/** Terms from the role pack that appear in a pasted job description. */
export function jdTerms(jd: string): string[] {
  if (!jd.trim()) return [];
  const all = [...new Set(ROLES.flatMap((r) => r.terms))];
  return all.filter((t) => has(jd, t));
}

const ORDER_HIRING = ["Headline", "About", "Skills", "Projects and Featured", "Experience", "Education"];
const ORDER_PRACTICE = ["Projects and Featured", "About", "Headline", "Experience", "Skills", "Education"];

export function auditProfile(input: AuditInput): ProfileFinding[] {
  const { profile, imported, jobDescription } = input;
  const facts = input.facts.filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts);
  const factText = facts.map((f) => f.text).join(" ");
  const pasted = splitPasted(profile.currentProfile ?? "");
  const pattern = matchRole(profile.targetRole);
  const bench = pattern ? [`${pattern.title} pattern (${PACK.id} v${PACK.version}, checked ${PACK.checkedAt})`] : [];
  const terms = pattern?.terms ?? [];
  const approved = input.requirements?.reviewStatus === "approved" ? input.requirements : null;
  const jd = jdTerms([jobDescription, approved ? packetText(approved) : ""].join("\n"));
  const jdSource = approved
    ? `The job page you imported: ${approved.title}${approved.company ? `, ${approved.company}` : ""} (${approved.sourceDomain}, fetched ${approved.fetchedAt.slice(0, 10)})`
    : "The job description you pasted";
  const roleWords = profile.targetRole.toLowerCase().split(/[^a-z0-9&+]+/).filter((w) => w.length > 2 && !["and", "the", "for"].includes(w));
  const hiring = profile.audiences.includes("hiring") || profile.audiences.length === 0 || profile.goal !== "network";
  const factRef = (f: StoryFact | undefined) => (f ? [`Your fact: "${clip(f.text, 70)}"`] : []);
  const out: ProfileFinding[] = [];
  const add = (f: Omit<ProfileFinding, "id" | "benchmarkRefs"> & { benchmarkRefs?: string[] }) =>
    out.push({ benchmarkRefs: [], ...f, id: `${f.section}:${out.length}` });

  // Headline
  const headline = imported?.headline || pasted.headline;
  const headlineSrc = imported?.headline ? "Your headline (from your export)" : "Your headline (pasted)";
  if (!headline) {
    add({
      section: "Headline",
      status: "cannot_assess",
      observedSignal: "Lynkr hasn't seen your headline.",
      issue: "Can't check it without the text.",
      whyForThisGoal: "The headline is the first line people read under your name in search and comments.",
      proposedChange: input.headlines[0],
      evidenceRefs: [],
      benchmarkRefs: bench,
      confidence: "low",
      userAction: "Paste your headline in Basics or import your LinkedIn export, then come back.",
    });
  } else {
    const mentionsRole = roleWords.some((w) => headline.toLowerCase().includes(w)) || (pattern?.aliases ?? []).some((a) => headline.toLowerCase().includes(a));
    const pieces = headline.split(/[|,•·]/).filter((p) => p.trim()).length;
    if (!mentionsRole) {
      add({
        section: "Headline",
        status: "fix_first",
        observedSignal: `"${clip(headline, 90)}"`,
        issue: `It doesn't name the role you want (${profile.targetRole}).`,
        whyForThisGoal: hiring ? "Recruiters search by role title. If it isn't in your headline, they may never see you." : "People in the field decide in a second whether you're relevant to them.",
        proposedChange: input.headlines[0],
        evidenceRefs: [headlineSrc],
        benchmarkRefs: bench,
        confidence: "high",
        userAction: "Edit your headline on LinkedIn. Pick one of the options below and fill its blanks.",
      });
    } else if (pieces > 5 || STOCK.test(headline)) {
      add({
        section: "Headline",
        status: "consider",
        observedSignal: `"${clip(headline, 90)}"`,
        issue: STOCK.test(headline) ? "It uses a stock word that doesn't prove anything." : "It reads like a keyword list.",
        whyForThisGoal: "One role and one real proof point reads more credibly than many labels.",
        proposedChange: input.headlines[0],
        evidenceRefs: [headlineSrc],
        benchmarkRefs: bench,
        confidence: "high",
        userAction: "Cut it to the role plus one proof point.",
      });
    } else {
      add({ section: "Headline", status: "strong", observedSignal: `"${clip(headline, 90)}"`, issue: "Names the role you want.", whyForThisGoal: "Readers can tell what you're aiming for.", evidenceRefs: [headlineSrc], benchmarkRefs: bench, confidence: "high", userAction: "Keep it." });
    }
  }

  // About
  const about = imported?.summary || pasted.about;
  const aboutSrc = imported?.summary ? "Your About (from your export)" : "Your About (pasted)";
  const projectFact = facts.find((f) => f.kind === "project");
  if (!about) {
    add({
      section: "About",
      status: headline ? "fix_first" : "cannot_assess",
      observedSignal: headline ? "No About text found." : "Lynkr hasn't seen your About section.",
      issue: headline ? "An empty About wastes the space where you can show one real piece of work." : "Can't check it without the text.",
      whyForThisGoal: "It's where a reader checks whether your headline is backed by real work.",
      proposedChange: input.about,
      evidenceRefs: factRef(projectFact),
      benchmarkRefs: bench,
      confidence: headline ? "medium" : "low",
      userAction: "Start from the draft below. Keep only what's true and fill the blanks.",
    });
  } else {
    const n = words(about);
    const concrete = /\d/.test(about) || facts.some((f) => f.text.length > 12 && about.toLowerCase().includes(f.text.toLowerCase().slice(0, 24)));
    if (n < 40) {
      add({ section: "About", status: "fix_first", observedSignal: `${n} words.`, issue: "Very short: there's no room for proof.", whyForThisGoal: "Readers look here for what you've actually done.", proposedChange: input.about, evidenceRefs: [aboutSrc, ...factRef(projectFact)], benchmarkRefs: bench, confidence: "high", userAction: "Add one project, your part in it and what changed." });
    } else if (!concrete || STOCK.test(about)) {
      add({
        section: "About",
        status: "fix_first",
        observedSignal: STOCK.test(about) ? `Uses "${STOCK.exec(about)?.[0]}".` : "No number, result or named project.",
        issue: "It describes you but doesn't show anything you did.",
        whyForThisGoal: "One concrete example is more believable than adjectives.",
        proposedChange: input.about,
        evidenceRefs: [aboutSrc, ...factRef(projectFact)],
        benchmarkRefs: bench,
        confidence: "high",
        userAction: "Replace one adjective with one real example from your Story Vault.",
      });
    } else {
      add({ section: "About", status: "strong", observedSignal: `${n} words with concrete detail.`, issue: "Shows real work.", whyForThisGoal: "Backs up your headline.", evidenceRefs: [aboutSrc], benchmarkRefs: bench, confidence: "high", userAction: "Keep it. Re-read it once for anything you can't back up." });
    }
  }

  // Experience
  if (!imported) {
    add({ section: "Experience", status: "cannot_assess", observedSignal: "Not imported.", issue: "Lynkr can only check this from your LinkedIn export.", whyForThisGoal: "Clear titles and one line each on what you did help readers place you.", evidenceRefs: [], confidence: "low", userAction: "Import your export, or check each entry starts with what you did." });
  } else if (imported.positions.length === 0) {
    const student = profile.stage === "final_year" || profile.stage === "recent_grad";
    add({
      section: "Experience",
      status: student ? "consider" : "fix_first",
      observedSignal: "No experience entries in your export.",
      issue: "Nothing listed yet.",
      whyForThisGoal: "Internships, part-time work, volunteering and real project roles all count. Only add what's real.",
      evidenceRefs: ["Your export (Positions)"],
      confidence: "high",
      userAction: "Add any real internship, part-time job or volunteer role with one line on what you did.",
    });
  } else {
    const vague = imported.positions.find((p) => /\bresponsible for\b/i.test(p.description));
    const empty = imported.positions.filter((p) => !p.description.trim()).length;
    const contribution = facts.find((f) => f.kind === "contribution") ?? projectFact;
    if (vague) {
      add({
        section: "Experience",
        status: "fix_first",
        observedSignal: `"${clip(vague.description, 80)}"`,
        issue: `"Responsible for" says what the job was, not what you did (${vague.title}${vague.company ? `, ${vague.company}` : ""}).`,
        whyForThisGoal: "Readers want your action and its result.",
        proposedChange: contribution ? `Start with a verb and your own part, e.g. "${clip(contribution.text, 120)}"` : "Start with a verb: what you did, with which tool, and what changed. [[your own part]]",
        evidenceRefs: ["Your export (Positions)", ...factRef(contribution)],
        benchmarkRefs: bench,
        confidence: "high",
        userAction: "Rewrite that one bullet. Keep \"we\" where the work was shared.",
      });
    } else if (empty > 0) {
      add({ section: "Experience", status: "consider", observedSignal: `${empty} of ${imported.positions.length} entries have no description.`, issue: "Titles alone don't show what you did.", whyForThisGoal: "One line per entry is enough.", evidenceRefs: ["Your export (Positions)"], benchmarkRefs: bench, confidence: "high", userAction: "Add one line each: what you did and what changed." });
    } else {
      add({ section: "Experience", status: "strong", observedSignal: `${imported.positions.length} entries with descriptions.`, issue: "Entries describe the work.", whyForThisGoal: "Readers can see what you did.", evidenceRefs: ["Your export (Positions)"], confidence: "high", userAction: "Keep them. Check each claim is something you did yourself." });
    }
  }

  // Projects and Featured
  const impProjects = imported?.projects ?? [];
  if (projectFact && imported && impProjects.length === 0) {
    add({
      section: "Projects and Featured",
      status: "fix_first",
      observedSignal: "Your export has no projects.",
      issue: "Your strongest piece of work isn't on your profile.",
      whyForThisGoal: pattern ? `For ${pattern.title}: ${pattern.evidence}` : "A project people can open is the fastest proof.",
      proposedChange: `Add a project: ${clip(projectFact.text, 140)}. Say what you did, what changed, and add a link if it's public.`,
      evidenceRefs: factRef(projectFact),
      benchmarkRefs: bench,
      confidence: "medium",
      userAction: "Add it under Projects, and pin the link in Featured if you have one. Don't upload anything confidential.",
    });
  } else if (impProjects.length > 0 && impProjects.every((p) => !p.url)) {
    add({ section: "Projects and Featured", status: "consider", observedSignal: `${impProjects.length} project(s), no links.`, issue: "Readers can't open the work.", whyForThisGoal: "A public link lets them check it in seconds.", evidenceRefs: ["Your export (Projects)"], benchmarkRefs: bench, confidence: "high", userAction: "Add a link to a public repo, demo, report or deck, if you're allowed to share it." });
  } else if (impProjects.length > 0) {
    add({ section: "Projects and Featured", status: "strong", observedSignal: `${impProjects.length} project(s) with links.`, issue: "Proof is easy to find.", whyForThisGoal: "Readers can check your work.", evidenceRefs: ["Your export (Projects)"], benchmarkRefs: bench, confidence: "high", userAction: "Pin the most relevant one in Featured." });
  } else {
    add({
      section: "Projects and Featured",
      status: projectFact ? "consider" : "cannot_assess",
      observedSignal: imported ? "No projects in your export." : "Not imported.",
      issue: projectFact ? "Check your project is on your profile." : "Lynkr can't see your projects.",
      whyForThisGoal: pattern ? `For ${pattern.title}: ${pattern.evidence}` : "A project people can open is the fastest proof.",
      proposedChange: projectFact ? `Add a project: ${clip(projectFact.text, 140)}.` : undefined,
      evidenceRefs: factRef(projectFact),
      benchmarkRefs: bench,
      confidence: "low",
      userAction: "Make sure one relevant project is listed, with a link if it's public.",
    });
  }

  // Skills
  const skills = imported?.skills ?? [];
  const inFacts = terms.filter((t) => has(factText, t));
  const missing = inFacts.filter((t) => !skills.some((s) => s.toLowerCase() === t.toLowerCase()));
  const jdGaps = jd.filter((t) => !skills.some((s) => s.toLowerCase() === t.toLowerCase()) && !has(factText, t));
  if (imported && missing.length) {
    add({
      section: "Skills",
      status: "fix_first",
      observedSignal: `${skills.length} skills listed.`,
      issue: `You used ${missing.slice(0, 4).join(", ")} in your answers, but they aren't in your skills.`,
      whyForThisGoal: "Skills you've actually used are worth listing, near the top.",
      proposedChange: `Add: ${missing.slice(0, 4).join(", ")}`,
      evidenceRefs: ["Your export (Skills)", ...facts.filter((f) => missing.some((m) => has(f.text, m))).slice(0, 2).map((f) => `Your fact: "${clip(f.text, 60)}"`)],
      benchmarkRefs: bench,
      confidence: "medium",
      userAction: "Add them, and move your most relevant skills to the top.",
    });
  } else if (imported && skills.length > 30) {
    add({ section: "Skills", status: "consider", observedSignal: `${skills.length} skills listed.`, issue: "A long list hides the ones that matter.", whyForThisGoal: "Readers skim the top few.", evidenceRefs: ["Your export (Skills)"], benchmarkRefs: bench, confidence: "high", userAction: "Keep the ones you can back up with a project, and order them." });
  } else if (imported) {
    add({ section: "Skills", status: "strong", observedSignal: `${skills.length} skills listed.`, issue: "Covers what you've used.", whyForThisGoal: "Readers can match you to the role.", evidenceRefs: ["Your export (Skills)"], benchmarkRefs: bench, confidence: "medium", userAction: "Check each one is something you've used." });
  } else {
    add({
      section: "Skills",
      status: "cannot_assess",
      observedSignal: "Not imported.",
      issue: inFacts.length ? `Your answers mention ${inFacts.slice(0, 4).join(", ")}. Check they're in your skills.` : "Lynkr can't see your skills.",
      whyForThisGoal: "Skills you've used are worth listing near the top.",
      evidenceRefs: [],
      benchmarkRefs: bench,
      confidence: "low",
      userAction: "Compare your skills with the list above.",
    });
  }
  if (jdGaps.length) {
    add({
      section: "Skills",
      status: "consider",
      observedSignal: `The job description asks for ${jdGaps.slice(0, 5).join(", ")}.`,
      issue: "These aren't in your skills or your answers.",
      whyForThisGoal: "Treat them as things to learn. Don't list a skill until you've used it.",
      evidenceRefs: [jdSource],
      benchmarkRefs: ["Matched against this one posting. Compare with a second posting before changing much."],
      confidence: "medium",
      userAction: "If you have used one, add a project that shows it. If not, it's a learning goal, not a profile edit.",
    });
  }

  // The imported posting's experience ask, against the user's stage. Information about the job, never about the user.
  if (approved?.experienceLevel) {
    const years = Number(approved.experienceLevel.match(/\d+/)?.[0] ?? 0);
    const early = profile.stage === "final_year" || profile.stage === "recent_grad" || profile.stage === "early_career";
    if (early && years >= 3) {
      add({
        section: "Role fit",
        status: "consider",
        observedSignal: `The posting asks for ${approved.experienceLevel} of experience.`,
        issue: "That's more than most early-career profiles show.",
        whyForThisGoal: "Recruiters often filter on experience first. You can still apply, but entry-level postings may be a better use of your time.",
        evidenceRefs: [jdSource],
        benchmarkRefs: [],
        confidence: "medium",
        userAction: "Look for the same role marked entry level, analyst I, associate or graduate. Don't stretch your profile to match.",
      });
    }
  }

  // Education
  if (!imported) {
    add({ section: "Education", status: "cannot_assess", observedSignal: "Not imported.", issue: "Lynkr can't see it.", whyForThisGoal: "For students and recent graduates, degree and dates help readers place you.", evidenceRefs: [], confidence: "low", userAction: "Check your degree, college and dates are filled in. Grades are your choice." });
  } else if (imported.education.length === 0) {
    const student = profile.stage === "final_year" || profile.stage === "recent_grad";
    add({ section: "Education", status: student ? "fix_first" : "consider", observedSignal: "No education entries.", issue: "Readers can't see your degree.", whyForThisGoal: "For your stage, education is part of the first impression.", evidenceRefs: ["Your export (Education)"], confidence: "high", userAction: "Add your degree, college and dates." });
  } else {
    add({ section: "Education", status: "strong", observedSignal: `${imported.education.length} entr${imported.education.length === 1 ? "y" : "ies"}.`, issue: "Listed.", whyForThisGoal: "Readers can place you.", evidenceRefs: ["Your export (Education)"], confidence: "high", userAction: "Add one relevant course or project only if it helps for this role." });
  }

  // Optional sections and manual checks: Lynkr can't see these, and never judges appearance.
  const certs = imported?.certifications ?? [];
  add({
    section: "Certifications and courses",
    status: certs.length ? "strong" : "consider",
    observedSignal: imported ? `${certs.length} listed.` : "Not imported.",
    issue: certs.length ? "Listed." : "Optional.",
    whyForThisGoal: "Useful only when relevant and current. Never pay for a course just to fill this section.",
    evidenceRefs: imported ? ["Your export (Certifications)"] : [],
    confidence: imported ? "high" : "low",
    userAction: "Check names, issuer and dates are right. Remove expired or unrelated ones if they distract.",
  });
  add({
    section: "Recommendations",
    status: "consider",
    observedSignal: "Lynkr can't see these.",
    issue: "Optional.",
    whyForThisGoal: "One from someone who saw your work can back up a project.",
    proposedChange: "Hi [[their first name]], could you write a short recommendation about [[the project you worked on together]]? Only if you're comfortable. No worries if not.",
    evidenceRefs: [],
    confidence: "low",
    userAction: "Ask only someone who actually worked with you, about a specific piece of work.",
  });
  add({
    section: "Profile photo",
    status: "cannot_assess",
    observedSignal: "Lynkr doesn't look at photos.",
    issue: "Check it yourself, only on technical points.",
    whyForThisGoal: "It's shown very small next to everything you post and send.",
    evidenceRefs: [],
    confidence: "low",
    userAction: "Is your face clearly visible at thumbnail size, is it sharp and well lit, and is the crop close? That's all. There's no right look, and nothing about your appearance needs to change.",
  });
  add({
    section: "Background image",
    status: "consider",
    observedSignal: "Lynkr can't see it.",
    issue: "Optional.",
    whyForThisGoal: "A simple, uncluttered image is fine. No image is fine too.",
    evidenceRefs: [],
    confidence: "low",
    userAction: "If you add one, use something you own or are allowed to use.",
  });
  const loc = imported?.location ?? "";
  add({
    section: "Location, URL and visibility",
    status: profile.market && loc && !loc.toLowerCase().includes(profile.market.toLowerCase().split(/[ ,]/)[0]) ? "consider" : "cannot_assess",
    observedSignal: loc ? `Location: ${loc}` : "Lynkr can't see these settings.",
    issue: profile.market && loc ? `You said you're targeting ${profile.market}.` : "Check these in LinkedIn yourself.",
    whyForThisGoal: "Location affects which local searches find you. Public visibility is your choice.",
    evidenceRefs: loc ? ["Your export (Profile)"] : [],
    confidence: "low",
    userAction: "Check your location, set a clean custom URL, and view your public profile to see what strangers see. LinkedIn controls these settings and their names can change.",
  });
  add({
    section: "Open to Work",
    status: "cannot_assess",
    observedSignal: "Lynkr can't see this setting.",
    issue: "Your choice.",
    whyForThisGoal: "Titles, locations and start date should match what you're applying for.",
    evidenceRefs: [],
    confidence: "low",
    userAction: "If you turn it on, match the titles and locations to your target. \"Recruiters only\" isn't fully private. Never put salary or notice period in your profile text.",
  });
  add({
    section: "Contact info",
    status: "consider",
    observedSignal: "Lynkr can't see this.",
    issue: "Optional.",
    whyForThisGoal: "A recruiter needs one way to reach you, if you want them to.",
    evidenceRefs: [],
    confidence: "low",
    userAction: "Share a professional email if you want to. Don't make your phone number or address public.",
  });
  add({
    section: "Recent activity",
    status: "consider",
    observedSignal: "Optional.",
    issue: "Not required.",
    whyForThisGoal: "A post about real work is extra proof. Likes and follower counts don't measure profile quality.",
    evidenceRefs: [],
    confidence: "low",
    userAction: "Use a post from the Posts tab if you want to. There's no required schedule.",
  });

  return out;
}

/** Up to three "Fix first" findings, ordered by what matters most for the user's readers. */
export function topFixes(findings: ProfileFinding[], profile: ProfileInput): ProfileFinding[] {
  const order = profile.audiences.includes("practitioners") && !profile.audiences.includes("hiring") ? ORDER_PRACTICE : ORDER_HIRING;
  const rank = (s: string) => {
    const i = order.indexOf(s);
    return i === -1 ? 99 : i;
  };
  return findings.filter((f) => f.status === "fix_first").sort((a, b) => rank(a.section) - rank(b.section)).slice(0, 3);
}
