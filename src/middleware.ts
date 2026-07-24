import { NextRequest, NextResponse } from "next/server";

// Bypass static asset requests so middleware doesn't process images/css/js files
const BYPASS_PATHS = /\.(css|js|png|jpg|jpeg|webp|svg|ico|gif|woff|woff2|ttf|eot)$|^\/(sw\.js|manifest\.json|assets\/|css\/|_next\/)/;

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (BYPASS_PATHS.test(pathname)) {
    return NextResponse.next();
  }

  /**
   * Production-Ready Content Security Policy (CSP)
   *
   * 1. style-src: Uses 'self' 'unsafe-inline' https://fonts.googleapis.com
   *    (Note: Including a nonce in style-src causes modern browsers to ignore 'unsafe-inline',
   *    which breaks static <link rel="stylesheet"> files like landing.css and Next.js CSS).
   * 2. script-src: Allows 'self' 'unsafe-inline' 'unsafe-eval' to ensure React/Next.js client-side
   *    hydration and dynamic imports work seamlessly across all environments.
   * 3. connect-src: Permits communication with Supabase and Sentry.
   * 4. font-src & img-src: Whitelists Google Fonts, local assets, data URIs, blobs, and Google avatars.
   */
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://lh3.googleusercontent.com`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.us.sentry.io https://*.sentry.io`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://*.supabase.co`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|css/|sw.js|manifest.json).*)",
  ],
};
