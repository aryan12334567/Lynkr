// U6: Finder and company signals. Real functions and the real signals route; only the network is replaced,
// and every URL the code asks for is recorded so the tests can prove what is (and is not) requested.
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import {
  targetLinks, signalIsStale, buildTargetMap, rankByLamp, buildSearchLinks, secondDegreeLink, schoolLink, companyLink, titleLink,
  directoriesFor, parseFeed, fetchNewsFeed, matchNews, roleSignals, companySignals, FeedRejected,
  contactQuality, assignTiers, checkMonthlyCap, clampCap, MONTHLY_CAP_DEFAULT,
} from "../lib/outreach/finder";
import { checkNewsFeed, checkSource, NEWS_FEED_URLS, NEWS_FEEDS, ALLOWED_HOSTS } from "../lib/sourcePolicy";

register(
  "data:text/javascript," +
    encodeURIComponent(`
const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);
  const href = root + specifier.slice(2);
  try { return await next(href, context); } catch { return next(href + ".ts", context); }
}`),
);

const NOW = new Date("2026-11-01T06:00:00Z");
const rss = (items: { title: string; link: string; date: string }[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>${items
    .map((i) => `<item><title><![CDATA[${i.title}]]></title><link>${i.link}</link><pubDate>${i.date}</pubDate></item>`)
    .join("")}</channel></rss>`;
const FEED = rss([
  { title: "Acme Robotics raises $12 Mn in Series A", link: "https://inc42.com/buzz/acme", date: "Sun, 01 Nov 2026 04:00:00 +0000" },
  { title: "Globex hires a new CTO", link: "https://inc42.com/buzz/globex", date: "Mon, 31 Aug 2026 04:00:00 +0000" },
  { title: "Unrelated launch", link: "https://inc42.com/buzz/other", date: "Sun, 01 Nov 2026 03:00:00 +0000" },
  { title: "Bad link", link: "javascript:alert(1)", date: "Sun, 01 Nov 2026 03:00:00 +0000" },
]);

function recorder(body = FEED, status = 200) {
  const urls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(body, { status, headers: { "content-type": "application/rss+xml" } });
  }) as typeof fetch;
  return { urls, impl };
}

// ---- existing behavior ----
test("finder offers user-run searches suited to the goal", () => {
  const links = targetLinks("clients", "design", ["Acme"]);
  assert.match(links[0].label, /buyer/);
  assert.match(links[0].url, /linkedin\.com\/search/);
});
test("signals older than 60 days or invalid are stale", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  assert.equal(signalIsStale("2026-10-01", now), false);
  assert.equal(signalIsStale("2026-01-01", now), true);
  assert.equal(signalIsStale("invalid", now), true);
});

// ---- target map and goal-specific links ----
test("a clients goal with a field gives buyer links and no directories or recruiter searches", () => {
  const map = buildTargetMap({ goals: ["clients"], field: "fintech", subNiche: "payments", companies: ["Acme", "Globex"] });
  assert.equal(map.field, "fintech");
  assert.deepEqual(map.companies, ["Acme", "Globex"]);
  assert.ok(map.teams.length > 0 && map.titles.length > 0);
  const links = buildSearchLinks("clients", map);
  assert.ok(links.length >= 4);
  const text = links.map((l) => `${l.label} ${decodeURIComponent(l.url)}`).join(" ").toLowerCase();
  assert.doesNotMatch(text, /recruiter|talent acquisition|candidate/);
  assert.match(text, /founder|head of|vp|director/);
  assert.deepEqual(directoriesFor("clients"), []);
});

test("search link builders extend searchUrl for second degree, school, company and title", () => {
  const second = new URL(secondDegreeLink("product designer fintech"));
  assert.equal(second.hostname, "www.linkedin.com");
  assert.equal(second.searchParams.get("keywords"), "product designer fintech");
  assert.equal(second.searchParams.get("network"), '["S"]');
  const school = new URL(schoolLink("IIT Madras", "product designer"));
  assert.match(school.searchParams.get("keywords")!, /IIT Madras/);
  assert.match(school.searchParams.get("keywords")!, /product designer/);
  const company = new URL(companyLink("Acme", "design lead"));
  assert.match(company.searchParams.get("keywords")!, /Acme/);
  const title = new URL(titleLink("head of design", "fintech"));
  assert.equal(title.searchParams.get("keywords"), "head of design fintech");
  const all = buildSearchLinks("job", buildTargetMap({ goals: ["job"], field: "data analysis", companies: ["Acme"] }), "IIT Madras");
  assert.ok(all.some((l) => l.kind === "second_degree" && /network=/.test(l.url)));
  assert.ok(all.some((l) => l.kind === "school" && /IIT%20Madras/.test(l.url)));
  assert.ok(all.some((l) => l.kind === "company" && /Acme/.test(l.url)));
  assert.ok(all.some((l) => l.kind === "title"));
  assert.ok(all.every((l) => l.url.startsWith("https://www.linkedin.com/search/results/people/?keywords=")));
});

test("directories follow the goal", () => {
  const names = (g: Parameters<typeof directoriesFor>[0]) => directoriesFor(g).map((d) => d.label).join("|");
  assert.match(names("mentor"), /ADPList/);
  assert.match(names("mentor"), /Topmate/);
  for (const g of ["job", "hiring"] as const) {
    assert.match(names(g), /Hacker News/);
    assert.match(names(g), /Work at a Startup/);
  }
  assert.match(names("network"), /Hasgeek/);
  assert.match(names("network"), /Sessionize/);
  for (const g of ["mentor", "job", "hiring", "network"] as const) {
    for (const d of directoriesFor(g)) {
      assert.match(d.url, /^https:\/\//);
      assert.doesNotMatch(d.url, /linkedin\.com/);
    }
  }
});

// ---- LAMP ----
test("LAMP ranks by motivation, connections at the company, and postings", () => {
  const connections = [
    { name: "A", company: "Globex Corp", role: "Designer", profileUrl: "https://www.linkedin.com/in/a", connectedOn: "2025-01-01" },
    { name: "B", company: "Globex", role: "PM", profileUrl: "https://www.linkedin.com/in/b", connectedOn: "2025-01-01" },
  ];
  const signals = [{ kind: "news" as const, company: "Initech", text: "x", url: "https://inc42.com/a", date: "2026-11-01", stale: false, source: "Inc42" }];
  const rows = rankByLamp(["Acme", "Globex", "Initech"], { motivation: { Acme: 3 }, connections, signals });
  assert.equal(rows[0].company, "Acme"); // motivation wins
  const globex = rows.find((r) => r.company === "Globex")!;
  assert.equal(globex.alumni, 2);
  const initech = rows.find((r) => r.company === "Initech")!;
  assert.equal(initech.posting, 1);
  assert.ok(globex.score > initech.score || globex.score === initech.score);
  assert.ok(rows.every((r) => typeof r.reason === "string" && r.reason.length > 0));
  // stale signals do not count as a reason to write now
  const stale = rankByLamp(["Initech"], { signals: [{ ...signals[0], stale: true }] });
  assert.equal(stale[0].posting, 0);
});

// ---- news feed policy ----
test("news feed policy accepts the three reviewed feeds and rejects everything else before any fetch", () => {
  for (const u of NEWS_FEED_URLS) assert.equal(checkNewsFeed(u).ok, true, u);
  for (const f of NEWS_FEEDS) assert.ok(f.kind === "news_feed" && f.reviewedAt && f.owner && f.review);
  for (const u of [
    "https://www.linkedin.com/feed/", "https://evil.example/feed", "http://inc42.com/feed/", "https://inc42.com/wp-admin/",
    "https://inc42.com/feed/?x=1", "https://user:pw@inc42.com/feed/", "https://inc42.com:8443/feed/", "https://127.0.0.1/feed",
    "https://inc42.com.evil.example/feed/", "https://yourstory.com/rss", "not a url", "",
  ]) {
    assert.equal(checkNewsFeed(u).ok, false, u);
  }
  // Existing job-board policy is unchanged: feeds are not job postings, and the importer's host list did not grow.
  assert.equal(checkSource("https://inc42.com/feed/").ok, false);
  assert.ok(!ALLOWED_HOSTS.includes("inc42.com"));
});

test("fetchNewsFeed rejects an outside URL before any fetch and never touches LinkedIn", async () => {
  const r = recorder();
  for (const u of ["https://www.linkedin.com/feed/", "https://evil.example/rss", "http://inc42.com/feed/"]) {
    await assert.rejects(() => fetchNewsFeed(u, r.impl), FeedRejected);
  }
  assert.deepEqual(r.urls, []);
  const items = await fetchNewsFeed("https://inc42.com/feed/", r.impl);
  assert.deepEqual(r.urls, ["https://inc42.com/feed/"]);
  assert.equal(items.length, 3); // the javascript: link is dropped
  assert.ok(r.urls.every((u) => !/linkedin\.com/.test(u)));
});

test("fetchNewsFeed fails clearly on a bad answer and does not follow redirects", async () => {
  await assert.rejects(() => fetchNewsFeed("https://inc42.com/feed/", recorder("nope", 503).impl), /unavailable|try again/i);
  let init: RequestInit | undefined;
  const impl = (async (_u: RequestInfo | URL, i?: RequestInit) => { init = i; return new Response(FEED); }) as typeof fetch;
  await fetchNewsFeed("https://inc42.com/feed/", impl);
  assert.equal(init?.redirect, "error");
});

test("parseFeed reads RSS items and Atom entries", () => {
  assert.equal(parseFeed(FEED).length, 3);
  const atom = `<feed><entry><title>Acme news</title><link href="https://yourstory.com/a"/><updated>2026-11-01T01:00:00Z</updated></entry></feed>`;
  assert.deepEqual(parseFeed(atom), [{ title: "Acme news", link: "https://yourstory.com/a", date: "2026-11-01" }]);
});

// ---- signals ----
test("a news item naming a target company is a company signal dated today; items older than 60 days are stale", () => {
  const items = parseFeed(FEED);
  const signals = matchNews(items, ["Acme", "Globex", "Initech"], "Inc42", NOW);
  const acme = signals.find((s) => s.company === "Acme")!;
  assert.equal(acme.date, "2026-11-01");
  assert.equal(acme.stale, false);
  assert.equal(acme.kind, "news");
  const globex = signals.find((s) => s.company === "Globex")!;
  assert.equal(globex.stale, true);
  assert.equal(signals.find((s) => s.company === "Initech"), undefined);
  // company level only: no person fields on any signal
  for (const s of signals) assert.deepEqual(Object.keys(s).sort(), ["company", "date", "kind", "source", "stale", "text", "url"]);
});

test("company names match whole words only", () => {
  const items = [{ title: "Acmeville opens a plant", link: "https://inc42.com/x", date: "2026-11-01" }, { title: "Go Digit files IPO", link: "https://inc42.com/y", date: "2026-11-01" }];
  assert.equal(matchNews(items, ["Acme"], "Inc42", NOW).length, 0);
  assert.equal(matchNews(items, ["Go Digit"], "Inc42", NOW).length, 1);
  assert.equal(matchNews(items, ["", " "], "Inc42", NOW).length, 0);
});

test("open roles from the job import become company signals, and a LinkedIn posting is dropped", () => {
  const roles = roleSignals(
    [
      { company: "Acme", title: "Data Analyst", sourceUrl: "https://jobs.lever.co/acme/1a2b3c4d-1a2b-1a2b-1a2b-1a2b3c4d5e6f", fetchedAt: "2026-10-30T10:00:00Z" },
      { company: "Acme", title: "Old role", sourceUrl: "https://boards.greenhouse.io/acme/jobs/12345", fetchedAt: "2026-06-01T10:00:00Z" },
      { company: "Acme", title: "Sneaky", sourceUrl: "https://www.linkedin.com/jobs/view/1", fetchedAt: "2026-10-30T10:00:00Z" },
      { company: "Other", title: "Not a target", sourceUrl: "https://boards.greenhouse.io/other/jobs/12345", fetchedAt: "2026-10-30T10:00:00Z" },
    ],
    ["Acme"],
    NOW,
  );
  assert.equal(roles.length, 2);
  assert.ok(roles.every((r) => r.kind === "open_role" && r.company === "Acme" && !/linkedin/.test(r.url)));
  assert.equal(roles.find((r) => r.text.includes("Old role"))!.stale, true);
  assert.equal(roles.find((r) => r.text.includes("Data Analyst"))!.stale, false);
});

test("companySignals puts fresh signals first", () => {
  const all = companySignals({ companies: ["Acme", "Globex"], roles: [], news: [{ source: "Inc42", items: parseFeed(FEED) }], now: NOW });
  assert.equal(all[0].company, "Acme");
  assert.equal(all[all.length - 1].stale, true);
});

// ---- quality, tiers, monthly cap ----
test("contact quality explains fit, bridge, signal, reachability and what the user can give", () => {
  const strong = contactQuality({ fit: true, bridge: "Same school", signal: { date: "2026-11-01", text: "Acme raised a round", stale: false }, reachable: true, give: "A teardown of their onboarding" });
  const weak = contactQuality({ fit: false, bridge: "", signal: null, reachable: false, give: "" });
  assert.ok(strong.score >= 90 && strong.score <= 100);
  assert.equal(weak.score, 0);
  for (const k of ["fit", "bridge", "signal", "reachable", "give"] as const) assert.ok(strong.reasons[k].length > 0 && weak.reasons[k].length > 0, k);
  assert.match(strong.reasons.signal, /2026-11-01/);
  const staleSignal = contactQuality({ fit: true, bridge: "x", signal: { date: "2026-01-01", text: "old", stale: true }, reachable: true, give: "x" });
  assert.ok(staleSignal.score < strong.score);
  assert.match(staleSignal.reasons.signal, /old/i);
});

test("Tier 1 never exceeds the notes left", () => {
  const people = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, score: 100 - i }));
  for (const left of [0, 1, 3, 7, 12, -2]) {
    const tiers = assignTiers(people, left);
    const t1 = [...tiers.values()].filter((t) => t === "tier_1").length;
    assert.ok(t1 <= Math.max(0, left), `left ${left} gave ${t1}`);
    assert.equal(t1, Math.min(Math.max(0, left), 10));
    assert.equal(tiers.size, 10);
  }
  // the best scores take the Tier 1 places, and a low score never gets one
  const t = assignTiers([{ id: "low", score: 30 }, { id: "high", score: 95 }, { id: "mid", score: 70 }], 3);
  assert.equal(t.get("high"), "tier_1");
  assert.equal(t.get("mid"), "tier_1");
  assert.equal(t.get("low"), "tier_2");
});

test("the 16th new person this month asks to raise the cap or wait, and says so out loud", () => {
  assert.equal(MONTHLY_CAP_DEFAULT, 15);
  assert.deepEqual(checkMonthlyCap(14, 15), { ok: true, remaining: 1 });
  const blocked = checkMonthlyCap(15, 15);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.match(blocked.message, /15/);
    assert.match(blocked.message, /Settings/);
    assert.match(blocked.message, /wait/i);
  }
  const top = checkMonthlyCap(30, 30);
  assert.equal(top.ok, false);
  if (!top.ok) assert.doesNotMatch(top.message, /raise/i);
  assert.equal(clampCap(2), 5);
  assert.equal(clampCap(99), 30);
  assert.equal(clampCap(Number.NaN), 15);
});

// ---- the signals route ----
async function callRoute(body: unknown, env: Record<string, string | undefined> = {}) {
  const keys = ["LYNKR_PAYWALL", "LYNKR_MOCK", ...Object.keys(env)];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, { LYNKR_MOCK: "1" });
  delete process.env.LYNKR_PAYWALL;
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try {
    const { POST } = await import("../app/api/outreach/signals/route");
    return await POST(new Request("http://localhost/api/outreach/signals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => { globalThis.fetch = real; });
}

test("signals route returns company signals and requests only the reviewed feeds, never LinkedIn", async () => {
  const r = recorder(rss([{ title: "Acme Robotics raises $12 Mn", link: "https://inc42.com/buzz/acme", date: new Date().toUTCString() }]));
  const res = await withFetch(r.impl, () => callRoute({ companies: ["Acme"] }));
  assert.equal(res.status, 200);
  const data = await res.json() as { signals: { company: string; stale: boolean; kind: string }[]; feedErrors: unknown[] };
  assert.ok(data.signals.some((s) => s.company === "Acme" && s.kind === "news" && !s.stale));
  assert.deepEqual(data.feedErrors, []);
  assert.equal(r.urls.length, NEWS_FEED_URLS.length);
  for (const u of r.urls) { assert.equal(checkNewsFeed(u).ok, true); assert.doesNotMatch(u, /linkedin\.com/); }
});

test("signals route rejects a feed outside the allowlist before any fetch", async () => {
  const r = recorder();
  const res = await withFetch(r.impl, () => callRoute({ companies: ["Acme"], feeds: ["https://inc42.com/feed/", "https://evil.example/rss"] }));
  assert.equal(res.status, 400);
  assert.match((await res.json() as { error: string }).error, /Inc42|news/);
  assert.deepEqual(r.urls, []);
  const li = await withFetch(r.impl, () => callRoute({ companies: ["Acme"], feeds: ["https://www.linkedin.com/feed/"] }));
  assert.equal(li.status, 400);
  assert.deepEqual(r.urls, []);
});

test("signals route reports a feed that is down instead of hiding it", async () => {
  const r = recorder("down", 503);
  const res = await withFetch(r.impl, () => callRoute({ companies: ["Acme"], feeds: ["https://inc42.com/feed/"] }));
  assert.equal(res.status, 200);
  const data = await res.json() as { feedErrors: { feed: string; error: string }[] };
  assert.equal(data.feedErrors.length, 1);
  assert.equal(data.feedErrors[0].feed, "https://inc42.com/feed/");
});

test("signals route turns job-import roles into signals and refuses non-job-board links", async () => {
  const r = recorder();
  const res = await withFetch(r.impl, () => callRoute({
    companies: ["Acme"], feeds: [],
    roles: [
      { company: "Acme", title: "Data Analyst", sourceUrl: "https://boards.greenhouse.io/acme/jobs/12345", fetchedAt: new Date().toISOString() },
      { company: "Acme", title: "Sneaky", sourceUrl: "https://www.linkedin.com/jobs/view/1", fetchedAt: new Date().toISOString() },
    ],
  }));
  const data = await res.json() as { signals: { kind: string; text: string }[] };
  assert.equal(data.signals.filter((s) => s.kind === "open_role").length, 1);
  assert.deepEqual(r.urls, []); // roles come from the import; no fetch for them
});

test("signals route follows the paywall pattern and validates the body", async () => {
  const r = recorder();
  const locked = await withFetch(r.impl, () => callRoute({ companies: ["Acme"] }, { LYNKR_PAYWALL: "1" }));
  assert.equal(locked.status, 402);
  assert.deepEqual(r.urls, []);
  const bad = await withFetch(r.impl, () => callRoute({ companies: "Acme" }));
  assert.equal(bad.status, 400);
  const empty = await withFetch(r.impl, () => callRoute({ companies: [] }));
  assert.equal(empty.status, 400);
  assert.deepEqual(r.urls, []);
});
