/**
 * BLOK 6 — client-side Sentry PII scrubbing.
 *
 * Boots the real @sentry/browser SDK with the production configuration
 * (sendDefaultPii=false, maxBreadcrumbs=0, beforeSend=scrubSentryEvent) and
 * a stub transport that captures what WOULD be sent to Sentry. A test error
 * polluted with student PII must arrive without the name/e-mail.
 */
import { describe, expect, it } from "vitest";
import * as Sentry from "@sentry/browser";
import { scrubSentryEvent } from "@/lib/sentry-scrub";

// runtime-composed so ContextLines cannot echo spec literals
const STUDENT_EMAIL = ["anna", ".novakova", "@zs-example.cz"].join("");
const STUDENT_NAME = ["Anna", "Nováková"].join(" ");

describe("client Sentry PII scrubbing", () => {
  it("scrubSentryEvent strips PII categories", () => {
    const event = scrubSentryEvent({
      message: `boom ${STUDENT_EMAIL}`,
      request: { url: `/app/students?q=${STUDENT_NAME}` },
      breadcrumbs: [{ message: STUDENT_NAME }],
      extra: { student: STUDENT_NAME },
      user: { id: "u1", email: STUDENT_EMAIL, username: STUDENT_NAME },
      contexts: { browser: { name: "chrome" }, state: { student: STUDENT_NAME } },
    });
    const json = JSON.stringify(event);
    expect(json).not.toContain(STUDENT_EMAIL);
    expect(json).not.toContain(STUDENT_NAME);
    expect(event!.user).toEqual({ id: "u1" });
    expect(event!.contexts).toEqual({ browser: { name: "chrome" } });
  });

  it("captured exception leaves the SDK without student PII", async () => {
    const sent: string[] = [];
    const client = new Sentry.BrowserClient({
      dsn: "http://publickey@localhost:9/1",
      integrations: [],
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      beforeSend: (event) => scrubSentryEvent(event as never),
      stackParser: Sentry.defaultStackParser,
      transport: (options) =>
        Sentry.createTransport(options, (request) => {
          sent.push(String(request.body));
          return Promise.resolve({ statusCode: 200 });
        }),
    });
    const scope = new Sentry.Scope();
    scope.setClient(client);
    scope.setUser({ id: "user-42", email: STUDENT_EMAIL, username: STUDENT_NAME });

    client.captureException(
      new Error(`Rendering failed for <${STUDENT_EMAIL}>`),
      undefined,
      scope,
    );
    await client.flush(2000);

    expect(sent.length).toBeGreaterThan(0);
    const all = sent.join("\n");
    expect(all).toContain("Rendering failed");
    expect(all).not.toContain(STUDENT_EMAIL);
    expect(all).not.toContain(STUDENT_NAME);
    expect(all).toContain("user-42");
  });
});
