import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEntityType,
  EnrollmentStatus,
  Prisma,
  SystemRole,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(id: string, dto: UpdateStudentDto, user: JwtPayload) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        membership: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        enrollments: {
          where: { status: { not: EnrollmentStatus.LEFT } },
          include: { academicYear: true, classSection: true },
        },
      },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException('Žák nebyl nalezen.');
    }
    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      (!user.organizationId || user.organizationId !== student.orgId)
    ) {
      throw new ForbiddenException('Žáka z jiné školy nelze upravit.');
    }

    const name = dto.name?.trim();
    const email = dto.email?.trim().toLowerCase();
    if (dto.name !== undefined && (!name || name.length < 2)) {
      throw new BadRequestException('Jméno musí mít alespoň 2 znaky.');
    }

    let targetClass: { id: string; orgId: string; yearId: string } | null = null;
    if (dto.classSectionId) {
      const found = await this.prisma.classSection.findUnique({
        where: { id: dto.classSectionId },
        select: {
          id: true,
          orgId: true,
          yearId: true,
          academicYear: { select: { isCurrent: true } },
        },
      });
      if (!found || found.orgId !== student.orgId) {
        throw new BadRequestException('Vybraná třída nepatří do této školy.');
      }
      if (!found.academicYear?.isCurrent) {
        throw new BadRequestException('Žáka lze přesunout jen v aktuálním školním roce.');
      }
      targetClass = { id: found.id, orgId: found.orgId, yearId: found.yearId };
    }

    const currentEnrollment = student.enrollments.find((item) => item.academicYear.isCurrent) ?? null;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (name !== undefined || email !== undefined) {
          await tx.user.update({
            where: { id: student.membership.userId },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(email !== undefined ? { email } : {}),
            },
          });
        }

        if (dto.studentNumber !== undefined || dto.externalId !== undefined) {
          await tx.student.update({
            where: { id },
            data: {
              ...(dto.studentNumber !== undefined
                ? { studentNumber: dto.studentNumber.trim() || null }
                : {}),
              ...(dto.externalId !== undefined
                ? { externalId: dto.externalId.trim() || null }
                : {}),
            },
          });
        }

        if (targetClass && currentEnrollment?.classSectionId !== targetClass.id) {
          if (currentEnrollment) {
            await tx.enrollment.update({
              where: { id: currentEnrollment.id },
              data: {
                classSectionId: targetClass.id,
                yearId: targetClass.yearId,
                orgId: targetClass.orgId,
                status: EnrollmentStatus.ACTIVE,
              },
            });
          } else {
            await tx.enrollment.create({
              data: {
                studentId: id,
                classSectionId: targetClass.id,
                yearId: targetClass.yearId,
                orgId: targetClass.orgId,
                status: EnrollmentStatus.ACTIVE,
              },
            });
          }
        }

        const changedFields = Object.fromEntries(
          Object.entries(dto).filter(([, value]) => value !== undefined),
        ) as Prisma.InputJsonObject;
        await tx.auditLog.create({
          data: {
            userId: user.userId,
            organizationId: student.orgId,
            entityType: AuditEntityType.ORGANIZATION,
            entityId: id,
            action: 'STUDENT_ADMIN_UPDATE',
            changedFields,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Tento e-mail už používá jiný účet.');
      }
      throw error;
    }

    return this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        studentNumber: true,
        externalId: true,
        membership: {
          select: { user: { select: { id: true, name: true, email: true } } },
        },
        enrollments: {
          where: { status: { not: EnrollmentStatus.LEFT } },
          select: {
            id: true,
            classSectionId: true,
            yearId: true,
            academicYear: { select: { isCurrent: true, label: true } },
            classSection: { select: { id: true, label: true, grade: true, section: true } },
          },
        },
      },
    });
  }
}
