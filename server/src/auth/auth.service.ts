// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import type { LoginDto } from './dto/login.dto';
import { RegisterMode, type RegisterDto } from './dto/register.dto';
import type { JoinOrganizationDto } from './dto/join-organization.dto';
import { ConfigService } from '@nestjs/config';
import type { Membership, SystemRole, User } from '@prisma/client';
import {
  AuditEntityType,
  OrganizationRole,
  OrganizationType,
  Prisma,
  XpEventType,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { GamificationService } from '@/gamification/gamification.service';
import { AuditService } from '@/audit/audit.service';
import { RbacService } from '@/modules/rbac/rbac.service';
import { PermissionKey } from '@prisma/client';
import type { Request } from 'express';
import { REFRESH_TOKEN_COOKIE } from './token-cookies';
import { isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { bumpOrgVersion } from '@/shared/cache/org-cache.utils';

type JwtClaims = {
  sub: string;
  email: string | null;
  username: string | null;
  systemRole: SystemRole | null;
  organizationRole: OrganizationRole | null;
  organizationId: string | null;
  membershipId: string | null;
};

export type MeContext = {
  user: Awaited<ReturnType<AuthService["getUserProfile"]>>;
  organization: { id: string; name: string; type: any } | null;
  membership: { id: string; role: any; organizationId: string } | null;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly gamification: GamificationService,
    private readonly auditService: AuditService,
    private readonly rbac: RbacService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) { }

  private readonly logger = new Logger(AuthService.name);

  // -------------------------
  // Helpers
  // -------------------------
  private normalize(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private async ensureUniqueUsername(baseInput: string) {
    const base =
      (this.normalize(baseInput) || 'user')
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 16) || 'user';
    let candidate = base;
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      candidate = `${base}${i++}`;
    }
  }

  private resolveJoinRole(role?: OrganizationRole): OrganizationRole {
    if (!role) {
      throw new BadRequestException('Role is required for joining an organization');
    }
    const allowed = new Set<OrganizationRole>([
      OrganizationRole.STUDENT,
      OrganizationRole.TEACHER,
      OrganizationRole.PARENT,
    ]);
    if (!allowed.has(role)) {
      throw new BadRequestException('Selected role is not allowed for joining');
    }
    return role;
  }


  private async resolveJoinOrganization(joinCode?: string) {
    if (!joinCode) {
      throw new BadRequestException('Join code is required');
    }
    if (!isUUID(joinCode)) {
      throw new BadRequestException('Join code is not valid');
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: joinCode },
    });
    if (!org || org.deletedAt) {
      throw new NotFoundException('Organization not found');
    }
    if (org.type === OrganizationType.PRIVATE) {
      throw new BadRequestException('Private organizations cannot be joined');
    }
    return org;
  }

  private buildClaims(user: User, membership: Membership | null): JwtClaims {
    return {
      sub: user.id,
      email: user.email ?? null,
      username: user.username ?? null,
      systemRole: user.systemRole ?? null,
      organizationRole: membership?.role ?? null,
      organizationId: membership?.organizationId ?? null,
      membershipId: membership?.id ?? null,
    };
  }

  // ---------- Refresh token (opaque + retry na P2002) ----------
  private async issueRefreshToken(userId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = randomBytes(48).toString('hex');
        await this.prisma.refreshToken.create({
          data: {
            token,
            userId,
            expiresAt: addDays(new Date(), 7),
          },
        });
        return token;
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }
    throw new Error('Failed to issue refresh token after retries');
  }

  private async generateTokens(user: User, membership: Membership | null) {
    const claims = this.buildClaims(user, membership);
    const accessSecret = this.config.get<string>('JWT_SECRET');
    if (!accessSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const accessToken = this.jwtService.sign(
      { ...claims },
      {
        secret: accessSecret,
        expiresIn: '15m',
        jwtid: randomUUID(), // unikátní JTI → lepší revokace
      },
    );

    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  private async rotateRefreshToken(token: string) {
    const row = await this.prisma.refreshToken.findFirst({
      where: { token },
    });
    if (!row || row.expiresAt < new Date() || row.revokedAt) {
      if (row && !row.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: row.id },
          data: { revokedAt: new Date() },
        });
      }
      this.logger.warn('Rejected refresh token (invalid/expired)');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    this.logger.log('Refresh token rotated');

    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let membership: { id: string; role: any; organizationId: string } | null = null;
    if (user.lastActiveMembershipId) {
      const m = await this.prisma.membership.findFirst({
        where: {
          id: user.lastActiveMembershipId,
          userId: user.id,
          deletedAt: null,
        },
        select: { id: true, role: true, organizationId: true },
      });
      membership = m;
    }
    if (!membership) {
      membership = await this.prisma.membership.findFirst({
        where: { userId: user.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, organizationId: true },
      });
    }

    const tokens = await this.generateTokens(
      user,
      membership as unknown as Membership,
    );
    await this.auditService.log({
      action: 'REFRESH',
      entityType: AuditEntityType.USER,
      userId: user.id,
      organizationId: membership?.organizationId ?? null,
      entityId: user.id,
    });
    return tokens;
  }

  /**
   * Issue tokens for a user and membership (used by invites.accept).
   */
  async issueTokensForMembership(
    userId: string,
    membershipId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) throw new UnauthorizedException('Membership not found');
    return this.generateTokens(user, membership);
  }

  // -------------------------
  // Public API
  // -------------------------

  async register(dto: RegisterDto) {
    if (!dto.mode) {
      throw new BadRequestException('Registration mode is required');
    }
    const mode = dto.mode;

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const baseUname =
      dto.username ?? dto.email.split('@')[0] ?? dto.name ?? 'user';
    const now = new Date();

    for (let attempt = 0; attempt < 2; attempt++) {
      const username = await this.ensureUniqueUsername(
        attempt === 0
          ? baseUname
          : `${baseUname}${Math.floor(Math.random() * 1000)}`,
      );

      try {
        if (mode === RegisterMode.CREATE_ORG) {
          // CREATE_ORG: create User only. Organization is created in onboarding step.
          const result = await this.prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
              data: {
                email: dto.email,
                username,
                name: dto.name,
                passwordHash,
                systemRole: null,
                lastLoginAt: now,
              },
              select: {
                id: true,
                email: true,
                username: true,
                name: true,
                systemRole: true,
                lastLoginAt: true,
              },
            });
            return { user: createdUser };
          });

          const persistedUser = await this.prisma.user.findUnique({
            where: { id: result.user.id },
          });
          if (!persistedUser) {
            throw new NotFoundException('User not found after registration');
          }

          const tokens = await this.generateTokens(persistedUser, null);

          await this.auditService.log({
            action: 'REGISTER',
            entityType: AuditEntityType.USER,
            userId: result.user.id,
            organizationId: null,
            entityId: result.user.id,
            metadata: {
              mode,
              onboardingState: 'CREATE_ORG_PENDING',
            },
          });

          this.logger.log(
            `Registration complete for ${result.user.email} (mode=${mode}, org pending)`,
          );

          return {
            tokens,
            user: result.user,
            organization: null,
            membership: null,
          };
        }

        const result = await this.prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email: dto.email,
              username,
              name: dto.name,
              passwordHash,
              systemRole: null,
              lastLoginAt: now,
            },
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
              systemRole: true,
              lastLoginAt: true,
            },
          });

          return { user: createdUser };
        });

        const persistedUser = await this.prisma.user.findUnique({
          where: { id: result.user.id },
        });
        if (!persistedUser) {
          throw new NotFoundException('User not found after registration');
        }

        const tokens = await this.generateTokens(persistedUser, null);

        await this.auditService.log({
          action: 'REGISTER',
          entityType: AuditEntityType.USER,
          userId: result.user.id,
          organizationId: null,
          entityId: result.user.id,
          metadata: {
            requestedRole: dto.role ?? null,
            mode,
            joinCodeProvided: Boolean(dto.joinCode),
          },
        });

        this.logger.log(
          `Registration complete for ${result.user.email} (mode=${mode})`,
        );

        return {
          tokens,
          user: result.user,
          organization: null,
          membership: null,
        };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          const target = (e.meta as any)?.target as string[] | undefined;
          if (target?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
          // collision na username → zkus další pokus
          continue;
        }
        throw e;
      }
    }

    throw new ConflictException('Username already exists');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      this.logger.warn(`Failed login – user not found (${dto.email})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(`Failed login – invalid password (${dto.email})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // aktualizace lastLoginAt (DB) – ať se propíše i do response
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let membership: Membership | null = null;
    if (updatedUser.lastActiveMembershipId) {
      membership = await this.prisma.membership.findFirst({
        where: {
          id: updatedUser.lastActiveMembershipId,
          userId: updatedUser.id,
          deletedAt: null,
        },
      });
    }
    if (!membership) {
      membership = await this.prisma.membership.findFirst({
        where: { userId: updatedUser.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (membership?.id) {
        await this.prisma.user.update({
          where: { id: updatedUser.id },
          data: { lastActiveMembershipId: membership.id },
        });
      }
    }

    const tokens = await this.generateTokens(updatedUser, membership);

    if (membership?.id) {
      await this.gamification.awardXpForEvent(
        membership.id,
        XpEventType.USER_LOGIN,
        5,
        { source: 'auth.login' },
      );
    }

    await this.auditService.log({
      action: 'LOGIN',
      entityType: AuditEntityType.USER,
      userId: updatedUser.id,
      organizationId: membership?.organizationId ?? null,
      entityId: updatedUser.id,
    });

    const response = {
      tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        systemRole: updatedUser.systemRole,
        organizationRole: membership?.role ?? null,
        organizationId: membership?.organizationId ?? null,
        lastLoginAt: updatedUser.lastLoginAt, // ← propsáno ven
      },
    };
    this.logger.log(`Login result for ${updatedUser.id}`);
    return response;
  }

  async refreshToken(oldToken: string) {
    if (!oldToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return this.rotateRefreshToken(oldToken);
  }

  async refreshAccessToken(oldRefreshToken?: string, req?: Request) {
    const resolvedToken =
      oldRefreshToken ?? req?.cookies?.[REFRESH_TOKEN_COOKIE] ?? undefined;

    if (!resolvedToken) {
      this.logger.warn('Rejected refresh token (missing)');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.rotateRefreshToken(resolvedToken);
  }

  async logout(accessToken?: string, refreshToken?: string) {
    let resolvedUserId: string | null = null;

    if (accessToken) {
      const decoded = this.jwtService.decode(accessToken) as {
        sub?: string;
      } | null;
      resolvedUserId = decoded?.sub ?? null;
    }

    if (!resolvedUserId && refreshToken) {
      const tokenRow = await this.prisma.refreshToken.findFirst({
        where: { token: refreshToken },
      });
      resolvedUserId = tokenRow?.userId ?? null;
    }

    // Blacklistni access token (aby nešel použít dál)
    if (accessToken) {
      try {
        await this.prisma.revokedToken.create({
          data: {
            token: accessToken,
            userId: resolvedUserId,
          },
        });
      } catch (e) {
        if (
          !(e instanceof Prisma.PrismaClientKnownRequestError) ||
          e.code !== 'P2002'
        ) {
          throw e;
        }
      }
      this.logger.log('Access token revoked');
    }

    // Smaž refresh token (může existovat i více – smažeme konkrétní)
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      this.logger.log('Refresh token revoked');
    }

    let organizationId: string | null = null;
    if (resolvedUserId) {
      const primary = await this.prisma.membership.findFirst({
        where: { userId: resolvedUserId },
        orderBy: { createdAt: 'asc' },
        select: { organizationId: true },
      });
      organizationId = primary?.organizationId ?? null;
    }

    await this.auditService.log({
      action: 'LOGOUT',
      entityType: AuditEntityType.USER,
      userId: resolvedUserId,
      organizationId,
      entityId: resolvedUserId,
    });

    return { message: 'Logged out successfully' };
  }

  async getUserProfile(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        systemRole: true,
        isPlatformAdmin: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          where: { deletedAt: null },
          select: {
            id: true,
            role: true,
            organizationId: true,
            organization: { select: { name: true, type: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const needsOnboarding = (user.memberships?.length ?? 0) === 0;

    const primaryMembership = user.memberships?.[0] ?? null;

    const mappedMemberships = user.memberships ?? [];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      isPlatformAdmin: user.isPlatformAdmin ?? false,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      memberships: mappedMemberships,
      organizationRole: primaryMembership?.role ?? null,
      organizationId: primaryMembership?.organizationId ?? null,
      needsOnboarding,
    };
  }

  /**
   * Canonical membership resolution for /me and bootstrap:
   * (1) claims.membershipId if provided and valid (belongs to user, not deleted)
   * (2) user.lastActiveMembershipId if valid
   * (3) first membership (orderBy createdAt)
   * Invalid lastActiveMembershipId is cleaned up (set to null).
   */
  async getMeContext(userId: string, claims?: { membershipId?: string | null; organizationId?: string | null }) {
    const userRow = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        systemRole: true,
        isPlatformAdmin: true,
        createdAt: true,
        lastLoginAt: true,
        lastActiveMembershipId: true,
        memberships: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            organizationId: true,
            organization: { select: { name: true, type: true } },
          },
        },
      },
    });

    if (!userRow) {
      throw new NotFoundException('User not found');
    }

    const memberships = userRow.memberships ?? [];
    const needsOnboarding = memberships.length === 0;

    let activeMembership: (typeof memberships)[0] | null = null;

    if (claims?.membershipId) {
      const m = await this.prisma.membership.findFirst({
        where: {
          id: claims.membershipId,
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          role: true,
          organizationId: true,
          organization: { select: { name: true, type: true } },
        },
      });
      if (m) {
        activeMembership = m;
      }
    }

    if (!activeMembership && userRow.lastActiveMembershipId) {
      const m = await this.prisma.membership.findFirst({
        where: {
          id: userRow.lastActiveMembershipId,
          userId,
          deletedAt: null,
        },
        select: { id: true, role: true, organizationId: true, organization: { select: { name: true, type: true } } },
      });
      if (m) {
        activeMembership = m;
      } else {
        await this.prisma.user.update({
          where: { id: userId },
          data: { lastActiveMembershipId: null },
        });
      }
    }

    if (!activeMembership && claims?.organizationId) {
      activeMembership = memberships.find((m) => m.organizationId === claims.organizationId) ?? null;
    }

    if (!activeMembership && memberships.length) {
      activeMembership = memberships[0] ?? null;
      if (activeMembership && userRow.lastActiveMembershipId !== activeMembership.id) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { lastActiveMembershipId: activeMembership.id },
        });
      }
    }

    const organization = activeMembership
      ? {
          id: activeMembership.organizationId,
          name: activeMembership.organization?.name,
          type: activeMembership.organization?.type ?? null,
        }
      : null;

    const membership = activeMembership
      ? {
          id: activeMembership.id,
          role: activeMembership.role,
          organizationId: activeMembership.organizationId,
        }
      : null;

    const userContext = {
      id: userRow.id,
      email: userRow.email,
      username: userRow.username,
      name: userRow.name,
      systemRole: userRow.systemRole,
      isPlatformAdmin: userRow.isPlatformAdmin ?? false,
      createdAt: userRow.createdAt,
      lastLoginAt: userRow.lastLoginAt,
      memberships,
      organizationRole: activeMembership?.role ?? null,
      organizationId: activeMembership?.organizationId ?? null,
      needsOnboarding,
    };

    const roles = activeMembership ? [activeMembership.role] : [];
    const permissionKeys = Object.values(PermissionKey);
    const permissionMap: Record<string, boolean> = activeMembership
      ? await this.rbac.canUserMultiple(
          userId,
          activeMembership.organizationId,
          permissionKeys,
        )
      : {};
    const permissions = permissionKeys.filter(
      (key) => permissionMap[key],
    );

    return { user: userContext, organization, membership, roles, permissions };
  }

  async joinOrganization(userId: string, dto: JoinOrganizationDto) {
    if (dto.role === OrganizationRole.STUDENT) {
      throw new BadRequestException(
        'Student join requires a class-bound invite. Use the invite link from your teacher (includes class + year).',
      );
    }
    const organization = await this.resolveJoinOrganization(dto.joinCode);
    const role = this.resolveJoinRole(dto.role);

    const existing = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: organization.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId,
        organizationId: organization.id,
        role,
      },
      select: {
        id: true,
        role: true,
        organizationId: true,
      },
    });

    if (role === OrganizationRole.TEACHER) {
      const existingTeacher = await this.prisma.teacher.findUnique({
        where: { membershipId: membership.id },
        select: { id: true },
      });
      if (!existingTeacher) {
        await this.prisma.teacher.create({
          data: {
            membershipId: membership.id,
            organizationId: organization.id,
          },
        });
      }
      await bumpOrgVersion(this.cache, organization.id);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveMembershipId: membership.id },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(
      user,
      membership as unknown as Membership,
    );

    await this.auditService.log({
      action: 'INVITE_ACCEPTED',
      entityType: AuditEntityType.ORGANIZATION,
      userId,
      organizationId: organization.id,
      entityId: membership.id,
      metadata: { role },
    });

    const ctx = await this.getMeContext(userId, {
      organizationId: organization.id,
    });
    return {
      tokens,
      user: ctx.user,
      organization: ctx.organization,
      membership: ctx.membership,
      roles: ctx.roles,
      permissions: ctx.permissions,
    };
  }


  async useOrganization(userId: string, orgId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        role: true,
        organizationId: true,
        organization: { select: { id: true, name: true, type: true } },
      },
    });

    if (!membership) {
      throw new UnauthorizedException('User is not a member of organization');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveMembershipId: membership.id },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(
      user,
      membership as unknown as Membership,
    );

    await this.auditService.log({
      action: 'USE_ORG',
      entityType: AuditEntityType.ORGANIZATION,
      userId,
      organizationId: orgId,
      entityId: orgId,
    });

    const ctx = await this.getMeContext(userId, {
      organizationId: membership.organizationId,
    });

    return {
      tokens,
      user: ctx.user,
      organization: ctx.organization,
      membership: ctx.membership,
      roles: ctx.roles,
      permissions: ctx.permissions,
    };
  }

  /**
   * Switch active organization by membership ID. Issues new JWT; no DB write except audit.
   * Invariant: API is always called with organizationId + membershipId from JWT.
   */
  async switchOrganization(userId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, userId, deletedAt: null },
      select: {
        id: true,
        role: true,
        organizationId: true,
        organization: { select: { id: true, name: true, type: true } },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Membership not found or does not belong to the current user',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveMembershipId: membershipId },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(
      user,
      membership as unknown as Membership,
    );

    await this.auditService.log({
      action: 'SWITCH_ORGANIZATION',
      entityType: AuditEntityType.ORGANIZATION,
      userId,
      organizationId: membership.organizationId,
      entityId: membership.id,
    });

    const ctx = await this.getMeContext(userId, {
      membershipId: membership.id,
    });

    return {
      tokens,
      user: ctx.user,
      organization: ctx.organization,
      membership: ctx.membership,
      roles: ctx.roles,
      permissions: ctx.permissions,
    };
  }
}
