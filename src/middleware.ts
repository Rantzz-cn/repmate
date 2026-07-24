/**
 * src/middleware.ts — RepMate Security Middleware
 *
 * Runs on every request at the Edge Runtime (Vercel).
 * Responsibilities:
 *   1. Generate a per-request cryptographic nonce for CSP.
 *   2. Inject the Content-Security-Policy header (FIX #1).
 *   3. Forward the nonce to the page via a response header that
 *      Next.js reads in layout.tsx (see the companion changes there).
 *
 * WHY A NONCE?
 * ───────────────────────────────────────────────────────────────────
 * React / Next.js injects inline <script> and <style> tags at runtime
 * for hydration. A plain CSP with 'unsafe-inline' would allow ANY
 * inline script — including attacker-injected ones — to run.
 * A per-request nonce is cryptographically random and unpredictable;
 * only the scripts we explicitly stamp with that nonce can execute.
 * ───────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";

// Routes that are public static files and do not need CSP processing.
// Keeping this list tight avoids unnecessary crypto work on every request.
const BYPASS_PATHS = /^\/(sw\.js|manifest\.json|assets\/|_next\/static\/|_next\/image\b)/;

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip header injection for static assets that don't render HTML.
  if (BYPASS_PATHS.test(pathname)) {
    return NextResponse.next();
  }

  // ──────────────────────────────────────────────────────────────────
  // 1. Generate a cryptographically secure nonce (base64, 128 bits).
  //    Each page request gets a unique value — this is the core of
  //    nonce-based CSP. The value MUST NOT be reused or predictable.
  // ──────────────────────────────────────────────────────────────────
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");

  // ──────────────────────────────────────────────────────────────────
  // 2. Build the Content-Security-Policy directive string.
  //
  //    Supabase project URL: rajnzbpeoyheacfpugqe.supabase.co
  //    Sentry ingest:        o4511729081581568.ingest.us.sentry.io
  //    Sentry tunnel:        /monitoring  (same-origin — covered by 'self')
  //    Google Fonts CSS:     fonts.googleapis.com
  //    Google Fonts files:   fonts.gstatic.com
  //    Google user avatars:  lh3.googleusercontent.com
  // ──────────────────────────────────────────────────────────────────
  const csp = [
    // ── default-src ──────────────────────────────────────────────────
    // Fallback for any directive not explicitly listed.
    // 'self' means same-origin only; nothing external by default.
    `default-src 'self'`,

    // ── script-src ───────────────────────────────────────────────────
    // 'nonce-…' allows only scripts tagged with this specific nonce.
    // 'strict-dynamic' trusts scripts loaded by a nonced script, which
    //   is required for Next.js chunk loading.
    // 'unsafe-eval' is NOT included — Next.js 14+ does not need it in
    //   production. Remove if you must use third-party scripts that
    //   do eval(); prefer a safer alternative instead.
    //
    // TRADE-OFF: 'strict-dynamic' makes 'self' and 'https:' redundant
    //   in modern browsers but we keep 'self' for Safari compat.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self'`,

    // ── style-src ────────────────────────────────────────────────────
    // 'nonce-…' for Next.js injected style tags.
    // Google Fonts CSS is fetched from fonts.googleapis.com.
    // 'unsafe-inline' is the pragmatic fallback for CSS because
    //   Next.js and many UI libraries inject <style> without nonces.
    //   TRADE-OFF: 'unsafe-inline' in style-src does not enable JS
    //   execution; CSS injection attacks (e.g. data exfil via
    //   attribute selectors) are a lower risk in this context.
    `style-src 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,

    // ── font-src ─────────────────────────────────────────────────────
    // Actual font files (.woff2, etc.) are served from fonts.gstatic.com.
    // 'self' covers locally hosted fonts in /public.
    `font-src 'self' https://fonts.gstatic.com`,

    // ── img-src ──────────────────────────────────────────────────────
    // 'self'              → app images in /public
    // data:               → base64 inline images (used by UI components)
    // blob:               → canvas / image capture (share recap feature)
    // lh3.googleusercontent.com → Google OAuth user avatars
    `img-src 'self' data: blob: https://lh3.googleusercontent.com`,

    // ── connect-src ──────────────────────────────────────────────────
    // All external network requests (fetch, XHR, WebSocket).
    //
    // 'self'                                    → Next.js hot-reload, /api, /monitoring
    // *.supabase.co                             → Supabase REST, Auth, Realtime
    // wss://*.supabase.co                       → Supabase Realtime WebSocket
    // *.ingest.us.sentry.io                     → Sentry error reporting (direct)
    // *.sentry.io                               → Sentry SDK beacon
    //
    // TRADE-OFF: Using a wildcard subdomain for supabase.co means any
    //   future Supabase subdomain is allowed. Locking to the exact
    //   project ID (rajnzbpeoyheacfpugqe.supabase.co) is stricter but
    //   breaks if you ever migrate projects. Choose based on risk appetite.
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.us.sentry.io https://*.sentry.io`,

    // ── media-src ────────────────────────────────────────────────────
    // Video/audio (exercise form animations served from /public).
    `media-src 'self' blob:`,

    // ── worker-src ───────────────────────────────────────────────────
    // The Serwist/Workbox service worker is served from /sw.js ('self').
    // blob: is required by Serwist's internal Workbox worker setup.
    `worker-src 'self' blob:`,

    // ── manifest-src ─────────────────────────────────────────────────
    `manifest-src 'self'`,

    // ── frame-ancestors ──────────────────────────────────────────────
    // CSP equivalent of X-Frame-Options: DENY.
    // Prevents any external page from embedding RepMate in an iframe.
    // Modern browsers honour this directive; older ones fall back to
    // the X-Frame-Options header set in vercel.json.
    `frame-ancestors 'none'`,

    // ── frame-src ────────────────────────────────────────────────────
    // No iframes are rendered by RepMate. 'none' closes this vector.
    `frame-src 'none'`,

    // ── object-src ───────────────────────────────────────────────────
    // Flash, Java applets, and plugins are legacy attack surfaces.
    `object-src 'none'`,

    // ── base-uri ─────────────────────────────────────────────────────
    // Prevents <base href="…"> injection which could redirect all
    // relative URLs to an attacker-controlled origin.
    `base-uri 'self'`,

    // ── form-action ──────────────────────────────────────────────────
    // Supabase OAuth redirects forms to Supabase endpoints.
    `form-action 'self' https://*.supabase.co`,

    // ── upgrade-insecure-requests ────────────────────────────────────
    // Automatically upgrades HTTP sub-resource requests to HTTPS.
    // Works alongside HSTS as a belt-and-suspenders measure.
    `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join("; ");

  // ──────────────────────────────────────────────────────────────────
  // 3. Clone the request so we can inject the nonce for the page to
  //    read via headers() in layout.tsx / Server Components.
  // ──────────────────────────────────────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  // Pass nonce to Server Components via a custom request header.
  // The page reads it with: import { headers } from "next/headers";
  //                          const nonce = (await headers()).get("x-nonce");
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // ──────────────────────────────────────────────────────────────────
  // 4. Attach the CSP header to every HTML response.
  //    Using Content-Security-Policy (not the *-Report-Only variant)
  //    means violations are blocked, not just reported.
  //
  //    TRADE-OFF: Switching to CSP-Report-Only first and monitoring
  //    your Sentry dashboard for violation reports is a safer rollout
  //    strategy. Once no violations appear, switch to enforcement.
  // ──────────────────────────────────────────────────────────────────
  response.headers.set("Content-Security-Policy", csp);

  // Also surface the nonce as a response header so the Next.js
  // Metadata API / generateMetadata can stamp <script nonce="…">.
  response.headers.set("x-nonce", nonce);

  return response;
}

/**
 * Configure which routes the middleware runs on.
 * Exclude static files and Vercel internals for performance.
 */
export const config = {
  matcher: [
    // Run on all paths except static assets, images, and _next internals.
    "/((?!_next/static|_next/image|favicon.ico|assets/|sw.js|manifest.json).*)",
  ],
};
