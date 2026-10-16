import type { GenerateReply, InterviewReply, ProfileInput, Turn, VaultItem } from "./schemas";

/**
 * Mock engine: runs the full flow with no API key. It only rearranges what the
 * person typed and leaves blanks for everything else, so it never invents facts.
 */
const QUESTIONS: { q: string; why: string }[] = [
  {
    q: "What is one thing you built, wrote or organised that you are proud of? Describe exactly what you did.",
    why: "Recruiters remember things you did, not adjectives.",
  },
  {
    q: "What number goes with it? Users, hours saved, marks, rupees, people reached, anything countable.",
    why: "A single real number makes a post feel true.",
  },
  {
    q: "Which part of the target role does that work prove you can do?",
    why: "This links your proof to the job you want.",
  },
  {
    q: "Tell me about one time something went wrong. What did you change afterwards?",
    why: "Specific setbacks read as honest, not performed.",
  },
  {
    q: "What is hard or unusual about your background, such as college tier, no internship or a switch of field?",
    why: "We write around it instead of hiding it.",
  },
  {
    q: "Name two or three companies or kinds of people you most want to reach.",
    why: "So the outreach message can be aimed, not generic.",
  },
];

export function mockInterview(turns: Turn[]): InterviewReply {
  if (turns.length >= QUESTIONS.length) return { done: true, question: "", why: "" };
  const n = QUESTIONS[turns.length];
  return { done: false, question: n.q, why: n.why };
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

function kindOf(a: string, i: number): VaultItem["kind"] {
  if (/\d/.test(a) && i === 1) return "number";
  if (i === 0 || i === 2) return "proof";
  if (i === 3) return "story";
  if (i === 4) return "constraint";
  if (i === 5) return "target";
  return /\d/.test(a) ? "number" : "skill";
}

export function mockGenerate(profile: ProfileInput, turns: Turn[]): GenerateReply {
  const ans = turns.map((t) => t.a);
  const a = (i: number, fallback: string) => (ans[i] && ans[i] !== "(skipped)" ? ans[i] : fallback);
  const role = profile.targetRole;
  const built = a(0, "[[what you built or did]]");
  const num = a(1, "[[the number that goes with it]]");
  const proves = a(2, "[[which part of the job it proves]]");
  const wrong = a(3, "[[something that went wrong and what you changed]]");
  const hard = a(4, profile.background);
  const targets = a(5, "[[2-3 companies you want to reach]]");

  // Label by the question's original position, so a skipped question doesn't shift the labels.
  const vault: VaultItem[] = turns
    .map((t, i) => ({ a: t.a, i }))
    .filter((t) => t.a !== "(skipped)")
    .map((t) => ({ kind: kindOf(t.a, t.i), text: clip(t.a, 160) }));

  return {
    vault,
    profile: {
      headlines: [
        `${role} aspirant | ${clip(profile.background, 40)} | [[one proof point with a number]]`,
        `Building towards ${role} | [[your strongest project in 6 words]]`,
        `${role} | ${clip(built, 50)}`,
      ],
      about: `I am looking for ${role} roles. ${clip(built, 220)} ${clip(num, 160)} I want to work on [[the kind of problems you want]] and I am based in [[city]]. You can reach me at [[email or best way to contact you]].`,
      gaps: [
        "Add one project or piece of work to your Featured section with a link.",
        "Put the exact role you want in your headline so recruiter search can find you.",
        "Replace a generic About with one concrete result and how to contact you.",
      ],
    },
    outreach: {
      referral: {
        title: "Referral request",
        why: "Short, specific, easy to say no to.",
        body: `Hi [[their first name]], I am applying for [[role title]] at [[company]] ([[job ID or link]]). ${clip(built, 140)} ${clip(proves, 120)} My resume is attached. Would you be comfortable referring me? If it is not a fit, no worries at all.`,
      },
      hiring_manager: {
        title: "Message to a hiring manager",
        why: "One specific thing about their team, one proof, one small ask.",
        body: `Hi [[their first name]], I saw [[something specific about their team]]. ${clip(built, 120)} Could I send you a two-line summary of it? No worries if not.`,
      },
      follow_up: {
        title: "Follow-up in 5 to 7 days",
        why: "Adds something new instead of just following up.",
        body: `Hi [[their first name]], since I wrote, [[one new thing you did or learned]]. Would it help if I shared it? No worries if now is not a good time.`,
      },
    },
    posts: [
      {
        title: "Proof of work",
        why: "Starts with the thing you did and a real number.",
        body: `I recently ${clip(built, 200)}\n\nThe number that matters: ${clip(num, 150)}\n\nWhat it showed me about ${role}: ${clip(proves, 160)}\n\nNext I want to [[what you will do next]].`,
      },
      {
        title: "A setback and the change",
        why: "A specific mistake reads as honest, not performed.",
        body: `${clip(wrong, 260)}\n\nWhat I changed: [[the one change you made]]\n\nWhat I would tell someone starting out: [[one plain sentence]]`,
      },
      {
        title: "An observation from the field",
        why: "Anchors an opinion in your own experience.",
        body: `Something I noticed while trying to get into ${role}: [[what you noticed]].\n\nIt connects to my own experience: ${clip(hard, 200)}\n\nI am looking to speak with people at ${clip(targets, 120)} about [[the specific question]].`,
      },
    ],
    comments: [
      {
        title: "Comment on a post in your field",
        why: "Adds one concrete experience.",
        body: `The point about [[what the post said]] matches what I saw when ${clip(built, 120)} [[one specific detail]].`,
      },
      {
        title: "Comment that asks a real question",
        why: "A specific question starts a conversation.",
        body: `When you said [[what the post said]], how did you [[specific thing you want to know]]? I ran into [[your specific problem]].`,
      },
    ],
  };
}
