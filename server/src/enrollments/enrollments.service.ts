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
  Prisma,
  SystemRole,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';

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
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (
        user.organizationRole !== OrganizationRole.DIRECTOR &&
        user.organizationRole !== OrganizationRole.OWNER
      ) {
        throw new ForbiddenException('Only director/owner can enroll students.');
      }
    }

    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
      select: { id: true, orgId: true, deletedAt: true, membershipId: true },
    });
    if (!student || student.deletedAt) {
      throw new NotFoundException('Student not found.');
    }

    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: { id: true, orgId: true, yearId: true },
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

    const membership = await this.prisma.membership.findUnique({
      where: { id: student.membershipId },
      select: { deletedAt: true },
    });
    if (!membership || membership.deletedAt) {
      throw new BadRequestException('Student membership is inactive.');
    }

    try {
      return await this.prisma.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId: classSection.id,
          yearId: classSection.yearId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Enrollment already exists for this year.');
      }
      throw e;
    }
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
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (
        user.organizationRole !== OrganizationRole.DIRECTOR &&
        user.organizationRole !== OrganizationRole.OWNER
      ) {
        throw new ForbiddenException('Only director/owner can remove enrollments.');
      }
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id },
      include: { classSection: { select: { orgId: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found.');

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      enrollment.classSection.orgId !== user.organizationId
    ) {
      throw new ForbiddenException('Foreign organization.');
    }

    return this.prisma.enrollment.update({
      where: { id },
      data: { status: EnrollmentStatus.LEFT },
    });
  }
}
