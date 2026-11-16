/** Shapes and the one fetch helper the Posts screens share. They follow the Posts routes in app/api/posts. */

export type PostType = "proof" | "setback" | "observation";
export type PostStatus = "draft" | "approved" | "scheduled" | "publishing" | "published" | "failed" | "cancelled" | "unknown";

export type Post = {
  id: string;
  type: PostType;
  brief: string;
  mode: "quick" | "thorough";
  status: PostStatus;
  weekStart: string | null;
  slotIndex: number | null;
  scheduledAt: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  publishMode?: "manual" | "auto" | null;
  publishedAt?: string | null;
  linkedinUrn?: string | null;
  failReason?: string | null;
};
export type Version = { id: string; n: number; batch: number; body: string; why: string; source: "write" | "refine" | "manual"; instruction: string | null; createdAt: string };
export type Answer = { turn: number; key: string; question: string; answer: string };
export type Question = { key: string; text: string; example: string };
export type Step =
  | { kind: "question"; question: Question & { index: number; cap: number } }
  | { kind: "done"; reason: "enough" | "cap" | "thin" | "write_now"; note: string };
export type Slot = { index: number; type: PostType; day: string; time: string; brief: string; post: Post | null };
export type Problem = { code: string; message: string };
export type LinkedIn = { autopublish: boolean; connected: boolean; canPublish: boolean; expiresAt: string | null };

export type Res<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** One request. A thrown error and a non-OK answer both come back as `{ ok: false }` with words the person can read. */
export async function call<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<Res<T>> {
  try {
    const r = await fetch(url, {
      method,
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    const j = (await r.json().catch(() => null)) as { error?: unknown } | null;
    if (!r.ok) {
      const error = typeof j?.error === "string" && j.error ? j.error : r.status === 401 ? "Please sign in first." : "Something went wrong. Please try again.";
      return { ok: false, status: r.status, error };
    }
    return { ok: true, data: j as T };
  } catch {
    return { ok: false, status: 0, error: "Could not reach Lynkr. Check your connection and try again." };
  }
}
