import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.100.6"],
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

const routeRevision = process.env.VERCEL_GIT_COMMIT_SHA ?? "repmate-local-v1";
const offlineRoutes = [
  "/",
  "/login",
  "/app",
  "/app/programs",
  "/app/exercises",
  "/app/progress",
  "/app/profile",
  "/app/workout",
  "/offline",
];

const offlineAssetRoots = ["assets", "legacy"];
const collectPublicAssets = (relativeDirectory: string): Array<{ url: string; revision: string }> =>
  readdirSync(path.join(process.cwd(), "public", relativeDirectory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectPublicAssets(relativePath);
    const contents = readFileSync(path.join(process.cwd(), "public", relativePath));
    return [{
      url: `/${relativePath}`,
      revision: createHash("sha256").update(contents).digest("hex").slice(0, 16),
    }];
  });

const offlineAssets = offlineAssetRoots.flatMap(collectPublicAssets);

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  cacheOnNavigation: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    ...offlineRoutes.map((url) => ({ url, revision: routeRevision })),
    { url: "/manifest.json", revision: routeRevision },
    ...offlineAssets,
  ],
});

export default withSentryConfig(withSerwist(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "tradz-development",

  project: "repmate",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
