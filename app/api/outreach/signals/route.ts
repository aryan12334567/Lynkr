import { z } from "zod";
import { requireLicense } from "@/lib/billing";
import { readJson } from "@/lib/http";
import { checkNewsFeed, NEWS_FEED_URLS } from "@/lib/sourcePolicy";
import { companySignals, fetchNewsFeed, type FeedItem } from "@/lib/outreach/finder";

export const maxDuration = 30;

const Body = z.object({
  companies: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  /** Reviewed news feeds to read. Defaults to all of them. */
  feeds: z.array(z.string().max(500)).max(NEWS_FEED_URLS.length).optional(),
  /** Roles from job pages the user already imported (the browser holds them). */
  roles: z.array(z.object({
    company: z.string().max(120),
    title: z.string().max(160),
    sourceUrl: z.string().max(500),
    fetchedAt: z.string().max(40),
  }).strict()).max(40).default([]),
}).strict();

/**
 * Company signals for the Finder: open roles from the user's job imports plus news headlines that name a target
 * company. Company level only. Every feed address is checked against the allowlist before any request is made,
 * so one bad address means no fetches at all. The server never requests linkedin.com.
 */
export async function POST(req: Request) {
  // Paid access: a no-op unless LYNKR_PAYWALL=1.
  const locked = await requireLicense(req);
  if (locked) return locked;
  const read = await readJson(req, 16 * 1024);
  if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Add at least one company, up to 20." }, { status: 400 });
  const { companies, roles } = parsed.data;
  const feeds = [...new Set(parsed.data.feeds ?? NEWS_FEED_URLS)];
  for (const feed of feeds) {
    const policy = checkNewsFeed(feed);
    if (!policy.ok) return Response.json({ error: policy.reason }, { status: 400 });
  }
  const settled = await Promise.allSettled(feeds.map((feed) => fetchNewsFeed(feed)));
  const news: { source: string; items: FeedItem[] }[] = [];
  const feedErrors: { feed: string; error: string }[] = [];
  settled.forEach((result, i) => {
    const policy = checkNewsFeed(feeds[i]);
    if (result.status === "fulfilled" && policy.ok) news.push({ source: policy.source.label, items: result.value });
    else feedErrors.push({ feed: feeds[i], error: result.status === "rejected" && result.reason instanceof Error ? result.reason.message : "That news source isn't available right now. Try again later." });
  });
  return Response.json({ signals: companySignals({ companies, roles, news }), feedErrors });
}
