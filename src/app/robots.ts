import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site";

// Demo and design-system pages opt out with a noindex tag instead, so crawlers can still read it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
