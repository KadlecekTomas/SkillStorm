/**
 * BLOK 6 — Sentry PII scrubbing verification.
 *
 * Boots the REAL @sentry/node SDK configured exactly like main.ts
 * (sendDefaultPii=false, maxBreadcrumbs=0, beforeSend=scrubSentryEvent),
 * points the DSN at a local mock ingest server, captures an exception
 * polluted with student PII, and asserts the envelope that "arrives in
 * Sentry" contains the error but none of the personal data.
 */
import * as http from 'http';
import { scrubSentryEvent } from '../../src/infra/sentry-scrub';

// Composed at runtime so the PII never sits verbatim in a source line —
// otherwise Sentry's ContextLines would echo this spec's own literals and
// the test would measure the wrong thing.
const STUDENT_EMAIL = ['anna', '.novakova', '@zs-example.cz'].join('');
const STUDENT_NAME = ['Anna', 'Nováková'].join(' ');

describe('Sentry PII scrubbing', () => {
  describe('scrubSentryEvent (unit)', () => {
    it('drops request/breadcrumbs/extra and reduces user to id', () => {
      const event = scrubSentryEvent({
        message: `boom for ${STUDENT_EMAIL}`,
        request: { url: `/students?email=${STUDENT_EMAIL}`, headers: {} },
        breadcrumbs: [{ message: STUDENT_NAME }],
        extra: { student: STUDENT_NAME },
        user: { id: 'u1', email: STUDENT_EMAIL, username: STUDENT_NAME },
        exception: {
          values: [{ type: 'Error', value: `fail <${STUDENT_EMAIL}>` }],
        },
        contexts: { runtime: { name: 'node' }, response: { data: STUDENT_NAME } },
      });
      const json = JSON.stringify(event);
      expect(json).not.toContain(STUDENT_EMAIL);
      expect(json).not.toContain(STUDENT_NAME);
      expect(event!.user).toEqual({ id: 'u1' });
      expect(event!.request).toBeUndefined();
      expect(event!.breadcrumbs).toBeUndefined();
      expect(event!.contexts).toEqual({ runtime: { name: 'node' } });
      expect(event!.exception!.values![0]!.value).toContain('[email]');
    });

    it('passes null through (event dropped)', () => {
      expect(scrubSentryEvent(null)).toBeNull();
    });
  });

  describe('end-to-end against a mock Sentry ingest', () => {
    let server: http.Server;
    let received: string[] = [];
    let port = 0;

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          received.push(Buffer.concat(chunks).toString('utf8'));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{}');
        });
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      port = (server.address() as { port: number }).port;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    it('captured exception arrives WITHOUT student PII', async () => {
      const Sentry = await import('@sentry/node');
      Sentry.init({
        dsn: `http://publickey@127.0.0.1:${port}/1`,
        environment: 'pii-scrub-test',
        sendDefaultPii: false,
        maxBreadcrumbs: 0,
        // identical wiring to main.ts
        beforeSend: (event) => scrubSentryEvent(event as never),
        // keep the test hermetic and the payload plaintext
        transportOptions: {},
      });

      Sentry.setUser({
        id: 'user-123',
        email: STUDENT_EMAIL,
        username: STUDENT_NAME,
      });
      // Policy: our own error messages never embed user NAMES (they are not
      // pattern-matchable); e-mails may appear and must be redacted. Names
      // travel via user context / local vars / breadcrumbs — all scrubbed.
      const localStudent = { name: STUDENT_NAME, email: STUDENT_EMAIL };
      Sentry.captureException(
        new Error(`Grading failed for <${localStudent.email}>`),
      );
      await Sentry.flush(5000);
      await Sentry.close(1000);

      expect(received.length).toBeGreaterThan(0);
      const all = received.join('\n');
      // the error itself arrived…
      expect(all).toContain('Grading failed');
      expect(all).toContain('pii-scrub-test');
      // …but no personal data did
      expect(all).not.toContain(STUDENT_EMAIL);
      expect(all).not.toContain(STUDENT_NAME);
      expect(all).not.toContain('Nov\\u00e1kov\\u00e1');
      // the opaque user id is the only identity that may leave
      expect(all).toContain('user-123');
    });
  });
});
