import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { PrismaService } from '@/prisma/prisma.service';
import { GamificationService } from '@/gamification/gamification.service';
import { AuditService } from '@/audit/audit.service';
import { RbacService } from '@/modules/rbac/rbac.service';
import { AuthService } from './auth.service';

/**
 * Session-ownership hardening regression tests:
 * - issueTokensForMembership must reject memberships that do not belong to
 *   the user or are soft-deleted (token-minting IDOR otherwise).
 * - issueSessionForVerifiedUser (SSO path) must enforce user status checks.
 */
describe('AuthService session ownership', () => {
  let service: AuthService;

  const activeUser = {
    id: 'user-1',
    email: 'user@example.com',
    username: null,
    name: 'User One',
    systemRole: null,
    status: UserStatus.ACTIVE,
    deletedAt: null,
    tokenVersion: 0,
    lastActiveMembershipId: null,
    lastLoginAt: null,
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
    },
  };
  const jwtMock = { sign: jest.fn().mockReturnValue('signed-access-token') };
  const configMock = {
    get: jest.fn((key: string) =>
      key === 'JWT_ACCESS_SECRET' ? 'test-secret-for-unit-tests' : undefined,
    ),
  };
  const gamificationMock = { awardXpForEvent: jest.fn() };
  const auditMock = { log: jest.fn() };
  const rbacMock = {};
  const cacheMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ ...activeUser });
    prismaMock.user.update.mockResolvedValue({ ...activeUser, lastLoginAt: new Date() });
    prismaMock.membership.findFirst.mockResolvedValue(null);
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
    auditMock.log.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: GamificationService, useValue: gamificationMock },
        { provide: AuditService, useValue: auditMock },
        { provide: RbacService, useValue: rbacMock },
        { provide: CACHE_MANAGER, useValue: cacheMock },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('issueTokensForMembership', () => {
    it("rejects a membership that belongs to a different user (token-minting IDOR)", async () => {
      prismaMock.membership.findUnique.mockResolvedValue({
        id: 'membership-foreign',
        userId: 'someone-else',
        organizationId: 'org-1',
        deletedAt: null,
      });

      await expect(
        service.issueTokensForMembership('user-1', 'membership-foreign'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtMock.sign).not.toHaveBeenCalled();
    });

    it('rejects a soft-deleted membership', async () => {
      prismaMock.membership.findUnique.mockResolvedValue({
        id: 'membership-1',
        userId: 'user-1',
        organizationId: 'org-1',
        deletedAt: new Date(),
      });

      await expect(
        service.issueTokensForMembership('user-1', 'membership-1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtMock.sign).not.toHaveBeenCalled();
    });

    it('issues tokens for a live membership owned by the user', async () => {
      prismaMock.membership.findUnique.mockResolvedValue({
        id: 'membership-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: 'STUDENT',
        deletedAt: null,
      });

      const tokens = await service.issueTokensForMembership('user-1', 'membership-1');

      expect(tokens.accessToken).toBe('signed-access-token');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(prismaMock.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('issueSessionForVerifiedUser (SSO session entry point)', () => {
    it('rejects a non-existent user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.issueSessionForVerifiedUser('missing-user'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([
      ['suspended', { status: UserStatus.SUSPENDED }],
      ['inactive', { status: UserStatus.INACTIVE }],
      ['soft-deleted', { deletedAt: new Date() }],
    ])('rejects a %s user', async (_label, overrides) => {
      prismaMock.user.findUnique.mockResolvedValue({ ...activeUser, ...overrides });

      await expect(
        service.issueSessionForVerifiedUser('user-1'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtMock.sign).not.toHaveBeenCalled();
    });

    it('rejects when the requested organization has no live membership for the user', async () => {
      prismaMock.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.issueSessionForVerifiedUser('user-1', { organizationId: 'org-x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtMock.sign).not.toHaveBeenCalled();
    });

    it('issues a personal (membership-less) session and audits it', async () => {
      const result = await service.issueSessionForVerifiedUser('user-1', {
        auditAction: 'SSO_LOGIN_GOOGLE',
      });

      expect(result.tokens.accessToken).toBe('signed-access-token');
      expect(result.user.organizationId).toBeNull();
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SSO_LOGIN_GOOGLE', userId: 'user-1' }),
      );
    });
  });
});
