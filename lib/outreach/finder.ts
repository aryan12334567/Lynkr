import { searchUrl } from '../connect';

/** Search links are opened by the user; Lynkr does not search LinkedIn. */
export function targetLinks(goal: string, field: string, companies: string[]): { label: string; url: string }[] {
  const audience = goal === 'clients' ? 'buyer' : goal === 'hiring' ? 'candidate' : goal === 'mentor' ? 'mentor' : goal === 'funding' ? 'investor' : goal === 'buy_business' ? 'business owner' : 'professional';
  const targets = companies.length ? companies.slice(0, 5) : [''];
  return targets.map((company) => ({ label: [audience, field, company].filter(Boolean).join(' · '), url: searchUrl([audience, field, company].filter(Boolean).join(' ')) }));
}
export function signalIsStale(date: string, now = new Date()): boolean {
  const value = Date.parse(date);
  return !Number.isFinite(value) || now.getTime() - value > 60 * 86400000;
}
