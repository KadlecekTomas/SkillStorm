import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EnrollmentStatus,
  InvitationType,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';
import type { CreateInviteDto } from './dto/create-invite.dto';
import type { AcceptInviteDto } from './dto/accept-invite.dto';
import type { InvitePreviewResponse } from './dto/preview-invite-response.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { bumpOrgVersion } from '@/shared/cache/org-cache.utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';
import { isUUID } from 'class-validator';
import { AuthService } from '@/auth/auth.service';
import { AuditService } from '@/audit/audit.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  private generateCode(): string {
    return randomBytes(24).toString('base64url');
  }

  async createInvite(
    dto: CreateInviteDto,
    user: JwtPayload,
  ): Promise<{ id: string; code: string; expiresAt: Date }> {
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
    } else {
      if (dto.classSectionId || dto.yearId) {
        throw new BadRequestException('ORG_ONLY invite must not have classSectionId/yearId');
      }
    }

    const expiresInDays = dto.expiresInDays ?? 7;
    const expiresAt = addDays(new Date(), expiresInDays);
    const code = this.generateCode();

    const invite = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        type: dto.type,
        role: dto.role ?? null,
        classSectionId: dto.classSectionId ?? null,
        yearId: dto.yearId ?? null,
        code,
        expiresAt,
        createdByMembershipId: user.membershipId ?? null,
      },
      select: { id: true, code: true, expiresAt: true },
    });
    return invite;
  }

  async preview(code: string): Promise<InvitePreviewResponse> {
    const trimmed = code?.trim();
    if (!trimmed) throw new BadRequestException('Code is required');

    const invite = await this.prisma.invitation.findUnique({
      where: { code: trimmed },
      include: {
        organization: { select: { id: true, name: true } },
        classSection: { select: { id: true, label: true, grade: true, section: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    if (invite) {
      if (invite.expiresAt < new Date()) {
        throw new BadRequestException('Invitation has expired');
      }
      const res: InvitePreviewResponse = {
        type: invite.type as 'ORG_ONLY' | 'STUDENT_CLASS',
        organizationId: invite.organizationId,
        organizationName: invite.organization.name,
      };
      if (invite.role != null) res.role = invite.role;
      if (invite.classSectionId != null) res.classSectionId = invite.classSectionId;
      if (invite.yearId != null) res.yearId = invite.yearId;
      if (invite.classSection) {
        res.classLabel = invite.classSection.label ?? `${invite.classSection.grade}:${invite.classSection.section}`;
      }
      if (invite.academicYear) res.yearLabel = invite.academicYear.label;
      return res;
    }

    if (isUUID(trimmed)) {
      const org = await this.prisma.organization.findUnique({
        where: { id: trimmed },
        select: { id: true, name: true },
      });
      if (org) {
        return {
          type: 'ORG_ONLY',
          organizationId: org.id,
          organizationName: org.name,
        };
      }
    }

    throw new NotFoundException('Invitation not found');
  }

  async acceptInvite(
    userId: string,
    dto: AcceptInviteDto,
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
    const invite = await this.prisma.invitation.findUnique({
      where: { code: dto.code.trim() },
      include: {
        organization: { select: { id: true, name: true } },
        classSection: { select: { id: true, orgId: true, yearId: true } },
      },
    });

    let orgId: string;
    let targetRole: OrganizationRole;
    let classSectionId: string | null = null;
    let yearId: string | null = null;

    if (invite) {
      if (invite.expiresAt < new Date()) {
        throw new BadRequestException('Invitation has expired');
      }
      orgId = invite.organizationId;
      if (invite.type === InvitationType.STUDENT_CLASS) {
        targetRole = OrganizationRole.STUDENT;
        classSectionId = invite.classSectionId;
        yearId = invite.yearId;
        if (!classSectionId || !yearId) {
          throw new BadRequestException('STUDENT_CLASS invite missing classSectionId or yearId');
        }
      } else {
        const role = (dto.role ?? invite.role) as OrganizationRole | null;
        if (!role || (role !== OrganizationRole.TEACHER && role !== OrganizationRole.DIRECTOR)) {
          throw new BadRequestException('ORG_ONLY invite requires role TEACHER or DIRECTOR');
        }
        targetRole = role;
      }
    } else if (isUUID(dto.code.trim())) {
      const org = await this.prisma.organization.findUnique({
        where: { id: dto.code.trim() },
        select: { id: true, name: true },
      });
      if (!org) throw new NotFoundException('Invitation not found');
      orgId = org.id;
      if (dto.role === OrganizationRole.STUDENT) {
        throw new BadRequestException(
          'Student join requires a class-bound invite (code with classSectionId+yearId). Use invite link from your teacher.',
        );
      }
      const role = dto.role ?? OrganizationRole.TEACHER;
      if (role !== OrganizationRole.TEACHER && role !== OrganizationRole.DIRECTOR) {
        throw new BadRequestException('Legacy org join requires role TEACHER or DIRECTOR');
      }
      targetRole = role;
    } else {
      throw new NotFoundException('Invitation not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: orgId },
        },
        select: { id: true, role: true },
      });
      if (existing) {
        throw new ConflictException('User is already a member of this organization');
      }

      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: orgId,
          role: targetRole,
        },
        select: { id: true, role: true, organizationId: true },
      });

      if (targetRole === OrganizationRole.TEACHER) {
        const teacher = await tx.teacher.create({
          data: {
            membershipId: membership.id,
            organizationId: orgId,
          },
          select: { id: true },
        });
      }

      if (targetRole === OrganizationRole.STUDENT && classSectionId && yearId) {
        const classSection = await tx.classSection.findUnique({
          where: { id: classSectionId },
          select: { id: true, orgId: true, yearId: true },
        });
        if (!classSection || classSection.orgId !== orgId) {
          throw new BadRequestException('Class section not found or does not belong to organization');
        }
        if (classSection.yearId !== yearId) {
          throw new BadRequestException('yearId does not match classSection.yearId');
        }

        const academicYear = await tx.academicYear.findUnique({
          where: { id: yearId },
          select: { isCurrent: true },
        });
        if (!academicYear || !academicYear.isCurrent) {
          throw new BadRequestException('Academic year is not active');
        }

        let student = await tx.student.findFirst({
          where: { membershipId: membership.id },
          select: { id: true },
        });
        if (!student) {
          student = await tx.student.create({
            data: {
              membershipId: membership.id,
              orgId: orgId,
            },
            select: { id: true },
          });
        }

        const existingEnrollment = await tx.enrollment.findFirst({
          where: {
            studentId: student.id,
            yearId,
            status: { not: EnrollmentStatus.LEFT },
          },
          select: { id: true, classSectionId: true },
        });
        if (existingEnrollment) {
          if (existingEnrollment.classSectionId !== classSectionId) {
            throw new ConflictException('Student is already enrolled in another class for this year');
          }
        } else {
          await tx.enrollment.create({
            data: {
              studentId: student.id,
              classSectionId,
              yearId,
              orgId: orgId,
              status: EnrollmentStatus.ACTIVE,
            },
          });
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { lastActiveMembershipId: membership.id },
      });

      return { membership };
    });

    await bumpOrgVersion(this.cache, orgId);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    await this.auditService.log({
      action: 'INVITE_ACCEPTED',
      entityType: AuditEntityType.ORGANIZATION,
      userId,
      organizationId: orgId,
      entityId: result.membership.id,
      metadata: { role: targetRole, classSectionId, yearId },
    });

    const tokens = await this.authService.issueTokensForMembership(
      userId,
      result.membership.id,
    );
    const ctx = await this.authService.getMeContext(userId, {
      organizationId: orgId,
    });

    return {
      tokens,
      user: ctx.user,
      organization: org,
      membership: result.membership,
      roles: ctx.roles ?? [],
      permissions: ctx.permissions ?? [],
      ...(classSectionId && { classSectionId }),
      ...(yearId && { yearId }),
    };
  }
}
