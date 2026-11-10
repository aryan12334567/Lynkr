export type OutreachVersion = "v1" | "v2";
export function outreachVersion(): OutreachVersion {
  const v = process.env.LYNKR_OUTREACH?.trim();
  return v === "v1" || v === "v2" ? v : process.env.VERCEL_ENV === "preview" ? "v2" : "v1";
}
