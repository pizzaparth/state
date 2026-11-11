import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { COMPARISONS } from "@/lib/compare";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly",
    priority,
  });

  return [
    page("/", 1),
    page("/compare", 0.8),
    ...COMPARISONS.map((c) => page(`/compare/${c.slug}`, 0.7)),
    page("/principles", 0.5),
  ];
}
