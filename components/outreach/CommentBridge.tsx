"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui";

type Suggestion = { id: string; authorName: string | null; authorHeadline: string | null; createdAt: string };
const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/**
 * Comment to message (Commenter plan R17). If you posted a comment on a post by someone with this person's name, Lynkr asks
 * whether it is the same person. Only your Link answer connects them. A linked comment can give the first message one line:
 * the date and your own comment.
 */
export function CommentBridge({ contactId, name, lapsed }: { contactId: string; name: string; lapsed: boolean }) {
  const [linked, setLinked] = useState<{ id: string; createdAt: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const l = await fetch(`/api/comments/link?contactId=${encodeURIComponent(contactId)}`, { cache: "no-store" });
        const lj = l.ok ? ((await l.json()) as { linked: { id: string; createdAt: string } | null }) : { linked: null };
        if (!live) return;
        setLinked(lj.linked);
        if (lj.linked) return;
        const s = await fetch(`/api/comments/link?name=${encodeURIComponent(name)}`, { cache: "no-store" });
        if (s.ok && live) setSuggestions(((await s.json()) as { suggestions: Suggestion[] }).suggestions);
      } catch { /* nothing to show */ }
    })();
    return () => { live = false; };
  }, [contactId, name]);

  async function link(id: string | null, entry?: Suggestion) {
    setError(null);
    const r = await fetch("/api/comments/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id ?? linked?.id, contactId: id ? contactId : null }) });
    if (!r.ok) { setError(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't do that."); return; }
    if (id && entry) { setLinked({ id, createdAt: entry.createdAt }); setSuggestions([]); } else setLinked(null);
  }

  if (!linked && suggestions.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-line p-3 text-[0.92rem]" data-comment-bridge>
      {linked ? (
        <p className="flex flex-wrap items-center gap-3">
          <span>You commented on their post on {day(linked.createdAt)}.</span>
          {!lapsed && <button className="text-[0.85rem] text-faint underline" onClick={() => link(null)}>Unlink</button>}
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3">
              <span>Is this the {s.authorName} you commented on{s.authorHeadline ? ` (${s.authorHeadline})` : ""}, on {day(s.createdAt)}?</span>
              {!lapsed && <Button variant="quiet" onClick={() => link(s.id, s)}>Link</Button>}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-bad" role="alert">{error}</p>}
    </div>
  );
}
