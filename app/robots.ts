import type { MetadataRoute } from "next";
import { isIndexable, publicUrl } from "../lib/public-url";

export const dynamic = "force-dynamic";

/** The real site lists its public pages; every other deployment (preview, tester build) is kept out of search. */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/login", "/signup", "/forgot-password", "/reset-password"] }],
    sitemap: `${publicUrl()}/sitemap.xml`,
  };
}
