import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Recipient search behind one provider interface (KTD6): Exa when EXA_API_KEY is set, otherwise
 * checked-in fixtures so the screens work end to end. Nothing here requests linkedin.com or any
 * social network, and page text is fetched only for results the user confirmed.
 */
const EXCLUDED = ['linkedin.com', 'lnkd.in', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'threads.net', 'reddit.com'];
export function allowedPublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return false;
    return !EXCLUDED.some((d) => host === d || host.endsWith(`.${d}`));
  } catch { return false; }
}
export type Candidate = { title: string; url: string; date: string; snippet: string };
export type ConfirmedPage = { source: string; text: string; date: string };
export const NOT_CONNECTED = 'Search is not connected yet.';

export function filterCandidates(results: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (!allowedPublicUrl(r.url) || seen.has(r.url)) return false;
    seen.add(r.url); return true;
  }).slice(0, 8);
}

/** The provider key, or undefined. Mock mode never reaches the network. */
function providerKey(): string | undefined {
  if (process.env.LYNKR_MOCK === '1') return undefined;
  return process.env.EXA_API_KEY?.trim() || undefined;
}
export const searchConnected = (): boolean => Boolean(providerKey());

type Fixture = { match: string; candidates: Candidate[]; pages: Record<string, { text: string; date?: string }> };
const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'search');
function loadFixtures(): Fixture[] {
  try {
    return readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).flatMap((f) => {
      try {
        const data = JSON.parse(readFileSync(path.join(FIXTURE_DIR, f), 'utf8')) as Partial<Fixture>;
        return typeof data.match === 'string' && Array.isArray(data.candidates) && data.pages && typeof data.pages === 'object' ? [data as Fixture] : [];
      } catch { return []; }
    });
  } catch { return []; }
}
/** A fixture applies only when every word of its `match` appears in the query, so other names get no results. */
function fixtureFor(query: string): Fixture | undefined {
  const q = query.toLowerCase();
  return loadFixtures().find((f) => f.match.toLowerCase().split(/\s+/).every((w) => q.includes(w)));
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export async function searchPublic(query: string, fetcher: typeof fetch = fetch): Promise<{ connected: boolean; candidates: Candidate[] }> {
  const key = providerKey();
  if (!key) {
    const fixture = fixtureFor(query);
    return { connected: false, candidates: filterCandidates((fixture?.candidates ?? []).map((c) => ({ title: str(c.title, 200), url: str(c.url, 2000), date: str(c.date, 40), snippet: str(c.snippet, 300) }))) };
  }
  const response = await fetcher('https://api.exa.ai/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ query: query.slice(0, 500), numResults: 8, excludeDomains: EXCLUDED }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Search is unavailable. Try again later.');
  const data = await response.json() as { results?: { title?: unknown; url?: unknown; publishedDate?: unknown }[] };
  return { connected: true, candidates: filterCandidates((Array.isArray(data.results) ? data.results : []).map(r => ({
    title: str(r.title, 200), url: str(r.url, 2000), date: str(r.publishedDate, 40), snippet: '',
  }))) };
}

/**
 * Text for confirmed results only. A URL that is not one of this contact's stored candidates, or is on an
 * excluded domain, is refused before anything is fetched. Without a provider key the fixture pages are used.
 */
export async function retrieveConfirmed(urls: string[], candidates: Candidate[], fetcher: typeof fetch = fetch, query = ''): Promise<ConfirmedPage[]> {
  const allowed = new Set(candidates.filter(c => allowedPublicUrl(c.url)).map(c => c.url));
  if (urls.some(url => !allowed.has(url) || !allowedPublicUrl(url))) throw new Error('Confirm a result from this search first.');
  if (!urls.length) return [];
  const key = providerKey();
  if (!key) {
    const fixture = fixtureFor(query);
    return urls.flatMap((url) => { const page = fixture?.pages[url]; return page && typeof page.text === 'string' ? [{ source: url, text: page.text.slice(0, 12000), date: str(page.date, 40) }] : []; });
  }
  const response = await fetcher('https://api.exa.ai/contents', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ ids: urls, text: { maxCharacters: 12000 } }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Could not read the confirmed results.');
  const data = await response.json() as { results?: { url?: unknown; text?: unknown; publishedDate?: unknown }[] };
  return (Array.isArray(data.results) ? data.results : []).filter(r => typeof r.url === 'string' && allowed.has(r.url) && urls.includes(r.url) && allowedPublicUrl(r.url) && typeof r.text === 'string')
    .map(r => ({ source: r.url as string, text: (r.text as string).slice(0, 12000), date: str(r.publishedDate, 40) }));
}
