/** Conservative boundaries for user-confirmed public sources. */
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
export function filterCandidates(results: Candidate[]): Candidate[] {
  return results.filter((r) => allowedPublicUrl(r.url)).slice(0, 8);
}

const domains = EXCLUDED;
export async function searchPublic(query: string, fetcher: typeof fetch = fetch): Promise<{ connected: boolean; candidates: Candidate[] }> {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) return { connected: false, candidates: [] };
  const response = await fetcher('https://api.exa.ai/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ query: query.slice(0, 500), numResults: 8, excludeDomains: domains }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Search is unavailable. Try again later.');
  const data = await response.json() as { results?: { title?: unknown; url?: unknown; publishedDate?: unknown }[] };
  return { connected: true, candidates: filterCandidates((Array.isArray(data.results) ? data.results : []).map(r => ({
    title: typeof r.title === 'string' ? r.title.slice(0, 200) : '',
    url: typeof r.url === 'string' ? r.url.slice(0, 2000) : '',
    date: typeof r.publishedDate === 'string' ? r.publishedDate.slice(0, 40) : '', snippet: '',
  }))) };
}
/** Only explicitly confirmed search results may be retrieved. */
export async function retrieveConfirmed(urls: string[], candidates: Candidate[], fetcher: typeof fetch = fetch): Promise<{ source: string; text: string; date: string }[]> {
  const allowed = new Set(candidates.filter(c => allowedPublicUrl(c.url)).map(c => c.url));
  if (urls.some(url => !allowed.has(url) || !allowedPublicUrl(url))) throw new Error('Confirm a result from this search first.');
  if (!urls.length) return [];
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) throw new Error('Search is not connected yet.');
  const response = await fetcher('https://api.exa.ai/contents', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ ids: urls, text: { maxCharacters: 12000 } }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Could not read the confirmed results.');
  const data = await response.json() as { results?: { url?: unknown; text?: unknown; publishedDate?: unknown }[] };
  return (Array.isArray(data.results) ? data.results : []).filter(r => typeof r.url === 'string' && allowed.has(r.url) && urls.includes(r.url) && allowedPublicUrl(r.url) && typeof r.text === 'string')
    .map(r => ({ source: r.url as string, text: (r.text as string).slice(0, 12000), date: typeof r.publishedDate === 'string' ? r.publishedDate.slice(0, 40) : '' }));
}
