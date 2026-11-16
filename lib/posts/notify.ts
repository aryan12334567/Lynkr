import { takeDaily, type Db } from "../db";
import { sendEmail } from "../email";

/**
 * Notices about a post (posts plan U16, D-P10): one plain sentence, never the post's text. At most three a day per person
 * (takeDaily "post_notice"). A failed email never fails the run.
 */
export type SendNotice = (to: string, sentence: string) => Promise<void>;

export const NOTICE = {
  failed: "A post of yours was not published. Open Lynkr to see what to do next.",
  unknown: "We could not confirm your post. Check LinkedIn before trying again.",
  late: "A post of yours was not published because its time had passed by more than 6 hours.",
} as const;

export const defaultSend: SendNotice = (to, sentence) => sendEmail(to, "notice", sentence);

export async function notify(db: Db, userId: string, sentence: string, send: SendNotice = defaultSend): Promise<boolean> {
  try {
    const email = (await db.query<{ email: string | null }>(`select email from "user" where id = $1`, [userId])).rows[0]?.email;
    if (!email) return false;
    if (!(await takeDaily(db, userId, "post_notice", 3))) return false;
    await send(email, sentence);
    return true;
  } catch {
    return false;
  }
}
