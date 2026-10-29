import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { COMPARISONS } from "@/lib/compare";
import { LEGAL_PAGES } from "@/lib/legal";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority,
  });

  return [
    page("/", 1),
    page("/pricing", 0.8),
    page("/compare", 0.8),
    ...COMPARISONS.map((c) => page(`/compare/${c.slug}`, 0.7)),
    page("/principles", 0.5),
    page("/register", 0.5),
    ...LEGAL_PAGES.map((p) => page(p.href, 0.2)),
  ];
}
