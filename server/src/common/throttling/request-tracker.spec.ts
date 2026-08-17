import {
  isSchoolSharedIpLogin,
  resolveSchoolAuthIpTracker,
  resolveThrottleTracker,
  type ThrottleRequest,
} from './request-tracker';

function request(input: {
  path: string;
  ip?: string;
  token?: string;
  email?: string;
}): ThrottleRequest {
  return {
    originalUrl: input.path,
    url: input.path,
    ip: input.ip ?? '203.0.113.10',
    cookies: input.token ? { ss_at: input.token } : {},
    headers: {},
    body: input.email ? { email: input.email } : {},
  };
}

describe('resolveThrottleTracker', () => {
  it('isolates distinct login accounts behind the same school NAT', () => {
    const a = resolveThrottleTracker(
      request({ path: '/auth/login', email: 'student-a@school.test' }),
    );
    const b = resolveThrottleTracker(
      request({ path: '/api/auth/login', email: 'student-b@school.test' }),
    );

    expect(a).toMatch(/^login-account:[a-f0-9]{64}$/);
    expect(b).toMatch(/^login-account:[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('student-a@school.test');
    expect(b).not.toContain('student-b@school.test');
  });

  it('normalizes the same login account before hashing', () => {
    const lower = resolveThrottleTracker(
      request({ path: '/auth/login', email: 'student@school.test' }),
    );
    const mixed = resolveThrottleTracker(
      request({ path: '/auth/login', email: '  Student@School.Test  ' }),
    );
    expect(lower).toBe(mixed);
  });

  it('keeps the tight login tracker IP-scoped if account identity is missing', () => {
    expect(resolveThrottleTracker(request({ path: '/auth/login' }))).toBe(
      'ip:203.0.113.10',
    );
  });

  it('keeps other sensitive authentication routes scoped by IP', () => {
    expect(resolveThrottleTracker(request({ path: '/auth/register' }))).toBe(
      'ip:203.0.113.10',
    );
    expect(resolveThrottleTracker(request({ path: '/api/auth/refresh' }))).toBe(
      'ip:203.0.113.10',
    );
  });

  it('exposes a separate shared-IP anti-spray tracker only for password login', () => {
    const login = request({ path: '/api/auth/login', email: 'student@school.test' });
    const health = request({ path: '/health' });

    expect(isSchoolSharedIpLogin(login)).toBe(true);
    expect(isSchoolSharedIpLogin(health)).toBe(false);
    expect(resolveSchoolAuthIpTracker(login)).toBe('ip:203.0.113.10');
  });

  it('isolates authenticated school traffic by session behind the same NAT', () => {
    const a = resolveThrottleTracker(
      request({ path: '/guardian/children', token: 'session-a' }),
    );
    const b = resolveThrottleTracker(
      request({ path: '/guardian/children', token: 'session-b' }),
    );
    expect(a).toMatch(/^session:[a-f0-9]{64}$/);
    expect(b).toMatch(/^session:[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
  });

  it('falls back to IP for anonymous traffic without exposing tokens', () => {
    const anonymous = resolveThrottleTracker(request({ path: '/health' }));
    const authenticated = resolveThrottleTracker(
      request({ path: '/app/data', token: 'secret-token' }),
    );
    expect(anonymous).toBe('ip:203.0.113.10');
    expect(authenticated).not.toContain('secret-token');
  });
});
