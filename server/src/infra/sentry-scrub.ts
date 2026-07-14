/**
 * PII scrubbing for Sentry events (GDPR: student names and e-mails must
 * never leave the server). Applied as `beforeSend`/`beforeSendTransaction`.
 *
 * Strategy — remove by category, not by pattern-matching names:
 *  - request payloads, headers, cookies and query strings are dropped whole
 *    (they can contain names, e-mails, tokens);
 *  - user context is reduced to the opaque id;
 *  - breadcrumbs are dropped (http breadcrumbs embed URLs with ids/queries);
 *  - e-mail addresses are additionally regex-redacted from every message
 *    and exception value as a second line of defense.
 */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

const redactEmails = (value: string): string =>
  value.replace(EMAIL_RE, '[email]');

// Minimal structural type — we must not depend on @sentry/* types at build
// time (optional dependency on the server).
export interface SentryEventLike {
  message?: string;
  request?: unknown;
  user?: { id?: string; [key: string]: unknown };
  breadcrumbs?: unknown;
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
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

export function scrubSentryEvent<T extends SentryEventLike | null>(
  event: T,
): T {
  if (!event) return event;

  delete event.request;
  delete event.breadcrumbs;
  delete event.extra;

  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : {};
  }

  if (typeof event.message === 'string') {
    event.message = redactEmails(event.message);
  }
  for (const value of event.exception?.values ?? []) {
    if (typeof value.value === 'string') {
      value.value = redactEmails(value.value);
    }
    // Frame-level leaks: LocalVariables integration captures runtime values
    // (can hold student names), ContextLines embeds source snippets. Keep
    // only file/line/function — enough to locate the bug.
    for (const frame of value.stacktrace?.frames ?? []) {
      delete frame.vars;
      delete frame.pre_context;
      delete frame.context_line;
      delete frame.post_context;
    }
  }
  if (event.contexts) {
    // keep only runtime/os/app — drop anything request- or user-shaped
    const allowed = ['runtime', 'os', 'app', 'device', 'trace'];
    for (const key of Object.keys(event.contexts)) {
      if (!allowed.includes(key)) delete event.contexts[key];
    }
  }
  return event;
}
