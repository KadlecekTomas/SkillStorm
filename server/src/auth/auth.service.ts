// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
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
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterMode, type RegisterDto } from './dto/register.dto';
import type { JoinOrganizationDto } from './dto/join-organization.dto';
import { ConfigService } from '@nestjs/config';
import type { Membership, User } from '@prisma/client';
import {
  AuditEntityType,
  EnrollmentStatus,
  InvitationType,
  OrganizationRole,
  OrganizationType,
  Prisma,
  SystemRole,
  UserStatus,
  XpEventType,
} from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { addDays, addHours } from 'date-fns';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { GamificationService } from '@/gamification/gamification.service';
import { AuditService } from '@/audit/audit.service';
import { RbacService } from '@/modules/rbac/rbac.service';
import { PermissionKey } from '@prisma/client';
import type { Request } from 'express';
import { REFRESH_TOKEN_COOKIE } from './token-cookies';
import { hashToken, matchesTokenHash } from './token.util';
import { isUUID } from 'class-validator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { bumpOrgVersion } from '@/shared/cache/org-cache.utils';
import { getOrgBootstrap, getOrgReadiness, type OrgBootstrap, type OrgReadiness } from '@/shared/org-readiness.utils';
import {
  deriveOrgReadiness,
  type DerivedOrgReadiness,
  type OrgReadinessState,
} from '@/shared/org-readiness-v2';

type JwtClaims = {
  sub: string;
  email: string | null;
  username: string | null;
  systemRole: SystemRole | null;
  organizationRole: OrganizationRole | null;
  organizationId: string | null;
  membershipId: string | null;
  tokenVersion: number;
};

export type AuthContextMode = 'platform' | 'organization' | 'personal';

