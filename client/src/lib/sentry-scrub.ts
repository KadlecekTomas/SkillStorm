/**
 * PII scrubbing for browser Sentry events — mirror of the server-side
 * scrubber (server/src/infra/sentry-scrub.ts). GDPR: student names and
 * e-mails must never leave the browser in an error report.
 *
 * Strategy: drop whole categories (request, breadcrumbs, extra, non-runtime
 * contexts), reduce user to the opaque id, and regex-redact e-mails from
 * every message/exception value as a second line of defense. URLs are
 * dropped too — deep links can embed tokens or query PII.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

const redactEmails = (value: string): string => value.replace(EMAIL_RE, "[email]");

export interface SentryEventLike {
  message?: string;
  request?: unknown;
  user?: { id?: string; [key: string]: unknown };
  breadcrumbs?: unknown;
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  exception?: {
    values?: {
      type?: string;
      value?: string;
      stacktrace?: { frames?: Record<string, unknown>[] };
      [key: string]: unknown;
    }[];
  };
  [key: string]: unknown;
}

export function scrubSentryEvent<T extends SentryEventLike | null>(event: T): T {
  if (!event) return event;

  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;

  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : {};
  }
  if (typeof event.message === "string") {
    event.message = redactEmails(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === "string") {
      value.value = redactEmails(value.value);
    }
    for (const frame of value.stacktrace?.frames ?? []) {
      delete frame.vars;
      delete frame.pre_context;
      delete frame.context_line;
      delete frame.post_context;
    }
  }
  if (event.contexts) {
    const allowed = ["runtime", "os", "app", "device", "trace", "browser"];
    for (const key of Object.keys(event.contexts)) {
      if (!allowed.includes(key)) delete event.contexts[key];
    }
  }
  return event;
}
