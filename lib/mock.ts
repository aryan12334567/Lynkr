import { OUTREACH_ONLY_KINDS, type CommentReply, type FactRef, type GenerateReply, type InterviewReply, type ProfileInput, type Turn, type VaultReply } from "./schemas";
import { AUDIENCE_LABEL } from "./roles";
import { whoLine } from "./packet";

/**
 * Demo engine: runs the whole flow with no API key. It only rearranges what the
 * person typed and leaves blanks for everything else, so it never invents facts.
 * Interview design: prod/lynkr-posts-comments-intelligence-execution-plan.md §3.1.
 */
export const SKIPPED = "(skipped)";

type Key = "project" | "contribution" | "challenge" | "evidence" | "evidence_more" | "learning" | "setback" | "observation" | "reach";

function questions(role: string): Record<Key, { q: string; why: string }> {
  return {
    project: {
      q: `Choose one project or task related to ${role} work. What was it, and what did you personally do?`,
      why: "One real example is enough. Everything else builds on it.",
    },
    contribution: { q: "Which part did you handle yourself?", why: "So the drafts say what you did, not what the team did." },
    challenge: { q: "What was difficult or uncertain about it? What choice did you make?", why: "A real decision shows how you think." },
    evidence: {
      q: "What changed because of your work? If you didn't measure a result, what proof or artifact can you point to? \"Not measured\" is a fine answer.",
      why: "Proof can be a number, a link, a report or a demo. Never made up.",
    },
    evidence_more: { q: "What changed, or what artifact could someone inspect?", why: "One concrete detail makes the post believable." },
    learning: { q: `What did you learn, notice or question? Why might someone in ${role} care?`, why: "This is the useful point of a post." },
    setback: { q: "Optional: what went wrong at some point, and what did you change afterwards?", why: "Skip it if nothing comes to mind. We won't invent one." },
    observation: { q: "Optional: what have you personally noticed about this field? Where did you see it?", why: "Only something you saw yourself. Skip if you have nothing first-hand." },
    reach: { q: "Who do you most want to reach? Kinds of people or companies. No names needed.", why: "So outreach and search suggestions fit your goal." },
  };
}

const ORDER: Key[] = ["project", "challenge", "evidence", "learning", "setback", "observation", "reach"];
const MAX_FOLLOW_UPS = 2;

/** Which demo question each turn answered (by exact question text). Unknown questions return null. */
export function turnKeys(profile: ProfileInput, turns: Turn[]): (Key | null)[] {
  const qs = questions(profile.targetRole);
  const byText = new Map(Object.entries(qs).map(([k, v]) => [v.q, k as Key]));
  return turns.map((t) => byText.get(t.q) ?? null);
}

const answered = (a: string | undefined) => !!a && a !== SKIPPED;
const needsContribution = (a: string) => /\b(we|our|team)\b/i.test(a) && !/\bI\b|\bmy\b|\bmyself\b/.test(a);
const needsEvidence = (a: string) => !/\d/.test(a) && !/not measured|didn'?t measure|no (result|number)|link|github|report|demo|dashboard|deck|repo|screenshot|video|published|deployed|live/i.test(a);

export function mockInterview(profile: ProfileInput, turns: Turn[]): InterviewReply {
  const qs = questions(profile.targetRole);
  const keys = turnKeys(profile, turns);
  const answerOf = (k: Key) => turns[keys.indexOf(k)]?.a;
  const asked = (k: Key) => keys.includes(k);
  const followUps = keys.filter((k) => k === "contribution" || k === "evidence_more").length;
  const ask = (k: Key): InterviewReply => ({ done: false, question: qs[k].q, why: qs[k].why });

  for (const k of ORDER) {
    if (!asked(k)) return ask(k);
    const a = answerOf(k);
    if (k === "project" && answered(a) && !asked("contribution") && followUps < MAX_FOLLOW_UPS && needsContribution(a!)) return ask("contribution");
    if (k === "evidence" && answered(a) && !asked("evidence_more") && followUps < MAX_FOLLOW_UPS && needsEvidence(a!)) return ask("evidence_more");
  }
  return { done: true, question: "", why: "" };
}

