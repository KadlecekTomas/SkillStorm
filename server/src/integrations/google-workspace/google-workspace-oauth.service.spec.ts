import { ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GoogleWorkspaceService } from './google-workspace.service';
import { GoogleWorkspaceConfigService } from './google-workspace-config.service';
import { OAuthStateService } from './oauth-state.service';
import { fakeNonceStore } from './oauth-state.service.spec';
import {
  GOOGLE_WORKSPACE_NOT_CONFIGURED,
  GOOGLE_WORKSPACE_SCOPES,
} from './google-workspace.constants';

function buildConfig(env: Record<string, string>): GoogleWorkspaceConfigService {
  const configService = {
    get: (k: string) => env[k],
  } as unknown as ConfigService;
  return new GoogleWorkspaceConfigService(configService);
}

function buildService(config: GoogleWorkspaceConfigService) {
  const { prisma } = fakeNonceStore();
  const oauthState = new OAuthStateService(prisma, config);
  const service = new GoogleWorkspaceService(
    prisma, // service prisma (only mockConnect upsert / connect use it; both stubbed/spied)
    { log: jest.fn() } as never, // audit
    {} as never, // academicYears
    config,
    {} as never, // encryption
    oauthState,
    {} as never, // directory factory
  );
  return { service, oauthState };
}

const FULL_ENV = {
  GOOGLE_WORKSPACE_CLIENT_ID: 'client-id-123',
  GOOGLE_WORKSPACE_CLIENT_SECRET: 'secret',
  GOOGLE_WORKSPACE_REDIRECT_URI:
    'http://localhost:4200/integrations/google-workspace/oauth/callback',
  GOOGLE_INTEGRATION_ENCRYPTION_KEY: 'k'.repeat(64),
  JWT_ACCESS_SECRET: 'jwt-secret',
  PUBLIC_APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4200',
};

describe('GoogleWorkspaceService OAuth flow', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  describe('generateAuthUrl', () => {
    it('throws 503 GOOGLE_WORKSPACE_NOT_CONFIGURED without OAuth env', async () => {
      const { service } = buildService(buildConfig({}));
      await expect(service.generateAuthUrl('org-1', 'user-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
      try {
        await service.generateAuthUrl('org-1', 'user-1');
      } catch (e) {
        const res = (e as ServiceUnavailableException).getResponse() as {
          code?: string;
        };
        expect(res.code).toBe(GOOGLE_WORKSPACE_NOT_CONFIGURED);
      }
    });

    it('returns a Google consent URL with only read-only Directory scopes', async () => {
      const { service } = buildService(buildConfig(FULL_ENV));
      const { url } = await service.generateAuthUrl('org-1', 'user-1');
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('access_type')).toBe('offline');
      expect(parsed.searchParams.get('prompt')).toBe('consent');
      expect(parsed.searchParams.get('state')).toBeTruthy();

      const scopes = (parsed.searchParams.get('scope') ?? '').split(' ');
      expect(scopes.sort()).toEqual([...GOOGLE_WORKSPACE_SCOPES].sort());
      expect(scopes.every((s) => s.endsWith('.readonly'))).toBe(true);
      expect(scopes.some((s) => s.includes('classroom'))).toBe(false);
    });

    it('points at the dev mock-connect endpoint in mock mode', async () => {
      process.env.NODE_ENV = 'development';
      const { service } = buildService(
        buildConfig({ ...FULL_ENV, GOOGLE_WORKSPACE_MOCK_MODE: 'true' }),
      );
      const { url } = await service.generateAuthUrl('org-1', 'user-1');
      expect(url).toContain('/dev/google-workspace/mock-connect');
      expect(url).toContain('state=');
    });
  });

  describe('handleCallback', () => {
    it('redirects to invalid_state on a forged state and never calls connect', async () => {
      const { service } = buildService(buildConfig(FULL_ENV));
      const connectSpy = jest
        .spyOn(service, 'connect')
        .mockResolvedValue({} as never);

      const { redirectUrl } = await service.handleCallback({
        code: 'abc',
        state: 'forged.signature',
      });
      expect(connectSpy).not.toHaveBeenCalled();
      expect(redirectUrl).toContain('error=invalid_state');
    });

    it('runs connect once on a valid state and rejects replay', async () => {
      const { service, oauthState } = buildService(buildConfig(FULL_ENV));
      const connectSpy = jest
        .spyOn(service, 'connect')
        .mockResolvedValue({} as never);
      const state = await oauthState.issue({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      const first = await service.handleCallback({ code: 'auth-code', state });
      expect(connectSpy).toHaveBeenCalledWith('org-1', 'user-1', 'auth-code');
      expect(first.redirectUrl).toContain('connected=1');
      expect(first.redirectUrl).not.toContain('auth-code');

      // Replaying the same captured state+code is rejected.
      const second = await service.handleCallback({ code: 'auth-code', state });
      expect(second.redirectUrl).toContain('error=replayed_state');
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('redirects to a safe error when connect throws', async () => {
      const { service, oauthState } = buildService(buildConfig(FULL_ENV));
      jest.spyOn(service, 'connect').mockRejectedValue(new Error('boom'));
      const state = await oauthState.issue({
        organizationId: 'org-1',
        userId: 'user-1',
      });
      const { redirectUrl } = await service.handleCallback({
        code: 'auth-code',
        state,
      });
      expect(redirectUrl).toContain('error=google_connect_failed');
      expect(redirectUrl).not.toContain('boom');
    });
  });

  describe('mock mode safety', () => {
    it('mockConnect rejects with 404 when mock mode is off', async () => {
      const { service } = buildService(buildConfig(FULL_ENV));
      await expect(service.mockConnect('whatever')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('config.mockMode is forced off in production even if env=true', () => {
      process.env.NODE_ENV = 'production';
      const config = buildConfig({ GOOGLE_WORKSPACE_MOCK_MODE: 'true' });
      expect(config.mockMode).toBe(false);
    });
  });
});
