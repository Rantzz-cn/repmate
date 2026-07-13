// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://12add07d808696ae08655f0a8eee4b8d@o4511729081581568.ingest.us.sentry.io/4511729085513728",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  enableLogs: false,
  sendDefaultPii: false,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
});
