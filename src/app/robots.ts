import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/login", "/offline", "/monitoring"],
    },
    sitemap: "https://www.rep-mate.app/sitemap.xml",
    host: "https://www.rep-mate.app",
  };
}
