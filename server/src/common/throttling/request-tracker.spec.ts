import { resolveThrottleTracker, type ThrottleRequest } from './request-tracker';

function request(input: { path: string; ip?: string; token?: string }): ThrottleRequest {
  return { originalUrl: input.path, url: input.path, ip: input.ip ?? '203.0.113.10', cookies: input.token ? { ss_at: input.token } : {}, headers: {} };
}

describe('resolveThrottleTracker', () => {
  it('keeps sensitive authentication routes scoped by IP', () => {
    const a = resolveThrottleTracker(request({ path: '/auth/login', token: 'session-a' }));
    const b = resolveThrottleTracker(request({ path: '/api/auth/login', token: 'session-b' }));
    expect(a).toBe('ip:203.0.113.10');
    expect(b).toBe('ip:203.0.113.10');
  });
  it('isolates authenticated school traffic by session behind the same NAT', () => {
    const a = resolveThrottleTracker(request({ path: '/guardian/children', token: 'session-a' }));
    const b = resolveThrottleTracker(request({ path: '/guardian/children', token: 'session-b' }));
    expect(a).toMatch(/^session:[a-f0-9]{64}$/);
    expect(b).toMatch(/^session:[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
  });
  it('falls back to IP for anonymous traffic without exposing tokens', () => {
    const anonymous = resolveThrottleTracker(request({ path: '/health' }));
    const authenticated = resolveThrottleTracker(request({ path: '/app/data', token: 'secret-token' }));
    expect(anonymous).toBe('ip:203.0.113.10');
    expect(authenticated).not.toContain('secret-token');
  });
});