export type MeContext = {
  user: Awaited<ReturnType<AuthService['getUserProfile']>>;
  organization: {
    id: string;
    name: string;
    type: any;
    status?: any | null;
    readiness?: OrgReadiness;
    bootstrap?: OrgBootstrap;
    /** Readiness v2: state machine + missing list for onboarding UX */
    readinessState?: OrgReadinessState;
    canExecute?: boolean;
    missing?: string[];
    evidence?: DerivedOrgReadiness['evidence'];
    currentYearId?: string | null;
  } | null;
  membership: { id: string; role: any; organizationId: string } | null;
  roles: string[];
  permissions: string[];
  context: {
    mode: AuthContextMode;
    organizationId: string | null;
  };
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

  private buildClaims(user: User & { tokenVersion?: number }, membership: Membership | null): JwtClaims {
    return {
      sub: user.id,
      email: user.email ?? null,
      username: user.username ?? null,
      systemRole: user.systemRole ?? null,
      organizationRole: membership?.role ?? null,
      organizationId: membership?.organizationId ?? null,
      membershipId: membership?.id ?? null,
      tokenVersion: user.tokenVersion ?? 0,
    };
  }

  // ---------- Refresh token (opaque + retry na P2002) ----------
  private async issueRefreshToken(userId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = randomBytes(64).toString('hex');
        const tokenHash = hashToken(token);
        await this.prisma.refreshToken.create({
          data: {
            token: tokenHash,
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
    const tokenHash = hashToken(token);
    const row = await this.prisma.refreshToken.findFirst({
      where: { token: tokenHash },
    });
    if (row && !matchesTokenHash(token, row.token)) {
      this.logger.warn('Rejected refresh token (hash mismatch)');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
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
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException('Token invalid');
    }

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
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException('Account disabled');
    }
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) throw new UnauthorizedException('Membership not found');
    return this.generateTokens(user, membership);
  }

  // -------------------------
  // Public API
  // -------------------------

  /**
   * Map Prisma known errors to HTTP exceptions. Never leak raw 500.
   */
  private mapPrismaError(e: unknown): never {
    if (e instanceof PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        const target = (e.meta as { target?: string[] })?.target;
        if (target?.includes('email')) {
          throw new ConflictException('Email already exists');
        }
        if (target?.includes('username')) {
          throw new ConflictException('Username already taken');
        }
        throw new ConflictException('A record with this value already exists');
      }
      if (e.code === 'P2003') {
        throw new BadRequestException('Invalid reference (foreign key constraint)');
      }
      this.logger.warn(`Prisma error ${e.code} in register`, e.meta);
      throw new BadRequestException('Registration failed due to data constraint');
    }
    if (e instanceof BadRequestException || e instanceof ConflictException) {
      throw e;
    }
    this.logger.error('Register failed', e instanceof Error ? e.stack : e);
    throw new BadRequestException(
      e instanceof Error ? e.message : 'Registration failed',
    );
  }

  /** Feature flag: public org creation (default true if unset). */
  private isPublicOrgCreationAllowed(): boolean {
    const raw = process.env.ALLOW_PUBLIC_ORG_CREATION;
    if (raw == null || raw.trim() === '') return true;
    return raw.toLowerCase() === 'true';
  }

  private logInvalidInviteAttempt(token: string | undefined, ip?: string) {
    const trimmed = (token ?? '').trim();
    const prefix = trimmed ? trimmed.slice(0, 6) : null;
    this.logger.warn('Invalid invite attempt', {
      token: prefix,
      ip: ip ?? null,
    });
  }

  private async findInviteOrThrow(inviteToken: string, ip?: string) {
    const token = (inviteToken ?? '').trim();
    if (!token) {
      this.logInvalidInviteAttempt(token, ip);
      throw new ForbiddenException('Invite token required');
    }

    const invite = await this.prisma.invite.findFirst({
      where: {
        OR: [{ token }, { code: token }],
      },
    });

    if (!invite) {
      this.logInvalidInviteAttempt(token, ip);
      throw new ForbiddenException('Invalid invite');
    }
    if (invite.revokedAt) {
      this.logInvalidInviteAttempt(token, ip);
      throw new ForbiddenException('Invite revoked');
    }
    if (invite.expiresAt < new Date()) {
      this.logInvalidInviteAttempt(token, ip);
      throw new ForbiddenException('Invite expired');
    }
    if (invite.usedCount >= invite.maxUses) {
      this.logInvalidInviteAttempt(token, ip);
      throw new ForbiddenException('Invite already used');
    }
    return invite;
  }

  private async consumeInviteOrThrow(
    tx: Prisma.TransactionClient,
    inviteId: string,
    now: Date,
    maxUses: number,
    tokenForLog?: string,
    ip?: string,
  ) {
    const updated = await tx.invite.updateMany({
      where: {
        id: inviteId,
        revokedAt: null,
        expiresAt: { gt: now },
        usedCount: { lt: maxUses },
      },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count !== 1) {
      this.logInvalidInviteAttempt(tokenForLog, ip);
      throw new ForbiddenException('Invite already used');
    }
  }

  public async createMembershipFromInvite(
    tx: Prisma.TransactionClient,
    userId: string,
    invite: {
      id: string;
      organizationId: string;
      role: OrganizationRole;
      type: InvitationType;
      classSectionId: string | null;
      yearId: string | null;
      expiresAt: Date;
      maxUses: number;
      usedCount: number;
      revokedAt: Date | null;
    },
    now: Date,
    context?: { token?: string; ip?: string },
  ) {
    if (invite.revokedAt) {
      this.logInvalidInviteAttempt(context?.token, context?.ip);
      throw new ForbiddenException('Invite revoked');
    }
    if (invite.expiresAt < now) {
      this.logInvalidInviteAttempt(context?.token, context?.ip);
      throw new ForbiddenException('Invite expired');
    }

    if (invite.usedCount >= invite.maxUses) {
      this.logInvalidInviteAttempt(context?.token, context?.ip);
      throw new ForbiddenException('Invite already used');
    }

    const membership = await tx.membership.create({
      data: {
        userId,
        organizationId: invite.organizationId,
        role: invite.role,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { lastActiveMembershipId: membership.id },
    });

    if (invite.type === InvitationType.ORG_ONLY) {
      if (
        invite.role !== OrganizationRole.TEACHER &&
        invite.role !== OrganizationRole.DIRECTOR &&
        invite.role !== OrganizationRole.STUDENT
      ) {
        throw new BadRequestException('Invite role is not allowed for ORG_ONLY.');
      }
    }

    if (invite.role === OrganizationRole.TEACHER) {
      const existingTeacher = await tx.teacher.findUnique({
        where: { membershipId: membership.id },
        select: { id: true },
      });
      if (!existingTeacher) {
        await tx.teacher.create({
          data: {
            membershipId: membership.id,
            organizationId: invite.organizationId,
          },
          select: { id: true },
        });
      }
    }

    if (invite.role === OrganizationRole.STUDENT) {
      const existingStudent = await tx.student.findUnique({
        where: { membershipId: membership.id },
        select: { id: true },
      });
      if (!existingStudent) {
        await tx.student.create({
          data: {
            membershipId: membership.id,
            orgId: invite.organizationId,
          },
          select: { id: true },
        });
      }
    }

    if (invite.type === InvitationType.STUDENT_CLASS) {
      if (!invite.classSectionId || !invite.yearId) {
        throw new BadRequestException('Invite is missing class or year.');
      }

      if (invite.role !== OrganizationRole.STUDENT) {
        throw new BadRequestException('Student class invite must have STUDENT role.');
      }

      const classSection = await tx.classSection.findUnique({
        where: { id: invite.classSectionId },
        select: { id: true, orgId: true, yearId: true },
      });
      if (!classSection || classSection.orgId !== invite.organizationId) {
        throw new BadRequestException('Class section not found or does not belong to organization');
      }
      if (classSection.yearId !== invite.yearId) {
        throw new BadRequestException('yearId does not match classSection.yearId');
      }

      const academicYear = await tx.academicYear.findUnique({
        where: { id: invite.yearId },
        select: { isCurrent: true },
      });
      if (!academicYear || !academicYear.isCurrent) {
        throw new BadRequestException('Academic year is not the current one');
      }

      let student = await tx.student.findFirst({
        where: { membershipId: membership.id },
        select: { id: true },
      });
      if (!student) {
        student = await tx.student.create({
          data: {
            membershipId: membership.id,
            orgId: invite.organizationId,
          },
          select: { id: true },
        });
      }

      const existingEnrollment = await tx.enrollment.findFirst({
        where: {
          studentId: student.id,
          yearId: invite.yearId,
          status: { not: EnrollmentStatus.LEFT },
        },
        select: { id: true, classSectionId: true },
      });
      if (existingEnrollment) {
        if (existingEnrollment.classSectionId !== invite.classSectionId) {
          throw new ConflictException('Student is already enrolled in another class for this year');
        }
      } else {
        await tx.enrollment.create({
          data: {
            studentId: student.id,
            classSectionId: invite.classSectionId,
            yearId: invite.yearId,
            orgId: invite.organizationId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }

    await this.consumeInviteOrThrow(
      tx,
      invite.id,
      now,
      invite.maxUses,
      context?.token,
      context?.ip,
    );

    return membership;
  }

  async register(dto: RegisterDto, context?: { ip?: string }) {
    // --- Explicit payload validation ---
    if (!dto.mode) {
      throw new BadRequestException('Registration mode is required');
    }
    const mode = dto.mode;

    const email = typeof dto.email === 'string' ? dto.email.trim() : '';
    const password = typeof dto.password === 'string' ? dto.password : '';
    const name = typeof dto.name === 'string' ? dto.name.trim() : '';
    if (!email) {
      throw new BadRequestException('Email is required');
    }
    if (!password) {
      throw new BadRequestException('Password is required');
    }
    if (!name || name.length < 2) {
      throw new BadRequestException('Name is required and must be at least 2 characters');
    }

    if (mode === RegisterMode.CREATE_ORG) {
      const allowOrgCreation = this.isPublicOrgCreationAllowed();
      if (!allowOrgCreation) {
        throw new ForbiddenException('Organization creation disabled');
      }
    }

    const inviteToken = (dto.inviteToken ?? dto.code ?? '').trim();
    const invite =
      mode === RegisterMode.JOIN_ORG
        ? await this.findInviteOrThrow(inviteToken, context?.ip)
        : null;

    if (mode === RegisterMode.CREATE_ORG) {
      // Contract: register only creates user. Organization is created in onboarding step (POST /organizations).
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const baseUname = dto.username ?? email.split('@')[0] ?? name ?? 'user';
      const username = await this.ensureUniqueUsername(baseUname);
      const now = new Date();

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email,
              username,
              name,
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
          metadata: { mode, onboardingState: 'CREATE_ORG_PENDING' },
        });

        this.logger.log(
          `Registration complete for ${result.user.email} (mode=${mode}, onboardingState=CREATE_ORG_PENDING)`,
        );

        return {
          tokens,
          user: result.user,
          organization: null,
          membership: null,
        };
      } catch (e) {
        this.mapPrismaError(e);
      }
    }

    if (mode === RegisterMode.JOIN_ORG && invite) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existing) {
        throw new ConflictException('Email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const baseUname = dto.username ?? email.split('@')[0] ?? name ?? 'user';
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
                email,
                username,
                name,
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

            const inviteContext = {
              token: inviteToken,
              ...(context?.ip ? { ip: context.ip } : {}),
            };
            const membership = await this.createMembershipFromInvite(
              tx,
              createdUser.id,
              invite,
              now,
              inviteContext,
            );

            return { user: createdUser, membership };
          });

          const persistedUser = await this.prisma.user.findUnique({
            where: { id: result.user.id },
          });
          if (!persistedUser) {
            throw new NotFoundException('User not found after registration');
          }

          const tokens = await this.generateTokens(persistedUser, result.membership);

          await this.auditService.log({
            action: 'REGISTER',
            entityType: AuditEntityType.USER,
            userId: result.user.id,
            organizationId: invite.organizationId,
            entityId: result.user.id,
            metadata: {
              mode,
              inviteId: invite.id,
            },
          });

          this.logger.log(
            `Registration complete for ${result.user.email} (mode=${mode}, org=${invite.organizationId})`,
          );

          return {
            tokens,
            user: result.user,
            organization: { id: invite.organizationId },
            membership: result.membership,
          };
        } catch (e) {
          if (
            e instanceof PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            const target = (e.meta as { target?: string[] })?.target;
            if (target?.includes('email')) {
              throw new ConflictException('Email already exists');
            }
            continue;
          }
          this.mapPrismaError(e);
        }
      }

      throw new ConflictException('Username already exists');
    }

    // --- INDIVIDUAL: create User only ---
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const baseUname = dto.username ?? email.split('@')[0] ?? name ?? 'user';
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
              email,
              username,
              name,
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
          e instanceof PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          const target = (e.meta as { target?: string[] })?.target;
          if (target?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
          continue;
        }
        this.mapPrismaError(e);
      }
    }

    throw new ConflictException('Username already exists');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      this.logger.warn('Failed login – user not found');
      throw new UnauthorizedException('Operace se nezdařila.');
    }

    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      this.logger.warn('Failed login – disabled account');
      throw new UnauthorizedException('Account disabled');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn('Failed login – invalid password');
      throw new UnauthorizedException('Operace se nezdařila.');
    }

    // aktualizace lastLoginAt (DB) – ať se propíše i do response
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // JWT organizationId: chosen from this membership. Selection order:
    // (1) optional dto.organizationId if user is member of that org; (2) lastActiveMembershipId if set and valid;
    // (3) else first membership by createdAt asc (deterministic but may not be READY).
    let membership: Membership | null = null;
    if (dto.organizationId) {
      membership = await this.prisma.membership.findFirst({
        where: {
          userId: updatedUser.id,
          organizationId: dto.organizationId,
          deletedAt: null,
        },
      });
      if (!membership) {
        throw new UnauthorizedException(
          'Uživatel není členem zvolené organizace.',
        );
      }
      await this.prisma.user.update({
        where: { id: updatedUser.id },
        data: { lastActiveMembershipId: membership.id },
      });
    }
    if (!membership && updatedUser.lastActiveMembershipId) {
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
      const refreshTokenHash = hashToken(refreshToken);
      const tokenRow = await this.prisma.refreshToken.findFirst({
        where: { token: refreshTokenHash },
      });
      if (tokenRow && !matchesTokenHash(refreshToken, tokenRow.token)) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
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
      const refreshTokenHash = hashToken(refreshToken);
      const tokenRows = await this.prisma.refreshToken.findMany({
        where: {
          token: refreshTokenHash,
          revokedAt: null,
        },
        select: { id: true, token: true },
      });
      const matched = tokenRows.filter((row) =>
        matchesTokenHash(refreshToken, row.token),
      );
      if (matched.length > 0) {
        await this.prisma.refreshToken.updateMany({
          where: { id: { in: matched.map((row) => row.id) } },
          data: { revokedAt: new Date() },
        });
      }
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

    // CONTRACT: same effective platform admin as JWT payload (see jwt.strategy.ts). Guard unchanged.
    const isPlatformAdmin =
      (user.isPlatformAdmin ?? false) || user.systemRole === SystemRole.SUPERADMIN;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      isPlatformAdmin,
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
  async getMeContext(
    userId: string,
    claims?: { membershipId?: string | null; organizationId?: string | null },
  ): Promise<MeContext> {
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
            organization: { select: { name: true, type: true, status: true } },
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
          organization: { select: { name: true, type: true, status: true } },
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
        select: { id: true, role: true, organizationId: true, organization: { select: { name: true, type: true, status: true } } },
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

    const [readiness, bootstrap, derived] = activeMembership
      ? await Promise.all([
          getOrgReadiness(this.prisma, activeMembership.organizationId),
          getOrgBootstrap(this.prisma, activeMembership.organizationId),
          deriveOrgReadiness(this.prisma, activeMembership.organizationId),
        ])
      : [undefined, undefined, undefined];
    const organization = activeMembership
      ? (() => {
          const org = {
            id: activeMembership.organizationId,
            name: activeMembership.organization?.name,
            type: activeMembership.organization?.type ?? null,
            status: activeMembership.organization?.status ?? null,
          } as NonNullable<MeContext['organization']>;
          if (readiness !== undefined) {
            org.readiness = readiness;
          }
          if (bootstrap) {
            org.bootstrap = bootstrap;
          }
          if (derived) {
            org.readinessState = derived.state;
            org.canExecute = derived.canExecute;
            org.missing = derived.missing;
            org.evidence = derived.evidence;
            org.currentYearId = derived.currentYearId;
          }
          return org;
        })()
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
      // CONTRACT: effective platform admin (SUPERADMIN or DB flag). Must match jwt.strategy and getMe.
      isPlatformAdmin:
        (userRow.isPlatformAdmin ?? false) || userRow.systemRole === SystemRole.SUPERADMIN,
      createdAt: userRow.createdAt,
      lastLoginAt: userRow.lastLoginAt,
      memberships,
      organizationRole: activeMembership?.role ?? null,
      organizationId: activeMembership?.organizationId ?? null,
      needsOnboarding,
    };

    // -------------------------
    // Explicit auth context contract
    // -------------------------
    // Invariant (governance): platform context is determined solely by systemRole.
    // SUPERADMIN, DEVOPS and SUPPORT are always in 'platform' mode, regardless of memberships.
    const isPlatformAdminContext =
      userRow.systemRole === SystemRole.SUPERADMIN ||
      userRow.systemRole === SystemRole.DEVOPS ||
      userRow.systemRole === SystemRole.SUPPORT;

    let contextMode: AuthContextMode;
    let contextOrganizationId: string | null;

    if (isPlatformAdminContext) {
      contextMode = 'platform';
      contextOrganizationId = null;
    } else if (activeMembership) {
      contextMode = 'organization';
      contextOrganizationId = activeMembership.organizationId;
    } else {
      contextMode = 'personal';
      contextOrganizationId = null;
    }

    const roles = activeMembership ? [activeMembership.role] : [];
    const permissionKeys = Object.values(PermissionKey);
    const permissionMap: Record<string, boolean> = activeMembership
      ? await this.rbac.canUserMultiple(
          userId,
          activeMembership.organizationId,
          permissionKeys,
        )
      : {};
    const permissions = permissionKeys.filter((key) => permissionMap[key]);

    return {
      user: userContext,
      organization,
      membership,
      roles,
      permissions,
      context: {
        mode: contextMode,
        organizationId: contextOrganizationId,
      },
    };
  }

  async joinOrganization(userId: string, dto: JoinOrganizationDto) {
    throw new GoneException('Legacy join disabled. Use invitation token.');
  }


  async useOrganization(userId: string, orgId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        role: true,
        organizationId: true,
        organization: { select: { id: true, name: true, type: true, status: true } },
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
      context: ctx.context,
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
        organization: { select: { id: true, name: true, type: true, status: true } },
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
      context: ctx.context,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ctx?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, tokenVersion: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Operace se nezdařila.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
        tokenVersion: (user.tokenVersion ?? 0) + 1,
      },
    });
    await this.auditService.log({
      action: 'PASSWORD_CHANGED',
      entityType: AuditEntityType.USER,
      userId,
      entityId: userId,
      ipAddress: ctx?.ipAddress ?? null,
      userAgent: ctx?.userAgent ?? null,
    });
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    ctx?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!user) {
      this.logger.warn('Forgot password – user not found');
      return { ok: true };
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const expiresAt = addHours(new Date(), 1);
    await this.prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });
    await this.auditService.log({
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: AuditEntityType.USER,
      userId: user.id,
      entityId: user.id,
      ipAddress: ctx?.ipAddress ?? null,
      userAgent: ctx?.userAgent ?? null,
    });
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(
        `Password reset token for user ${user.id} (expires ${expiresAt.toISOString()}): ${token}`,
      );
    }
    return { ok: true };
  }

  async resetPasswordWithToken(
    dto: ResetPasswordDto,
    ctx?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<void> {
    const tokenHash = this.hashResetToken(dto.token);
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            tokenVersion: true,
          },
        },
      },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Operace se nezdařila.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const now = new Date();
    const nextVersion = (row.user.tokenVersion ?? 0) + 1;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, passwordChangedAt: now, tokenVersion: nextVersion },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: now },
      }),
    ]);
    await this.auditService.log({
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: AuditEntityType.USER,
      userId: row.userId,
      entityId: row.userId,
      ipAddress: ctx?.ipAddress ?? null,
      userAgent: ctx?.userAgent ?? null,
    });
  }
}
