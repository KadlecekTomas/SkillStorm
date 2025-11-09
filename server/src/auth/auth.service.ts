// src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import {
  AuditEntityType,
  Membership,
  OrganizationRole,
  OrganizationType,
  Prisma,
  SystemRole,
  User,
  XpEventType,
} from '@prisma/client';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { addDays } from 'date-fns';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { GamificationService } from 'src/gamification/gamification.service';

type JwtClaims = {
  sub: string;
  email: string | null;
  username: string | null;
  systemRole: SystemRole | null;
  organizationRole: OrganizationRole | null;
  organizationId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly gamification: GamificationService,
  ) {}

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

  private buildClaims(user: User, membership: Membership | null): JwtClaims {
    return {
      sub: user.id,
      email: user.email ?? null,
      username: user.username ?? null,
      systemRole: user.systemRole ?? null,
      organizationRole: membership?.role ?? null,
      organizationId: membership?.organizationId ?? null,
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async resolveDefaultOrganization() {
    const existing = await this.prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.organization.create({
      data: {
        name: 'Default School',
      },
    });
  }

  private async audit(
    action: string,
    userId?: string | null,
    organizationId?: string | null,
    entityId?: string | null,
    metadata?: Record<string, any>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        organizationId: organizationId ?? null,
        entityType: AuditEntityType.USER,
        entityId: entityId ?? userId ?? null,
        action,
        metadata: metadata ?? null,
      },
    });
  }

  // ---------- Refresh token (opaque + retry na P2002) ----------
  private async issueRefreshToken(userId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = randomBytes(48).toString('hex');
        const tokenHash = this.hashToken(token);
        await this.prisma.refreshToken.create({
          data: {
            token,
            tokenHash,
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

  // -------------------------
  // Public API
  // -------------------------

  async register(dto: RegisterDto) {
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

          const organization = await tx.organization.create({
            data: {
              name: `${dto.name}'s School`,
              type: OrganizationType.SCHOOL,
            },
            select: {
              id: true,
              name: true,
              type: true,
              createdAt: true,
            },
          });

          const membership = await tx.membership.create({
            data: {
              userId: createdUser.id,
              organizationId: organization.id,
              role: dto.role ?? OrganizationRole.STUDENT,
            },
            select: {
              id: true,
              role: true,
              organizationId: true,
              createdAt: true,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: createdUser.id,
              organizationId: organization.id,
              entityType: AuditEntityType.USER,
              entityId: createdUser.id,
              action: 'REGISTER',
              metadata: {
                requestedRole: dto.role,
              },
            },
          });

          return { user: createdUser, organization, membership };
        });

        const persistedUser = await this.prisma.user.findUnique({
          where: { id: result.user.id },
        });
        if (!persistedUser) {
          throw new NotFoundException('User not found after registration');
        }
        const tokens = await this.generateTokens(
          persistedUser,
          result.membership as unknown as Membership,
        );
        this.logger.log(
          `Registration complete for ${result.user.email} in org ${result.organization.id}`,
        );

        return {
          tokens,
          user: result.user,
          organization: result.organization,
          membership: result.membership,
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
          continue;
        }
        throw e;
      }
    }

    throw new ConflictException('Username already exists');
  }

  async login(dto: LoginDto) {
    // login = username NEBO email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.login }, { email: dto.login }],
      },
    });
    if (!user) {
      this.logger.warn(`Failed login – user not found (${dto.login})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(`Failed login – invalid password (${dto.login})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // aktualizace lastLoginAt (DB) – ať se propíše i do response
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    let membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' }, // deterministicky, pokud má víc členství
    });

    if (!membership) {
      this.logger.warn(`No membership for ${user.email}, creating fallback`);
      const fallbackOrg = await this.prisma.organization.create({
        data: {
          name: `${user.name ?? 'Workspace'} Org`,
          type: OrganizationType.PRIVATE,
        },
      });
      membership = await this.prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: fallbackOrg.id,
          role: OrganizationRole.STUDENT,
        },
      });
      this.logger.log(`Fallback membership created for ${user.email}`);
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

    await this.audit('LOGIN', updatedUser.id, membership?.organizationId ?? null, updatedUser.id);

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

  async refreshAccessToken(oldRefreshToken: string) {
    // 1) musí existovat v DB (opaque kontrola)
    const row = await this.prisma.refreshToken.findFirst({
      where: { token: oldRefreshToken },
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

    // 3) získej uživatele + jeho (první) membership pro payload
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    // 4) nové tokeny
    const tokens = await this.generateTokens(user, membership);
    await this.audit('REFRESH', user.id, membership?.organizationId ?? null, user.id);
    return tokens;
  }

  async logout(accessToken?: string, refreshToken?: string) {
    let resolvedUserId: string | null = null;

    if (accessToken) {
      const decoded = this.jwtService.decode(accessToken) as { sub?: string } | null;
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
        where: { token: refreshToken, revokedAt: null },
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

    await this.audit('LOGOUT', resolvedUserId, organizationId, resolvedUserId);

    return { message: 'Logged out successfully' };
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        systemRole: true,
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

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      memberships: user.memberships ?? [],
      organizationRole: primaryMembership?.role ?? null,
      organizationId: primaryMembership?.organizationId ?? null,
      needsOnboarding,
    };
  }
}
