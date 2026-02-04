import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { deriveCzechSchoolYearFromStartYear } from '@/shared/czech-school-year';
import { Prisma, SystemRole } from '@prisma/client';

type AcademicYearResponse = {
  id: string;
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
};

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveOrgId(user: JwtPayload): string {
    if (user.systemRole === SystemRole.SUPERADMIN && user.organizationId) {
      return user.organizationId;
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }
    return user.organizationId;
  }

  private mapYear(year: {
    id: string;
    orgId: string;
    label: string;
    startsAt: Date;
    endsAt: Date;
    isCurrent: boolean;
    createdAt: Date;
  }): AcademicYearResponse {
    return {
      id: year.id,
      organizationId: year.orgId,
      name: year.label,
      startDate: year.startsAt,
      endDate: year.endsAt,
      isActive: year.isCurrent,
      createdAt: year.createdAt,
    };
  }

  async list(user: JwtPayload): Promise<AcademicYearResponse[]> {
    const orgId = this.resolveOrgId(user);
    const years = await this.prisma.academicYear.findMany({
      where: { orgId },
      orderBy: [{ startsAt: 'desc' }, { label: 'desc' }],
    });
    return years.map((year) => this.mapYear(year));
  }

  async create(dto: CreateAcademicYearDto, user: JwtPayload) {
    const orgId = this.resolveOrgId(user);
    const { startDate: startsAt, endDate: endsAt, label } =
      deriveCzechSchoolYearFromStartYear(dto.startYear);

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const existingActive = await tx.academicYear.findFirst({
          where: { orgId, isCurrent: true },
          select: { id: true },
        });

        const shouldActivate = dto.isActive === true || !existingActive;
        if (shouldActivate) {
          await tx.academicYear.updateMany({
            where: { orgId, isCurrent: true },
            data: { isCurrent: false },
          });
        }

        return tx.academicYear.create({
          data: {
            orgId,
            label,
            startsAt,
            endsAt,
            isCurrent: shouldActivate,
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Aktivní školní rok už existuje.');
      }
      throw err;
    }

    return this.mapYear(created);
  }

  async activate(id: string, user: JwtPayload) {
    const orgId = this.resolveOrgId(user);
    const year = await this.prisma.academicYear.findUnique({
      where: { id },
      select: { id: true, orgId: true },
    });
    if (!year) throw new NotFoundException('Školní rok nebyl nalezen.');
    if (year.orgId !== orgId) {
      throw new ForbiddenException('Školní rok není ve vaší organizaci.');
    }

    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { orgId, isCurrent: true },
          data: { isCurrent: false },
        });
        return tx.academicYear.update({
          where: { id },
          data: { isCurrent: true },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Aktivní školní rok už existuje.');
      }
      throw err;
    }

    return this.mapYear(updated);
  }

  async getActiveForOrg(orgId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true, orgId: true, isCurrent: true },
    });
    if (!year) {
      throw new NotFoundException('Aktivní školní rok nebyl nalezen.');
    }
    return year;
  }

  async getActiveForOrgOrFail(orgId: string | null) {
    if (!orgId) {
      throw new ForbiddenException('Missing organization context.');
    }
    const years = await this.prisma.academicYear.findMany({
      where: { orgId, isCurrent: true },
      orderBy: { startsAt: 'desc' },
    });

    if (years.length === 0 || years.length > 1) {
      throw new InternalServerErrorException({
        code: 'ACADEMIC_YEAR_INVARIANT_BROKEN',
        message:
          years.length === 0
            ? 'Active academic year is not configured for this organization.'
            : 'Multiple academic years are marked as active.',
      });
    }

    const year = years[0];
    if (!year) {
      throw new InternalServerErrorException({
        code: 'ACADEMIC_YEAR_INVARIANT_BROKEN',
        message: 'Active academic year is not configured for this organization.',
      });
    }

    return this.mapYear(year);
  }

  async assertOrgHasExactlyOneActiveYear(orgId: string | null) {
    if (!orgId) {
      throw new ForbiddenException('Missing organization context.');
    }
    const count = await this.prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });

    if (count === 0) {
      throw new ConflictException({
        message: 'Active academic year is not configured for this organization.',
        meta: { code: 'NO_ACTIVE_ACADEMIC_YEAR' },
      });
    }

    if (count > 1) {
      throw new ConflictException({
        message: 'Multiple academic years are marked as active.',
        meta: { code: 'MULTIPLE_ACTIVE_ACADEMIC_YEARS' },
      });
    }
  }
}
