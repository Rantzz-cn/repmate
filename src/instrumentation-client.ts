// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://12add07d808696ae08655f0a8eee4b8d@o4511729081581568.ingest.us.sentry.io/4511729085513728",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  enableLogs: false,
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});

declare global {
  interface Window {
    __REPMATE_CAPTURE_ERROR__?: (
      error: unknown,
      context?: Record<string, string | number | boolean | undefined>,
    ) => void;
  }
}

window.__REPMATE_CAPTURE_ERROR__ = (error, context = {}) => {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) scope.setTag(key, String(value));
    });
    Sentry.captureException(error);
  });
};

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
