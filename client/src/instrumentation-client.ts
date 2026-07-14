/**
 * Next.js 15.3+ client instrumentation — runs once before the app
 * bootstraps in the browser. Initializes Sentry when a DSN is configured;
 * a build without NEXT_PUBLIC_SENTRY_DSN is a complete no-op.
 *
 * PII policy: sendDefaultPii=false, no breadcrumbs, and every event passes
 * through scrubSentryEvent (names/e-mails of students must never leave the
 * browser). See src/lib/sentry-scrub.ts.
 */
import * as Sentry from "@sentry/browser";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_COMMIT_SHA,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    // no performance tracing — errors only (keeps payloads and cost small)
    tracesSampleRate: 0,
    beforeSend: (event) => scrubSentryEvent(event as never),
  });
}
