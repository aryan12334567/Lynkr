/**
 * The interview switch (build plan Part 8). LYNKR_INTERVIEW=v1|v2 decides; when unset, Vercel
 * preview builds get the new interview and production and local runs keep the old one, so
 * production only changes when someone sets LYNKR_INTERVIEW=v2 there.
 */
export type InterviewVersion = "v1" | "v2";

export function interviewVersion(): InterviewVersion {
  const v = process.env.LYNKR_INTERVIEW?.trim();
  if (v === "v1" || v === "v2") return v;
  return process.env.VERCEL_ENV === "preview" ? "v2" : "v1";
}
