import type { MetadataRoute } from "next";
import { libraryItems } from "../content/library";
import { siteUrl } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/library` },
    ...libraryItems.map((item) => ({ url: `${siteUrl}/library/${item.slug}`, lastModified: item.published })),
  ];
}
