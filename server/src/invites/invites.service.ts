import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { InvitationType, OrganizationRole } from '@prisma/client';
import { randomBytes, randomInt } from 'crypto';
import { addDays } from 'date-fns';
import type { CreateInviteDto } from './dto/create-invite.dto';
import type { AcceptInviteDto } from './dto/accept-invite.dto';
import type { InvitePreviewResponse } from './dto/preview-invite-response.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { bumpOrgVersion } from '@/shared/cache/org-cache.utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AuditEntityType } from '@prisma/client';
import { AuthService } from '@/auth/auth.service';
import { AuditService } from '@/audit/audit.service';
import { EventsService } from '@/events/events.service';

/** Minimum entropy in bits for invitation tokens (>= 128 bits). 24 bytes = 192 bits. */
const INVITATION_CODE_BYTES = 24;

/**
 * Alphabet for human-readable short codes.
 * Excludes visually ambiguous characters: O, 0, I, 1.
 */
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHORT_CODE_LENGTH = 6;

/** Failed-attempt window in milliseconds (10 minutes). */
const BLOCK_WINDOW_MS = 10 * 60 * 1000;
/** Maximum allowed failed attempts per key within BLOCK_WINDOW_MS before temporary block. */
const BLOCK_THRESHOLD = 10;

