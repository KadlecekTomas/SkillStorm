import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleTokenVerifier } from './google-token.verifier';

describe('GoogleTokenVerifier', () => {
  const config = {
    get: jest.fn((key: string) => (key === 'GOOGLE_CLIENT_ID' ? 'client-id-1' : undefined)),
  } as unknown as ConfigService;

  const validPayload = {
    iss: 'https://accounts.google.com',
    aud: 'client-id-1',
    sub: 'google-sub-1',
    exp: String(Math.floor(Date.now() / 1000) + 600),
    email: 'Teacher@Skola.cz',
    email_verified: 'true',
    name: 'Učitel Testovací',
    hd: 'skola.cz',
  };

  function mockFetch(payload: unknown, ok = true) {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      json: async () => payload,
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a normalized profile for a valid token', async () => {
    mockFetch(validPayload);
    const verifier = new GoogleTokenVerifier(config);

    await expect(verifier.verify('token')).resolves.toEqual({
      subject: 'google-sub-1',
      email: 'teacher@skola.cz',
      emailVerified: true,
      name: 'Učitel Testovací',
      hostedDomain: 'skola.cz',
    });
  });

  it('rejects when GOOGLE_CLIENT_ID is not configured', async () => {
    const emptyConfig = { get: jest.fn() } as unknown as ConfigService;
    const verifier = new GoogleTokenVerifier(emptyConfig);

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['issuer', { ...validPayload, iss: 'https://evil.example' }],
    ['audience', { ...validPayload, aud: 'other-client' }],
    ['expiry', { ...validPayload, exp: String(Math.floor(Date.now() / 1000) - 10) }],
    ['subject', { ...validPayload, sub: undefined }],
  ])('rejects token with invalid %s', async (_label, payload) => {
    mockFetch(payload);
    const verifier = new GoogleTokenVerifier(config);

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when Google responds non-OK', async () => {
    mockFetch({ error: 'invalid_token' }, false);
    const verifier = new GoogleTokenVerifier(config);

    await expect(verifier.verify('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
