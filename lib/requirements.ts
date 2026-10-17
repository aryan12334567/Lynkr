/**
 * Approved job-page requirements, in the forms the rest of Lynkr uses. Safe for the browser:
 * no HTML parsing here, only the reviewed packet.
 */
import type { ExternalContextPacket } from "./schemas";

/** The approved packet as delimited text for the AI. Never includes the page itself. */
export function packetForPrompt(p: ExternalContextPacket): string {
  const lines = [
    `Role: ${p.title}${p.company ? ` at ${p.company}` : ""}`,
    p.location ? `Location: ${p.location}` : "",
    p.workMode !== "unknown" ? `Work mode: ${p.workMode.replace("_", "-")}` : "",
    p.experienceLevel ? `Experience asked for: ${p.experienceLevel}` : "",
    p.education ? `Education asked for: ${p.education}` : "",
    p.responsibilities.length ? `Responsibilities:\n${p.responsibilities.map((r) => `- ${r}`).join("\n")}` : "",
    p.requiredSkills.length ? `Required:\n${p.requiredSkills.map((r) => `- ${r}`).join("\n")}` : "",
    p.preferredSkills.length ? `Nice to have:\n${p.preferredSkills.map((r) => `- ${r}`).join("\n")}` : "",
  ];
  return lines.filter(Boolean).join("\n").slice(0, 6000);
}

/** All requirement text, for the deterministic profile checks. */
export function packetText(p: ExternalContextPacket): string {
  return [p.title, p.experienceLevel, p.education, ...p.responsibilities, ...p.requiredSkills, ...p.preferredSkills].join("\n");
}