type FailedEntry = { count: number; firstAt: number };

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  /**
   * In-memory failed-attempt tracker keyed by `${ip}:${tokenPrefix}`.
   * Reset automatically after BLOCK_WINDOW_MS.
   * For multi-instance deployments, replace with Redis INCR + EXPIRE.
   */
  private readonly failedAttempts = new Map<string, FailedEntry>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    @Optional() private readonly eventsService?: EventsService,
  ) {}

  // -------------------------------------------------------------------------
  // Code generators
  // -------------------------------------------------------------------------

  /**
   * Long URL-safe token (>= 128-bit entropy). Used for link-based invites.
   * base64url produces URL-safe string; case-sensitive compare.
   */
  private generateToken(): string {
    return randomBytes(INVITATION_CODE_BYTES).toString('base64url');
  }

  /**
   * Short human-readable code for manual entry.
   * 6 characters from a 32-symbol alphabet: ~30 bits entropy.
   * Uses crypto.randomInt for cryptographic quality.
   */
  private generateShortCode(): string {
    let code = '';
    for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
      code += SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)];
    }
    return code;
  }

  // -------------------------------------------------------------------------
  // Brute-force protection
  // -------------------------------------------------------------------------

  private failKey(ip: string | undefined, tokenPrefix: string): string {
    return `${ip ?? 'unknown'}:${tokenPrefix}`;
  }

  /**
   * Record a failed invite attempt.
   * Logs to console, writes to audit log, and tracks for temporary block.
   * Throws TooManyRequestsException after BLOCK_THRESHOLD failures.
   */
  private async recordFailedAttempt(
    token: string | undefined,
    ip: string | undefined,
    userId?: string,
  ): Promise<void> {
    const trimmed = (token ?? '').trim();
    const prefix = trimmed ? trimmed.slice(0, 6) : 'empty';
    const key = this.failKey(ip, prefix);

    this.logger.warn('Invalid invite attempt', { token: prefix, ip: ip ?? null });

    // DB audit trail for every failed attempt
    try {
      await this.auditService.log({
        action: 'INVITE_FAILED',
        entityType: AuditEntityType.USER,
        userId: userId ?? null,
        organizationId: null,
        entityId: null,
        ipAddress: ip ?? null,
        metadata: { tokenPrefix: prefix },
      });
    } catch {
      // Audit failure must never block the primary response path
    }

    // In-memory fail counter
    const now = Date.now();
    const entry = this.failedAttempts.get(key);

    if (!entry || now - entry.firstAt > BLOCK_WINDOW_MS) {
      this.failedAttempts.set(key, { count: 1, firstAt: now });
      return;
    }

    entry.count += 1;

    if (entry.count >= BLOCK_THRESHOLD) {
      this.logger.warn('Invite attempt blocked (brute-force threshold reached)', {
        ip: ip ?? null,
        tokenPrefix: prefix,
        count: entry.count,
      });
      throw new ForbiddenException(InvitesService.INVALID_INVITATION_MESSAGE);
    }
  }

  // -------------------------------------------------------------------------
  // Invite creation
  // -------------------------------------------------------------------------

  async createInvite(
    dto: CreateInviteDto,
    user: JwtPayload,
  ): Promise<{ id: string; inviteToken: string; code: string; expiresAt: Date }> {
    const orgId = user.organizationId ?? null;
    if (!orgId) throw new ForbiddenException('Missing organization context');

    if (dto.type === InvitationType.STUDENT_CLASS) {
      if (!dto.classSectionId || !dto.yearId) {
        throw new BadRequestException(
          'classSectionId and yearId are required for STUDENT_CLASS invite',
        );
      }
      const cs = await this.prisma.classSection.findUnique({
        where: { id: dto.classSectionId },
        select: { id: true, orgId: true, yearId: true },
      });
      if (!cs || cs.orgId !== orgId) {
        throw new NotFoundException('Class section not found');
      }
      if (cs.yearId !== dto.yearId) {
        throw new BadRequestException('yearId does not match classSection.yearId');
      }
      if (dto.role && dto.role !== OrganizationRole.STUDENT) {
        throw new BadRequestException('STUDENT_CLASS invite must use STUDENT role.');
      }
    } else {
      if (dto.classSectionId || dto.yearId) {
        throw new BadRequestException('ORG_ONLY invite must not have classSectionId/yearId');
      }
      if (!dto.role) {
        throw new BadRequestException('ORG_ONLY invite must include role.');
      }
      if (
        dto.role !== OrganizationRole.TEACHER &&
        dto.role !== OrganizationRole.DIRECTOR &&
        dto.role !== OrganizationRole.STUDENT
      ) {
        throw new BadRequestException('ORG_ONLY invite role must be TEACHER, DIRECTOR, or STUDENT.');
      }
    }

    const expiresInDays = dto.expiresInDays ?? 7;
    const expiresAt = addDays(new Date(), expiresInDays);
    const token = this.generateToken();

    // Generate unique short code (retry on collision, max 5 attempts)
    let code: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = this.generateShortCode();
      const existing = await this.prisma.invite.findFirst({
        where: { code: candidate },
        select: { id: true },
      });
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      // Fallback: 8-char code if all 6-char candidates collided
      code = this.generateShortCode() + this.generateShortCode().slice(0, 2);
    }

    const maxUses = dto.maxUses ?? 1;
    const invite = await this.prisma.invite.create({
      data: {
        organizationId: orgId,
        type: dto.type,
        role:
          dto.type === InvitationType.STUDENT_CLASS
            ? OrganizationRole.STUDENT
            : (dto.role as OrganizationRole),
        classSectionId: dto.classSectionId ?? null,
        yearId: dto.yearId ?? null,
        token,
        code,
        expiresAt,
        maxUses,
      },
      select: { id: true, code: true, token: true, expiresAt: true },
    });

    return {
      id: invite.id,
      inviteToken: invite.token,
      code: invite.code ?? invite.token,
      expiresAt: invite.expiresAt,
    };
  }

  // -------------------------------------------------------------------------
  // Validation helpers
  // -------------------------------------------------------------------------

  /** Single message for any invalid token state — prevents leaking invite existence. */
  private static readonly INVALID_INVITATION_MESSAGE = 'Invalid or expired invitation';

  private validateInvitation(
    invite: {
      expiresAt: Date;
      revokedAt: Date | null;
      usedCount: number;
      maxUses: number;
    } | null,
  ): void {
    if (!invite) throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);

    const now = new Date();
    if (invite.revokedAt != null) {
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }
    if (invite.expiresAt < now) {
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }
    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }
  }

  private async validateOrganizationState(organizationId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        deletedAt: true,
        subscriptions: {
          where: { deletedAt: null },
          select: { status: true },
          take: 10,
        },
      },
    });
    if (!org || org.deletedAt != null) {
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }
    if (org.subscriptions.length > 0) {
      const hasActive = org.subscriptions.some((s) => s.status === 'ACTIVE');
      if (!hasActive) {
        throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Preview
  // -------------------------------------------------------------------------

  async preview(tokenOrCode: string, ip?: string): Promise<InvitePreviewResponse> {
    const trimmed = (tokenOrCode ?? '').trim();
    if (!trimmed) {
      await this.recordFailedAttempt(trimmed, ip);
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }

    const invite = await this.prisma.invite.findFirst({
      where: { OR: [{ token: trimmed }, { code: trimmed }] },
      include: {
        organization: { select: { id: true, name: true } },
        classSection: { select: { id: true, label: true, grade: true, section: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    if (!invite) {
      await this.recordFailedAttempt(trimmed, ip);
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }

    try {
      this.validateInvitation(invite);
    } catch {
      await this.recordFailedAttempt(trimmed, ip);
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }

    await this.validateOrganizationState(invite.organizationId);

    const res: InvitePreviewResponse = {
      type: invite.type as 'ORG_ONLY' | 'STUDENT_CLASS',
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
    };
    if (invite.role != null) res.role = invite.role;
    if (invite.classSectionId != null) res.classSectionId = invite.classSectionId;
    if (invite.yearId != null) res.yearId = invite.yearId;
    if (invite.classSection) {
      res.classLabel =
        invite.classSection.label ??
        `${invite.classSection.grade}:${invite.classSection.section}`;
    }
    if (invite.academicYear) res.yearLabel = invite.academicYear.label;
    return res;
  }

  // -------------------------------------------------------------------------
  // Accept
  // -------------------------------------------------------------------------

  async acceptInvite(
    userId: string,
    dto: AcceptInviteDto,
    ip?: string,
  ): Promise<{
    tokens: { accessToken: string; refreshToken: string };
    user: unknown;
    organization: { id: string; name: string } | null;
    membership: { id: string; role: string; organizationId: string } | null;
    roles: string[];
    permissions: string[];
    classSectionId?: string;
    yearId?: string;
  }> {
    const token = (dto.inviteToken ?? dto.token ?? dto.code ?? '').trim();
    if (!token) {
      await this.recordFailedAttempt(token, ip, userId);
      throw new ForbiddenException(InvitesService.INVALID_INVITATION_MESSAGE);
    }

    const invite = await this.prisma.invite.findFirst({
      where: { OR: [{ token }, { code: token }] },
      include: {
        organization: { select: { id: true, name: true } },
        classSection: { select: { id: true, orgId: true, yearId: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    if (!invite) {
      await this.recordFailedAttempt(token, ip, userId);
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }

    try {
      this.validateInvitation(invite);
    } catch {
      await this.recordFailedAttempt(token, ip, userId);
      throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
    }

    await this.validateOrganizationState(invite.organizationId);

    const orgId = invite.organizationId;
    const targetRole = invite.role;
    const classSectionId = invite.classSectionId ?? null;
    const yearId = invite.yearId ?? null;

    if (invite.type === InvitationType.STUDENT_CLASS) {
      if (!classSectionId || !yearId) {
        await this.recordFailedAttempt(token, ip, userId);
        throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
      }
      if (invite.role !== OrganizationRole.STUDENT) {
        await this.recordFailedAttempt(token, ip, userId);
        throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
      }
    } else {
      if (
        invite.role !== OrganizationRole.TEACHER &&
        invite.role !== OrganizationRole.DIRECTOR &&
        invite.role !== OrganizationRole.STUDENT
      ) {
        await this.recordFailedAttempt(token, ip, userId);
        throw new BadRequestException(InvitesService.INVALID_INVITATION_MESSAGE);
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
        select: { id: true, role: true, organizationId: true },
      });
      if (existing) {
        return { membership: existing, idempotent: true };
      }

      const membership = await this.authService.createMembershipFromInvite(
        tx,
        userId,
        {
          id: invite.id,
          organizationId: invite.organizationId,
          role: invite.role,
          type: invite.type,
          classSectionId: invite.classSectionId,
          yearId: invite.yearId,
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          revokedAt: invite.revokedAt,
        },
        new Date(),
        { token, ...(ip ? { ip } : {}) },
      );

      return { membership, idempotent: false };
    });

    await bumpOrgVersion(this.cache, orgId);

    const org =
      invite.organization ??
      (await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      }));

    if (!result.idempotent) {
      await this.auditService.log({
        action: 'INVITE_ACCEPTED',
        entityType: AuditEntityType.ORGANIZATION,
        userId,
        organizationId: orgId,
        entityId: result.membership.id,
        metadata: { role: targetRole, classSectionId, yearId },
      });

      // Emit SSE event so teachers see the new student immediately
      if (this.eventsService && targetRole === OrganizationRole.STUDENT) {
        this.eventsService.emitStudentJoined(orgId, {
          organizationId: orgId,
          membershipId: result.membership.id,
          ...(classSectionId != null ? { classSectionId } : {}),
          ...(yearId != null ? { yearId } : {}),
        });
      }
    }

    const tokens = await this.authService.issueTokensForMembership(
      userId,
      result.membership.id,
    );
    const ctx = await this.authService.getMeContext(userId, { organizationId: orgId });

    return {
      tokens,
      user: ctx.user,
      organization: org,
      membership: {
        id: result.membership.id,
        role: result.membership.role,
        organizationId: result.membership.organizationId,
      },
      roles: ctx.roles ?? [],
      permissions: ctx.permissions ?? [],
      ...(classSectionId && { classSectionId }),
      ...(yearId && { yearId }),
    };
  }
}
