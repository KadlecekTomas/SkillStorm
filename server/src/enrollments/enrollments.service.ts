import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EnrollmentStatus,
  OrganizationRole,
  SystemRole,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { hasAtLeastRole } from '@/shared/access.utils';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async assertValidAcademicYear(orgId: string, yearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, orgId },
      select: { id: true, orgId: true },
    });
    if (!year) {
      this.logger.warn({
        message: 'Academic year mismatch',
        orgId,
        yearId,
      });
      throw new ForbiddenException('Invalid academic year for organization');
    }
    return year;
  }

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

  async create(
    dto: { studentId: string; classSectionId: string; academicYearId: string },
    user: JwtPayload,
  ) {
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
    await this.assertValidAcademicYear(classSection.orgId, dto.academicYearId);
    if (classSection.yearId !== dto.academicYearId) {
      throw new BadRequestException('Enrollment year mismatch');
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
      if (existing.classSectionId === classSection.id) {
        const current = await this.prisma.enrollment.findUnique({
          where: { id: existing.id },
        });
        if (!current) {
          throw new NotFoundException('Enrollment not found.');
        }
        return current;
      }
      throw new ConflictException(
        'Student už je zapsán v jiné třídě v tomto školním roce.',
      );
    }

    try {
      return await this.prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId: classSection.id,
          yearId: classSection.yearId,
          orgId: classSection.orgId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const current = await this.prisma.enrollment.findFirst({
          where: {
            studentId: student.id,
            yearId: classSection.yearId,
            status: { not: EnrollmentStatus.LEFT },
          },
        });
        if (current?.classSectionId === classSection.id) return current;
        throw new ConflictException(
          'Student už je zapsán v jiné třídě v tomto školním roce.',
        );
      }
      if (err instanceof Error && err.message.includes('academic_year_id')) {
        throw new BadRequestException('Enrollment year mismatch');
      }
      throw err;
    }
  }

  async bulkCreate(
    dto: {
      classSectionId: string;
      academicYearId: string;
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
    await this.assertValidAcademicYear(classSection.orgId, dto.academicYearId);
    if (classSection.yearId !== dto.academicYearId) {
      throw new BadRequestException('Enrollment year mismatch');
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
      results: Array<{
        index: number;
        name: string;
        status: 'CREATED' | 'SKIPPED' | 'ERROR';
        message?: string;
        enrollmentId?: string;
        studentId?: string;
      }>;
    } = {
      enrolled: 0,
      createdUsers: 0,
      errors: [],
      enrollments: [],
      results: [],
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
          if (!email) {
            throw new BadRequestException('Email is required for invite-based enrollment.');
          }

          const userRecord = await tx.user.findUnique({
            where: { email },
            select: { id: true, name: true, deletedAt: true, anonymized: true },
          });

          if (userRecord && (userRecord.deletedAt || userRecord.anonymized)) {
            throw new ConflictException('Uživatel je neaktivní.');
          }

          if (!userRecord) {
            throw new ForbiddenException('Student must join via invite before enrollment.');
          }
          const createdUser = false;

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
            throw new ForbiddenException('Student must join via invite before enrollment.');
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
            if (existing.classSectionId === classSection.id) {
              return {
                enrollmentId: existing.id,
                studentId: student.id,
                createdUser,
                name: userRecord.name,
                status: 'SKIPPED' as const,
                message: 'Student je už zapsán v této třídě.',
              };
            }
            throw new ConflictException(
              'Student už je zapsán v jiné třídě v tomto školním roce.',
            );
          }

          try {
            const enrollment = await tx.enrollment.create({
              data: {
                studentId: student.id,
                classSectionId: classSection.id,
                yearId: classSection.yearId,
                orgId: classSection.orgId,
                status: EnrollmentStatus.ACTIVE,
              },
              select: { id: true },
            });

              return {
                enrollmentId: enrollment.id,
                studentId: student.id,
                createdUser,
                name: userRecord.name,
                status: 'CREATED' as const,
              };
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === 'P2002'
            ) {
              const current = await tx.enrollment.findFirst({
                where: {
                  studentId: student.id,
                  yearId: classSection.yearId,
                  status: { not: EnrollmentStatus.LEFT },
                },
              });
              if (current?.classSectionId === classSection.id) {
                return {
                  enrollmentId: current.id,
                  studentId: student.id,
                  createdUser,
                  name: userRecord.name,
                  status: 'SKIPPED' as const,
                  message: 'Student je už zapsán v této třídě.',
                };
              }
            }
            throw err;
          }
        });

        if (outcome.status === 'CREATED') {
          results.enrolled += 1;
        }
        if (outcome.createdUser) results.createdUsers += 1;
        results.enrollments.push({
          enrollmentId: outcome.enrollmentId,
          studentId: outcome.studentId,
          name: outcome.name,
        });
        results.results.push({
          index,
          name: rawName,
          status: outcome.status,
          enrollmentId: outcome.enrollmentId,
          studentId: outcome.studentId,
          ...(outcome.message ? { message: outcome.message } : {}),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Nepodařilo se zapsat studenta.';
        results.errors.push({ index, name: rawName, message });
        results.results.push({
          index,
          name: rawName,
          status: 'ERROR',
          message,
        });
      }
    }

    return results;
  }

  async listByClassSection(
    classSectionId: string,
    academicYearId: string,
    user: JwtPayload,
  ) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true, teacherId: true, yearId: true },
    });
    if (!classSection) throw new NotFoundException('Class section not found.');
    if (classSection.yearId !== academicYearId) {
      throw new BadRequestException('Školní rok neodpovídá třídě.');
    }

    if (user.systemRole === SystemRole.SUPERADMIN) {
      return this.prisma.enrollment.findMany({
        where: { classSectionId, status: { not: EnrollmentStatus.LEFT } },
        include: {
          student: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
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
        include: {
          student: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
      });
    }

    if (role && hasAtLeastRole(role, OrganizationRole.DIRECTOR)) {
      return this.prisma.enrollment.findMany({
        where: {
          classSectionId,
          status: { not: EnrollmentStatus.LEFT },
        },
        include: {
          student: {
            include: {
              membership: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
        },
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

  /**
   * Přestup studenta: změní classSectionId v rámci téhož školního roku.
   * Pouze pro aktivní školní rok. Nová třída musí být v témže roce.
   */
  async transfer(
    id: string,
    dto: { newClassSectionId: string },
    user: JwtPayload,
  ) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        classSection: {
          select: {
            orgId: true,
            yearId: true,
            academicYear: { select: { isCurrent: true } },
          },
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

    const newClass = await this.prisma.classSection.findUnique({
      where: { id: dto.newClassSectionId },
      select: { id: true, orgId: true, yearId: true },
    });
    if (!newClass) {
      throw new NotFoundException('Nová třída nenalezena.');
    }
    if (newClass.orgId !== enrollment.classSection.orgId) {
      throw new BadRequestException('Nová třída musí být ve stejné organizaci.');
    }
    if (newClass.yearId !== enrollment.classSection.yearId) {
      throw new BadRequestException(
        'Přestup je možný pouze v rámci téhož školního roku.',
      );
    }
    if (newClass.id === enrollment.classSectionId) {
      return this.prisma.enrollment.findUniqueOrThrow({ where: { id } });
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { classSectionId: dto.newClassSectionId },
    });
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
