import type { Want, Intent } from "../schemas";
import type { Relationship } from "../checker";

export const GOAL_IDS = ["job", "referral", "network", "mentor", "clients", "hiring", "funding", "buy_business", "partner", "reconnect"] as const;
export type OutreachGoal = (typeof GOAL_IDS)[number];
export type GoalDetail = { key: string; question: string; options: readonly string[] };
export type GoalDefinition = { id: OutreachGoal; label: string; description: string; wants: readonly Want[]; details: readonly GoalDetail[]; targets: readonly string[]; signals: readonly string[]; success: string };
const detail = (key: string, question: string, ...options: string[]): GoalDetail => ({ key, question, options });
export const GOALS: readonly GoalDefinition[] = [
 { id:"job",label:"Find a job",description:"Learn about roles and teams that fit your work.", wants:["job","internship"],details:[detail("role","What role are you looking for?","Full time","Internship"),detail("location","Where would you like to work?","Remote","Hybrid","On site")],targets:["People in your target role","Team leads"],signals:["Open roles"],success:"Useful role information" },
 { id:"referral",label:"Get a referral",description:"Ask someone who knows your work about a specific role.",wants:["referral"],details:[detail("job","Which role are you considering?","Open role"),detail("fit","What makes it a fit?","Relevant work")],targets:["People who know your work"],signals:["Open roles"],success:"Referral offered" },
 { id:"network",label:"Learn and network",description:"Meet people and exchange ideas about your field.",wants:["network"],details:[detail("topic","What would you like to learn about?","Their work","Their field")],targets:["Peers","Practitioners"],signals:["Public work"],success:"Useful conversation" },
 { id:"mentor",label:"Find a mentor",description:"Meet people whose experience you can learn from.",wants:["mentor"],details:[detail("topic","What would you like guidance on?","Career","Skills")],targets:["Experienced practitioners"],signals:["Public work"],success:"Guidance received" },
 { id:"clients",label:"Win clients or close a deal",description:"Find people who could benefit from your work.",wants:["clients"],details:[detail("offer","What do you offer?","Service","Product"),detail("buyer","Who is it for?","Teams","Businesses")],targets:["Potential buyers"],signals:["Company changes"],success:"Conversation with a buyer" },
 { id:"hiring",label:"Hire someone",description:"Meet potential candidates for your team.",wants:[],details:[detail("role","What role are you hiring for?","Full time","Contract")],targets:["Potential candidates"],signals:["Relevant experience"],success:"Candidate conversation" },
 { id:"funding",label:"Raise funding",description:"Start conversations with potential investors.",wants:[],details:[detail("stage","What stage are you at?","Early","Growing"),detail("traction","What progress can you share?","Customers","Revenue")],targets:["Investors"],signals:["Investment focus"],success:"Investor conversation" },
 { id:"buy_business",label:"Buy a business",description:"Start a discreet conversation with a business owner.",wants:[],details:[detail("kind","What kind of business?","Software","Services","Other"),detail("size","What size range?","Small","Medium"),detail("why","Why are you interested?","Operate","Grow")],targets:["Business owners"],signals:["Company news"],success:"Owner conversation" },
 { id:"partner",label:"Find a partner",description:"Explore a possible collaboration.",wants:[],details:[detail("kind","What kind of partnership?","Distribution","Product","Community")],targets:["Potential partners"],signals:["Shared work"],success:"Partnership conversation" },
 { id:"reconnect",label:"Reconnect",description:"Get back in touch with people you already know.",wants:[],details:[detail("reason","What would you like to reconnect about?","Catch up","Work")],targets:["People you know"],signals:["Shared history"],success:"Reply received" },
];
export function goalFor(id: OutreachGoal): GoalDefinition { return GOALS.find(g => g.id === id)!; }
export function preselectGoals(wants: readonly Want[]): OutreachGoal[] { return GOALS.filter(g => g.wants.some(w => wants.includes(w))).map(g => g.id); }
export function defaultIntent(goal: OutreachGoal, relationship: Relationship): Intent { if (goal === "referral" && relationship === "knows_me") return "referral"; if (goal === "job") return "learn_role"; return "work_question"; }
