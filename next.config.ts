import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const capacitorBuild = process.env.CAPACITOR_BUILD === "true";
const isDev = process.env.NODE_ENV === "development";

// ─────────────────────────────────────────────────────────────────────────────
// Security headers applied via Next.js headers() config.
// These serve as a defence-in-depth layer that covers:
//   • Local development (next dev) — vercel.json is NOT applied locally.
//   • Any non-Vercel deployment target.
// In production on Vercel, these are superseded by vercel.json, but
// having them here ensures no environment is left unprotected.
//
// NOTE: The Content-Security-Policy (CSP) is set per-request with a
// nonce in src/middleware.ts. The static fallback below is intentionally
// omitted from headers() because a static CSP would require 'unsafe-inline'
// to support Next.js hydration — which defeats the purpose.
// ─────────────────────────────────────────────────────────────────────────────
const securityHeaders = [
  {
    // FIX #3 – Missing Anti-clickjacking Header
    // Prevents any page from being embedded in an iframe on another origin.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // FIX #4 – X-Content-Type-Options Header Missing
    // Prevents browsers from MIME-sniffing the response away from the
    // declared Content-Type, blocking MIME-confusion attacks.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // HSTS – Force HTTPS for 1 year, including subdomains.
    // TRADE-OFF: Only enable on a domain fully committed to HTTPS.
    // Do not set this on localhost or staging domains.
    key: "Strict-Transport-Security",
    value: isDev
      ? "max-age=0"
      : "max-age=31536000; includeSubDomains; preload",
  },
  {
    // Referrer-Policy – Prevent auth tokens in URLs from leaking via
    // the Referer header to third-party origins (e.g., CDN logs).
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Permissions-Policy – Disable all browser APIs RepMate does not use.
    // An XSS attacker cannot silently access camera/mic/location.
    // TRADE-OFF: Must be updated if future features need these APIs.
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), " +
      "bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), " +
      "ambient-light-sensor=(), display-capture=(), document-domain=()",
  },
  {
    // FIX #2 – Cross-Domain Misconfiguration
    // Prevents other origins from reading this origin's resources.
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    // Isolates the browsing context from cross-origin opener attacks.
    // 'same-origin-allow-popups' is used because Supabase OAuth opens
    // a popup window for the authentication flow.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    // Allows loading cross-origin resources (e.g., Google Fonts) without
    // credentials while enabling cross-origin isolation.
    key: "Cross-Origin-Embedder-Policy",
    value: "credentialless",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(capacitorBuild ? { output: "export", trailingSlash: true } : {}),

  // allowedDevOrigins is only needed in development for local network
  // testing (e.g., mobile device on the same Wi-Fi).
  // Remove the IP if you are not actively testing on that device.
  ...(isDev ? { allowedDevOrigins: ["192.168.100.6"] } : {}),

  turbopack: { root: process.cwd() },
  images: {
    unoptimized: capacitorBuild,
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },

  // ── Defence-in-depth security headers ──────────────────────────────────
  // Applied on every route. vercel.json overrides these in production;
  // they exist here to protect development and alternative deployments.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // FIX #5 – Retrieved from Cache
        // Authenticated app pages must never be served from a shared cache.
        source: "/(|login|app)(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        // Service worker: never cache — browser manages its own SW lifecycle.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
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
  "/app/circle",
  "/app/workout",
  "/offline",
];

const offlineAssetRoots = ["assets", "styles"];
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
  ...(capacitorBuild ? {} : { tunnelRoute: "/monitoring" }),

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