/** Shorten at a word boundary so a clipped fact never ends mid-word. */
function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const space = cut.lastIndexOf(" ");
  return (space > n * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "") + "…";
}

const KIND_OF: Record<Key, VaultReply["facts"][number]["kind"]> = {
  project: "project",
  contribution: "contribution",
  challenge: "challenge",
  evidence: "evidence",
  evidence_more: "evidence",
  learning: "learning",
  setback: "challenge",
  observation: "opinion",
  reach: "target",
};

/** Candidate facts: one per answer, in the person's own words, each pointing at its answer. */
export function mockVault(profile: ProfileInput, turns: Turn[]): VaultReply {
  const keys = turnKeys(profile, turns);
  const facts: VaultReply["facts"] = [];
  turns.forEach((t, i) => {
    if (!answered(t.a)) return;
    const k = keys[i];
    const kind = k ? KIND_OF[k] : /\d/.test(t.a) ? "evidence" : "project";
    facts.push({ kind, text: clip(t.a, 220), sourceTurnIds: [i + 1] });
  });
  facts.push({ kind: "constraint", text: clip(profile.background, 220), sourceTurnIds: [] });
  return { facts };
}

/** Lower-case the first letter so a fact reads mid-sentence, unless it starts with "I" or an acronym. */
function mid(s: string): string {
  const t = s.trim().replace(/[.\s]+$/, "");
  if (/^(I\b|[A-Z]{2,})/.test(t)) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/**
 * The current role as a short headline phrase, from the brief's "where you are now" line
 * ("5 to 8 years, Senior Product Designer at Paylane, a fintech app…" → "Senior Product Designer at Paylane").
 */
export function currentRolePhrase(profile: ProfileInput): string {
  const now = profile.background.split(/\.\s+People come to me for:/)[0] ?? "";
  const parts = now
    .split(/[,.;]\s+/)
    .map((s) => s.trim().replace(/[.\s]+$/, ""))
    .filter((s) => s && !/^(\d+|less than|under|over|more than)\b.*\b(years?|months?)$/i.test(s) && s !== "Not given yet");
  const first = parts[0] ?? "";
  return first && first.length <= 60 ? first : "";
}

/** A fact as a whole headline phrase: its first sentence or clause if it fits, never cut mid-sentence. */
export function headlinePhrase(f: FactRef | null, max: number): string | null {
  if (!f) return null;
  const sentence = (f.text.split(/(?<=[.!?])\s/)[0] ?? f.text).trim().replace(/[.\s]+$/, "");
  if (sentence.length <= max) return sentence;
  const clause = sentence.split(/,\s+|\s+(?:so|and|because|which)\s+/)[0]?.trim() ?? "";
  return clause.split(/\s+/).length >= 3 && clause.length <= max ? clause : null;
}

export function mockGenerate(profile: ProfileInput, facts: FactRef[]): GenerateReply {
  const role = profile.targetRole;
  // A private search (interview v2, past the fresher bucket) keeps the target role out of everything public:
  // headlines, About and posts describe the current role instead. Outreach drafts are private and may name it.
  const hideTarget = profile.privateSearch && profile.bucket !== "fresher";
  const nowRole = currentRolePhrase(profile);
  const publicRole = hideTarget ? nowRole || "[[your current role]]" : role;
  // Outreach-only facts (targets, goals, warm paths, must-haves) never reach a public draft.
  const publicFacts = facts.filter((f) => !OUTREACH_ONLY_KINDS.includes(f.kind));
  const of = (k: FactRef["kind"]) => publicFacts.find((f) => f.kind === k) ?? null;
  const project = of("project");
  const contribution = of("contribution");
  const evidence = of("evidence");
  const challenge = of("challenge");
  const learning = of("learning");
  const opinion = of("opinion");
  const constraint = of("constraint");
  const refs = (...fs: (FactRef | null)[]) => fs.filter((f): f is FactRef => !!f).map((f) => f.id);
  const t = (f: FactRef | null, blank: string, n = 200) => (f ? clip(f.text, n).replace(/[.\s]+$/, "") : `[[${blank}]]`);
  const readers = profile.audiences.filter((a) => a !== "not_sure").map((a) => AUDIENCE_LABEL[a].toLowerCase());
  const forReaders = readers.length ? `Written for ${readers.join(" and ")}.` : `Written for people working in or hiring for ${hideTarget ? "your field" : role}.`;
  const who = whoLine(profile);

  return {
    profile: {
      headlines: [
        // Whole phrases only: a headline never ends in a cut-off sentence.
        [publicRole, headlinePhrase(evidence, 50) ?? headlinePhrase(project, 60) ?? "[[your strongest project or result in a few words]]"].join(" | "),
        `${profile.specialization ? `${publicRole}, ${profile.specialization}` : publicRole} | ${headlinePhrase(contribution ?? project, 60) ?? "[[what you build or do]]"}`,
        hideTarget ? `${publicRole} | [[the kind of problems you solve]]` : `Working towards ${role} | ${headlinePhrase(contribution ?? project, 60) ?? "[[what you build or do]]"}`,
      ],
      about: [
        hideTarget ? `Right now: ${publicRole}.` : `I'm working towards ${role} roles${profile.market ? ` in ${profile.market}` : ""}.`,
        project ? `Recently: ${mid(t(project, "", 200))}.` : "Recently: [[one project or task you're proud of]].",
        contribution ? `My part: ${mid(t(contribution, "", 160))}.` : "",
        evidence ? `What changed: ${mid(t(evidence, "", 160))}.` : "What changed: [[a result, or something people can look at]].",
        learning ? `What I took from it: ${mid(t(learning, "", 160))}.` : "",
        `I want to work on [[the kind of problems you want]]. You can reach me at [[the contact route you want to share]].`,
      ]
        .filter(Boolean)
        .join(" "),
    },
    outreach: {
      stranger: {
        title: "First message to a stranger",
        why: "One real question, no favour asked.",
        body: `Hi [[their first name]], I read [[one specific thing they posted or built]]. ${who} ${project ? `${clip(project.text, 110).replace(/[.\s]+$/, "")}.` : ""} One question: [[your one specific question about their work]]? No worries if you're busy.`.replace(/\s+/g, " "),
        factRefs: refs(project),
      },
      alumni: {
        title: "Message to someone from your college",
        why: "Shared college plus a small, clear ask.",
        body: `Hi [[their first name]], I'm a [[your year and course]] at [[your college]], where you studied too. ${who} ${project ? `${clip(project.text, 110).replace(/[.\s]+$/, "")}.` : ""} Would you be open to a 15-minute call next week about how you got into [[their team or role]]? No worries if it's not a good time.`.replace(/\s+/g, " "),
        factRefs: refs(project),
      },
      referral: {
        title: "Referral request",
        why: "Short, specific, easy to say no to.",
        body: `Hi [[their first name]], I'm applying for [[role title]] at [[company]] ([[job ID or link]]). ${t(project, "one thing you built or did", 140)}. ${evidence ? `${t(evidence, "", 120)}.` : ""} My resume is attached. Would you be comfortable referring me? If it's not a fit, no worries at all.`.replace(/\s+/g, " "),
        factRefs: refs(project, evidence),
      },
      hiring_manager: {
        title: "Message to a hiring manager",
        why: "One specific thing about their team, one proof, one small ask.",
        body: `Hi [[their first name]], I saw [[something specific about their team]]. ${t(project, "one thing you built or did", 120)}. Could I send you a two-line summary of it? No worries if not.`,
        factRefs: refs(project),
      },
      follow_up: {
        title: "Follow-up in 5 to 7 days",
        why: "Adds something new instead of just following up.",
        body: `Hi [[their first name]], since I wrote, [[one new thing you did or learned]]. Would it help if I shared it? No worries if now is not a good time.`,
        factRefs: [],
      },
    },
    posts: [
      {
        title: "Proof of work",
        why: `Starts with the work itself. ${forReaders}`,
        body: [
          project ? `${t(project, "")}.` : "[[the project or task, in one sentence]]",
          contribution ? `My part: ${mid(t(contribution, ""))}.` : "My part: [[what you did yourself]]",
          evidence ? `What changed: ${mid(t(evidence, ""))}.` : "What changed: [[a result, or the artifact someone can look at]]",
          learning ? `What I took from it: ${mid(t(learning, ""))}.` : `What I'd tell someone starting in ${hideTarget ? "[[your field]]" : role}: [[one plain sentence]]`,
        ].join("\n\n"),
        factRefs: refs(project, contribution, evidence, learning),
      },
      challenge
        ? {
            title: "A setback and the change",
            why: `A specific decision reads as honest, not performed. ${forReaders}`,
            body: `${t(challenge, "")}.\n\nWhat I changed: [[the one change you made]]\n\nWhat I'd do differently now: [[one plain sentence]]`,
            factRefs: refs(challenge),
          }
        : {
            title: "A setback and the change",
            why: "Your answers have no setback in them. Fill this only if you have a real one, or skip it.",
            body: "[[something that went wrong, in your words]]\n\nWhat I changed: [[the one change you made]]",
            factRefs: [],
          },
      opinion
        ? {
            title: "An observation from the field",
            why: `Anchored in something you saw yourself. ${forReaders}`,
            body: `Something I noticed ${hideTarget ? "in my work" : `while working towards ${role} roles`}: ${mid(t(opinion, ""))}.\n\nWhere I saw it: [[where you saw it]]\n\n${constraint ? `It connects to my own situation: ${mid(t(constraint, "", 160))}.` : ""}`.trim(),
            factRefs: refs(opinion, constraint),
          }
        : {
            title: "An observation from the field",
            why: "Your answers have no first-hand observation. Don't post this unless you have one.",
            body: `Something I noticed ${hideTarget ? "in my work" : `while working towards ${role} roles`}: [[what you saw yourself]]\n\nWhere I saw it: [[where]]`,
            factRefs: [],
          },
    ],
    comments: [
      {
        title: "Example: add one experience",
        why: "A pattern, not a ready comment. Use the comment helper above for a real post.",
        body: `The point about [[what the post said]] matches what I saw when ${project ? mid(clip(project.text, 120)).replace(/[.\s]+$/, "") : "[[what you did]]"}: [[one specific detail]].`,
        factRefs: refs(project),
      },
      {
        title: "Example: ask a real question",
        why: "A pattern, not a ready comment. Only ask if you really want the answer.",
        body: `When you said [[what the post said]], how did you [[specific thing you want to know]]? I ran into [[your specific problem]].`,
        factRefs: [],
      },
    ],
  };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Demo comment: honest about what it is. It does not interpret the post; it quotes the line
 * the user chose and uses their own words or the fact they picked.
 */
export function mockComment(excerpt: string, anchor: string, perspective: string, facts: FactRef[]): CommentReply {
  const own = perspective.trim() || facts[0]?.text.trim() || "";
  if (!own) {
    return { status: "skip", body: "", postAnchor: "", factRefs: [], whyItFits: "There's no point of your own to add yet. Write one thought, pick a fact, or skip this post." };
  }
  if (!anchor.trim() || !norm(excerpt).includes(norm(anchor))) {
    return { status: "skip", body: "", postAnchor: "", factRefs: [], whyItFits: "In demo mode, copy the exact line from the post you're responding to." };
  }
  const second = perspective.trim() && facts[0] ? ` ${clip(facts[0].text, 160).replace(/[.\s]+$/, "")}.` : "";
  const body = `On "${clip(anchor, 120)}": ${own.replace(/[.\s]+$/, "")}.${second}`;
  return {
    status: "draft",
    body,
    postAnchor: anchor.trim(),
    factRefs: facts.slice(0, 1).map((f) => f.id),
    whyItFits: `Demo template: it quotes the line you picked and uses your own words. Lynkr didn't interpret the post. ${wordCount(body)} words.`,
  };
}
