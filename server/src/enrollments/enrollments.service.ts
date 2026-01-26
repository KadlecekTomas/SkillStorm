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
  OrganizationRole,
  SystemRole,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { hasAtLeastRole } from '@/shared/access.utils';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMembership(user: JwtPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: user.organizationId,
        deletedAt: null,
      },
      select: { id: true, role: true, organizationId: true },
    });
    if (!membership) throw new ForbiddenException('Access denied');
    return membership;
  }

  async create(dto: { studentId: string; classSectionId: string }, user: JwtPayload) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, orgId: true, deletedAt: true, membershipId: true },
    });
    if (!student || student.deletedAt) {
      throw new NotFoundException('Student not found.');
    }

    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: { id: true, orgId: true, yearId: true, academicYear: { select: { isCurrent: true } } },
    });
    if (!classSection) {
      throw new NotFoundException('Class section not found.');
    }

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      student.orgId !== user.organizationId
    ) {
      throw new ForbiddenException('Foreign organization.');
    }
    if (student.orgId !== classSection.orgId) {
      throw new BadRequestException('Student and class section are in different organizations.');
    }
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze zapisovat do uzavřeného školního roku.');
    }

    const membership = await this.prisma.membership.findUnique({
      where: { id: student.membershipId },
      select: { deletedAt: true },
    });
    if (!membership || membership.deletedAt) {
      throw new BadRequestException('Student membership is inactive.');
    }

    const existing = await this.prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        yearId: classSection.yearId,
        status: { not: EnrollmentStatus.LEFT },
      },
      select: { id: true, classSectionId: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.classSectionId === classSection.id
          ? 'Student je už zapsán v této třídě.'
          : 'Student už je zapsán v jiné třídě v tomto školním roce.',
      );
    }

    return this.prisma.enrollment.create({
      data: {
        studentId: student.id,
        classSectionId: classSection.id,
        yearId: classSection.yearId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  async bulkCreate(
    dto: {
      classSectionId: string;
      entries: Array<{ name: string; email?: string }>;
    },
    user: JwtPayload,
  ) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: {
        id: true,
        orgId: true,
        yearId: true,
        academicYear: { select: { isCurrent: true } },
      },
    });
    if (!classSection) {
      throw new NotFoundException('Class section not found.');
    }

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId !== classSection.orgId
    ) {
      throw new ForbiddenException('Foreign organization.');
    }
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze zapisovat do uzavřeného školního roku.');
    }

    const results: {
      enrolled: number;
      createdUsers: number;
      errors: Array<{ index: number; name: string; message: string }>;
      enrollments: Array<{ enrollmentId: string; studentId: string; name: string }>;
    } = {
      enrolled: 0,
      createdUsers: 0,
      errors: [],
      enrollments: [],
    };

    for (const [index, entry] of dto.entries.entries()) {
      const rawName = entry.name?.trim() ?? '';
      if (!rawName) {
        results.errors.push({
          index,
          name: '',
          message: 'Chybí jméno studenta.',
        });
        continue;
      }
      const email = entry.email?.trim().toLowerCase() || undefined;

      try {
        const outcome = await this.prisma.$transaction(async (tx) => {
          let userRecord = email
            ? await tx.user.findUnique({
                where: { email },
                select: { id: true, name: true, deletedAt: true, anonymized: true },
              })
            : null;

          if (userRecord && (userRecord.deletedAt || userRecord.anonymized)) {
            throw new ConflictException('Uživatel je neaktivní.');
          }

          let createdUser = false;
          if (!userRecord) {
            const password = randomBytes(12).toString('hex');
            const passwordHash = await bcrypt.hash(password, 10);
            userRecord = await tx.user.create({
              data: {
                name: rawName,
                email: email ?? null,
                passwordHash,
              },
              select: { id: true, name: true },
            });
            createdUser = true;
          }

          let membership = await tx.membership.findUnique({
            where: {
              userId_organizationId: {
                userId: userRecord.id,
                organizationId: classSection.orgId,
              },
            },
            select: { id: true, role: true },
          });

          if (!membership) {
            membership = await tx.membership.create({
              data: {
                userId: userRecord.id,
                organizationId: classSection.orgId,
                role: OrganizationRole.STUDENT,
              },
              select: { id: true, role: true },
            });
          }

          if (membership.role !== OrganizationRole.STUDENT) {
            throw new ConflictException('Uživatel nemá roli STUDENT.');
          }

          let student = await tx.student.findUnique({
            where: { membershipId: membership.id },
            select: { id: true },
          });
          if (!student) {
            student = await tx.student.create({
              data: {
                membershipId: membership.id,
                orgId: classSection.orgId,
              },
              select: { id: true },
            });
          }

          const existing = await tx.enrollment.findFirst({
            where: {
              studentId: student.id,
              yearId: classSection.yearId,
              status: { not: EnrollmentStatus.LEFT },
            },
            select: { id: true, classSectionId: true },
          });
          if (existing) {
            throw new ConflictException(
              existing.classSectionId === classSection.id
                ? 'Student je už zapsán v této třídě.'
                : 'Student už je zapsán v jiné třídě v tomto školním roce.',
            );
          }

          const enrollment = await tx.enrollment.create({
            data: {
              studentId: student.id,
              classSectionId: classSection.id,
              yearId: classSection.yearId,
              status: EnrollmentStatus.ACTIVE,
            },
            select: { id: true },
          });

          return { enrollmentId: enrollment.id, studentId: student.id, createdUser, name: userRecord.name };
        });

        results.enrolled += 1;
        if (outcome.createdUser) results.createdUsers += 1;
        results.enrollments.push({
          enrollmentId: outcome.enrollmentId,
          studentId: outcome.studentId,
          name: outcome.name,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nepodařilo se zapsat studenta.';
        results.errors.push({ index, name: rawName, message });
      }
    }

    return results;
  }

  async listByClassSection(classSectionId: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true, teacherId: true },
    });
    if (!classSection) throw new NotFoundException('Class section not found.');

    if (user.systemRole === SystemRole.SUPERADMIN) {
      return this.prisma.enrollment.findMany({
        where: { classSectionId, status: { not: EnrollmentStatus.LEFT } },
        include: { student: { include: { membership: { include: { user: true } } } } },
      });
    }

    if (!user.organizationId || user.organizationId !== classSection.orgId) {
      throw new ForbiddenException('Foreign organization.');
    }

    const membership = await this.getMembership(user);
    const role = membership.role ?? user.organizationRole ?? null;

    if (role === OrganizationRole.TEACHER) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { membershipId: membership.id, deletedAt: null },
        select: { id: true },
      });
      if (!teacher || classSection.teacherId !== teacher.id) {
        throw new ForbiddenException('Teacher has no access to this class.');
      }
      return this.prisma.enrollment.findMany({
        where: {
          classSectionId,
          status: { not: EnrollmentStatus.LEFT },
        },
        include: { student: { include: { membership: { include: { user: true } } } } },
      });
    }

    if (role && hasAtLeastRole(role, OrganizationRole.DIRECTOR)) {
      return this.prisma.enrollment.findMany({
        where: {
          classSectionId,
          status: { not: EnrollmentStatus.LEFT },
        },
        include: { student: { include: { membership: { include: { user: true } } } } },
      });
    }

    if (role === OrganizationRole.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { membershipId: membership.id, deletedAt: null },
        select: { id: true },
      });
      if (!student) throw new ForbiddenException('Student not found.');

      return this.prisma.enrollment.findMany({
        where: {
          classSectionId,
          studentId: student.id,
          status: { not: EnrollmentStatus.LEFT },
        },
      });
    }

    throw new ForbiddenException('Access denied.');
  }

  async softDelete(id: string, user: JwtPayload) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        classSection: {
          select: { orgId: true, academicYear: { select: { isCurrent: true } } },
        },
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found.');

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      enrollment.classSection.orgId !== user.organizationId
    ) {
      throw new ForbiddenException('Foreign organization.');
    }
    if (!enrollment.classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { status: EnrollmentStatus.LEFT },
    });
  }
}
