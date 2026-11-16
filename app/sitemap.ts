import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, publicUrl } from "../lib/public-url";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicUrl();
  return PUBLIC_PATHS.map((path) => ({ url: `${base}${path === "/" ? "" : path}`, changeFrequency: path === "/" ? "weekly" : "yearly", priority: path === "/" ? 1 : 0.3 }));
}
