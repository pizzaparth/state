import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The product and its API. One-time auth pages stay crawlable so search engines can
      // read their noindex tag; a disallowed page can still be indexed from links.
      disallow: ["/platform", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
