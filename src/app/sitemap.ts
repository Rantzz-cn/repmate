import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: "https://www.rep-mate.app/",
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  }];
}
