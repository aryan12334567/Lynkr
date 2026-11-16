export type PostsVersion = "v1" | "v2";

/**
 * LYNKR_POSTS=v1|v2 (posts plan KTD11). v2 is the per-post flow: slots, an interview, complete versions and an editor.
 * An unset switch follows the preview: v2 on a preview, v1 everywhere else.
 */
export function postsVersion(): PostsVersion {
  const v = process.env.LYNKR_POSTS?.trim();
  return v === "v1" || v === "v2" ? v : process.env.VERCEL_ENV === "preview" ? "v2" : "v1";
}

/**
 * LYNKR_AUTOPUBLISH=on: the server may publish an approved post to the person's own LinkedIn profile at its time.
 * Exactly "on" turns it on; anything else, or unset, is off everywhere. Off means nothing is ever sent to LinkedIn.
 */
export function autopublishOn(): boolean {
  return process.env.LYNKR_AUTOPUBLISH?.trim() === "on";
}
