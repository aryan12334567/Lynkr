export type CommenterSwitch = "on" | "off";

/**
 * LYNKR_COMMENTER=on|off (Commenter plan KTD7). On: the extension's Comment choice works. Off: the extension shows
 * Message only and the comment route answers 404, so a production build that has not been released changes nothing.
 * An unset switch follows the preview: on for a preview, off everywhere else.
 */
export function commenterSwitch(): CommenterSwitch {
  const v = process.env.LYNKR_COMMENTER?.trim().toLowerCase();
  return v === "on" || v === "off" ? v : process.env.VERCEL_ENV === "preview" ? "on" : "off";
}
