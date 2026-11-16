/**
 * The address the public pages are served from, for canonical links, the sitemap and sharing cards.
 * BETTER_AUTH_URL is the site's own address on every deployment; a Render host name is the fallback.
 */
export const PRODUCTION_URL = "https://www.lynkr.cloud";

export function publicUrl(): string {
  const own = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "");
  if (own && /^https?:\/\//.test(own)) return own;
  const render = process.env.RENDER_EXTERNAL_HOSTNAME?.trim();
  return render ? `https://${render}` : PRODUCTION_URL;
}

/** Only the real site is indexed. A preview, a tester build or a local run asks search engines to stay out. */
export const isIndexable = (): boolean => publicUrl() === PRODUCTION_URL;

/** Pages a visitor can read without signing in. */
export const PUBLIC_PATHS = ["/", "/privacy", "/terms", "/refunds", "/contact"] as const;
