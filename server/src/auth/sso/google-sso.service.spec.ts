import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityProvider, UserStatus } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuthService } from '../auth.service';
import {
  GoogleSsoService,
  SSO_ORG_SELECTION_REQUIRED,
  isSupportedSsoProvider,
} from './google-sso.service';
import { GoogleTokenVerifier, type GoogleIdentityProfile } from './google-token.verifier';

const baseProfile: GoogleIdentityProfile = {
  subject: 'google-sub-1',
  email: 'teacher@skola.cz',
  emailVerified: true,
  name: 'Učitel Testovací',
  hostedDomain: 'skola.cz',
};

const SECRET_ID_TOKEN = 'super-secret-google-id-token';

describe('GoogleSsoService', () => {
  let service: GoogleSsoService;

  const prismaMock = {
    userIdentity: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
    membership: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const verifierMock = { verify: jest.fn() };
  const authServiceMock = { issueSessionForVerifiedUser: jest.fn() };
  const auditMock = { log: jest.fn() };
  const configMock = { get: jest.fn() };

  const session = {
    tokens: { accessToken: 'at', refreshToken: 'rt' },
    user: { id: 'user-1', organizationId: null },
  };

  function orgWithPolicy(
    id: string,
    settings: Partial<{
      ssoProvider: string | null;
      ssoAllowedDomains: string[];
      ssoAutoProvision: boolean;
    }>,
  ) {
    return {
      id,
      settings: {
        ssoProvider: 'google',
        ssoAllowedDomains: [],
        ssoAutoProvision: false,
        ...settings,
      },
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    configMock.get.mockImplementation((key: string) =>
      key === 'GOOGLE_SSO_ENABLED' ? 'true' : undefined,
    );
    verifierMock.verify.mockResolvedValue({ ...baseProfile });
    authServiceMock.issueSessionForVerifiedUser.mockResolvedValue(session);
    auditMock.log.mockResolvedValue(undefined);
    prismaMock.membership.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation((fn: (tx: any) => any) => fn(prismaMock));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleSsoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
        { provide: GoogleTokenVerifier, useValue: verifierMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get(GoogleSsoService);
  });

  afterEach(() => {
    // The raw ID token must never reach the audit log in any test scenario.
    const auditedPayloads = JSON.stringify(auditMock.log.mock.calls);
    expect(auditedPayloads).not.toContain(SECRET_ID_TOKEN);
  });

  it('returns 404 when the feature flag is off (endpoint stays dark)', async () => {
    configMock.get.mockReturnValue(undefined);

    await expect(
      service.loginWithGoogle({ idToken: SECRET_ID_TOKEN }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(verifierMock.verify).not.toHaveBeenCalled();
  });

  it('audits SSO_INVALID_TOKEN when the verifier rejects the token', async () => {
    verifierMock.verify.mockRejectedValue(new UnauthorizedException('Invalid Google token.'));

    await expect(
      service.loginWithGoogle({ idToken: SECRET_ID_TOKEN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SSO_INVALID_TOKEN' }),
    );
  });

  it('rejects tokens without a verified e-mail and audits the failure', async () => {
    verifierMock.verify.mockResolvedValue({ ...baseProfile, emailVerified: false });

    await expect(
      service.loginWithGoogle({ idToken: SECRET_ID_TOKEN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SSO_INVALID_TOKEN' }),
    );
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  describe('explicit organization selection (no "first membership wins")', () => {
    beforeEach(() => {
      prismaMock.userIdentity.findUnique.mockResolvedValue({
        id: 'identity-1',
        userId: 'user-1',
      });
    });

    it('issues a personal session when the user has no memberships', async () => {
      prismaMock.membership.findMany.mockResolvedValue([]);

      await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN });

      expect(authServiceMock.issueSessionForVerifiedUser).toHaveBeenCalledWith('user-1', {
        organizationId: null,
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
    });

    it('uses the single membership organization when exactly one exists', async () => {
      prismaMock.membership.findMany.mockResolvedValue([{ organizationId: 'org-a' }]);

      await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN });

      expect(authServiceMock.issueSessionForVerifiedUser).toHaveBeenCalledWith('user-1', {
        organizationId: 'org-a',
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
    });

    it('fails with SSO_ORG_SELECTION_REQUIRED for a multi-membership user without organizationId', async () => {
      prismaMock.membership.findMany.mockResolvedValue([
        { organizationId: 'org-a' },
        { organizationId: 'org-b' },
      ]);

      await expect(
        service.loginWithGoogle({ idToken: SECRET_ID_TOKEN }),
      ).rejects.toMatchObject({
        constructor: BadRequestException,
        response: expect.objectContaining({ code: SSO_ORG_SELECTION_REQUIRED }),
      });
      expect(authServiceMock.issueSessionForVerifiedUser).not.toHaveBeenCalled();
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SSO_MEMBERSHIP_REQUIRED_FAILED', userId: 'user-1' }),
      );
    });

    it('fails and audits when organizationId is supplied but the user has no membership there', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(orgWithPolicy('org-c', {}));
      authServiceMock.issueSessionForVerifiedUser.mockRejectedValue(
        new UnauthorizedException('Uživatel není členem zvolené organizace.'),
      );

      await expect(
        service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-c' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SSO_MEMBERSHIP_REQUIRED_FAILED',
          userId: 'user-1',
          organizationId: 'org-c',
        }),
      );
    });

    it('multi-organization user: the same Google identity logs into org A and org B with explicit organizationId', async () => {
      prismaMock.organization.findFirst
        .mockResolvedValueOnce(orgWithPolicy('org-a', {}))
        .mockResolvedValueOnce(orgWithPolicy('org-b', {}));

      await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-a' });
      await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-b' });

      expect(authServiceMock.issueSessionForVerifiedUser).toHaveBeenNthCalledWith(1, 'user-1', {
        organizationId: 'org-a',
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
      expect(authServiceMock.issueSessionForVerifiedUser).toHaveBeenNthCalledWith(2, 'user-1', {
        organizationId: 'org-b',
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
    });
  });

  it('logs in an existing identity and refreshes its profile snapshot', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue({
      id: 'identity-1',
      userId: 'user-1',
    });

    const result = await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN });

    expect(result).toBe(session);
    expect(prismaMock.userIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'identity-1' },
        data: expect.objectContaining({ email: 'teacher@skola.cz', emailVerified: true }),
      }),
    );
    expect(prismaMock.userIdentity.create).not.toHaveBeenCalled();
  });

  it('links a new identity to an existing local user matched by verified e-mail', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.ACTIVE,
      deletedAt: null,
      anonymized: false,
    });

    const result = await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN });

    expect(result).toBe(session);
    expect(prismaMock.userIdentity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        provider: IdentityProvider.GOOGLE,
        providerSubject: 'google-sub-1',
        emailVerified: true,
      }),
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SSO_IDENTITY_LINKED_GOOGLE' }),
    );
  });

  it('refuses to link an identity to a disabled or anonymized account and audits it', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      status: UserStatus.ACTIVE,
      deletedAt: null,
      anonymized: true,
    });

    await expect(
      service.loginWithGoogle({ idToken: SECRET_ID_TOKEN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.userIdentity.create).not.toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SSO_LOGIN_GOOGLE_FAILED', userId: 'user-1' }),
    );
  });

  it('rejects an unknown identity when no account exists and provisioning is off, and audits it', async () => {
    prismaMock.userIdentity.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.loginWithGoogle({ idToken: SECRET_ID_TOKEN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SSO_LOGIN_GOOGLE_FAILED' }),
    );
  });

  describe('organization-scoped policy', () => {
    it('rejects when the organization has no SSO policy at all', async () => {
      prismaMock.organization.findFirst.mockResolvedValue({
        id: 'org-1',
        settings: { ssoProvider: null },
      });

      await expect(
        service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('treats an unsupported ssoProvider string ("googleeee") as SSO disabled', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(
        orgWithPolicy('org-1', { ssoProvider: 'googleeee' }),
      );

      await expect(
        service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SSO_LOGIN_GOOGLE_FAILED', organizationId: 'org-1' }),
      );
    });

    it('enforces the e-mail domain allowlist and audits SSO_DOMAIN_MISMATCH_GOOGLE', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(
        orgWithPolicy('org-1', { ssoAllowedDomains: ['@jina-skola.cz'] }),
      );

      await expect(
        service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SSO_DOMAIN_MISMATCH_GOOGLE', organizationId: 'org-1' }),
      );
      expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
    });

    it('admits an allowed domain and scopes the linked identity to the organization', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(
        orgWithPolicy('org-1', { ssoAllowedDomains: ['skola.cz'] }),
      );
      prismaMock.userIdentity.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: UserStatus.ACTIVE,
        deletedAt: null,
        anonymized: false,
      });

      await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-1' });

      expect(prismaMock.userIdentity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ organizationId: 'org-1' }),
      });
      expect(authServiceMock.issueSessionForVerifiedUser).toHaveBeenCalledWith('user-1', {
        organizationId: 'org-1',
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
    });

    it('auto-provisions a passwordless user only when the org policy enables it', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(
        orgWithPolicy('org-1', { ssoAutoProvision: true }),
      );
      prismaMock.userIdentity.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'user-new' });

      await service.loginWithGoogle({ idToken: SECRET_ID_TOKEN, organizationId: 'org-1' });

      const createArgs = prismaMock.user.create.mock.calls[0][0];
      expect(createArgs.data.email).toBe('teacher@skola.cz');
      // Random unusable bcrypt hash — local password login cannot succeed
      // because nobody knows the 256-bit random input.
      expect(createArgs.data.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(createArgs.data.passwordHash).not.toContain('teacher');

      expect(prismaMock.userIdentity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-new',
          organizationId: 'org-1',
          providerSubject: 'google-sub-1',
        }),
      });
      // No membership in the org yet → session must not be org-scoped.
      expect(authServiceMock.issueSessionForVerifiedUser).toHaveBeenCalledWith('user-new', {
        organizationId: null,
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SSO_USER_PROVISIONED_GOOGLE' }),
      );
    });
  });
});

describe('isSupportedSsoProvider', () => {
  it.each([
    ['google', true],
    ['googleeee', false],
    ['GOOGLE', false],
    ['admin', false],
    ['*', false],
    [null, false],
    [undefined, false],
  ])('isSupportedSsoProvider(%p) === %p', (value, expected) => {
    expect(isSupportedSsoProvider(value as string | null | undefined)).toBe(expected);
  });
});
