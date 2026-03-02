import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { deriveCzechSchoolYearFromStartYear } from '@/shared/czech-school-year';
import { Prisma, SystemRole } from '@prisma/client';

/** Thrown when DB unique constraint prevents multiple current years (race or concurrent activate). */
export const MULTIPLE_CURRENT_YEARS_FOR_ORG = 'MULTIPLE_CURRENT_YEARS_FOR_ORG';
/** Thrown when create(isActive=true) is called while a non-deleted current year already exists. */
export const CURRENT_YEAR_ALREADY_EXISTS = 'CURRENT_YEAR_ALREADY_EXISTS';

/** Canonical: no academic year with isCurrent=true for the org. */
export const NO_CURRENT_ACADEMIC_YEAR = 'NO_CURRENT_ACADEMIC_YEAR';
/** Canonical: more than one academic year with isCurrent=true (guard/service check). */
export const MULTIPLE_CURRENT_ACADEMIC_YEARS = 'MULTIPLE_CURRENT_ACADEMIC_YEARS';
/** Deprecated alias; emit alongside new code for one release. */
export const NO_ACTIVE_ACADEMIC_YEAR_DEPRECATED = 'NO_ACTIVE_ACADEMIC_YEAR';
export const MULTIPLE_ACTIVE_ACADEMIC_YEARS_DEPRECATED = 'MULTIPLE_ACTIVE_ACADEMIC_YEARS';

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

    // Pre-flight guard: if caller explicitly requests isActive=true, reject when a
    // non-deleted current year already exists. Use activate() to switch years instead.
    if (dto.isActive === true) {
      const existing = await this.prisma.academicYear.findFirst({
        where: { orgId, isCurrent: true, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException({
          code: CURRENT_YEAR_ALREADY_EXISTS,
          message: 'Organizace již má aktivní školní rok. Pro přepnutí použijte endpoint /activate.',
        });
      }
    }

    let created;
    try {
      // Invariant: at most one current year per org. Set others to isCurrent=false before setting one to true.
      created = await this.prisma.$transaction(async (tx) => {
        const existingCurrent = await tx.academicYear.findFirst({
          where: { orgId, isCurrent: true },
          select: { id: true },
        });

        const shouldSetCurrent = dto.isActive === true || !existingCurrent;
        if (shouldSetCurrent) {
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
            isCurrent: shouldSetCurrent,
          },
        });
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          statusCode: 409,
          code: MULTIPLE_CURRENT_YEARS_FOR_ORG,
          message: 'Another academic year was set as current concurrently.',
        });
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
      // This transaction is safe due to DB partial unique index (academic_years_one_current_per_org).
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
        throw new ConflictException({
          statusCode: 409,
          code: MULTIPLE_CURRENT_YEARS_FOR_ORG,
          message: 'Another academic year was set as current concurrently.',
        });
      }
      throw err;
    }

    return this.mapYear(updated);
  }

  async getCurrentForOrg(orgId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true, orgId: true, isCurrent: true },
    });
    if (!year) {
      throw new NotFoundException('Current academic year was not found.');
    }
    return year;
  }

  async getCurrentForOrgOrFail(orgId: string | null) {
    if (!orgId) {
      throw new ForbiddenException('Missing organization context.');
    }
    const years = await this.prisma.academicYear.findMany({
      where: { orgId, isCurrent: true },
      orderBy: { startsAt: 'desc' },
    });

    if (years.length === 0) {
      throw new ConflictException({
        message: 'Current academic year is not configured for this organization.',
        meta: {
          code: NO_CURRENT_ACADEMIC_YEAR,
          deprecatedCode: NO_ACTIVE_ACADEMIC_YEAR_DEPRECATED,
        },
      });
    }

    if (years.length > 1) {
      throw new ConflictException({
        message: 'Multiple academic years are marked as current.',
        meta: {
          code: MULTIPLE_CURRENT_ACADEMIC_YEARS,
          deprecatedCode: MULTIPLE_ACTIVE_ACADEMIC_YEARS_DEPRECATED,
        },
      });
    }

    const year = years[0];
    if (!year) {
      throw new ConflictException({
        message: 'Current academic year is not configured for this organization.',
        meta: { code: 'ACADEMIC_YEAR_INVARIANT_BROKEN' },
      });
    }

    return this.mapYear(year);
  }

  async assertOrgHasExactlyOneCurrentYear(orgId: string | null) {
    if (!orgId) {
      throw new ForbiddenException('Missing organization context.');
    }
    const count = await this.prisma.academicYear.count({
      where: { orgId, isCurrent: true },
    });

    if (count === 0) {
      throw new ConflictException({
        message: 'Current academic year is not configured for this organization.',
        meta: {
          code: NO_CURRENT_ACADEMIC_YEAR,
          deprecatedCode: NO_ACTIVE_ACADEMIC_YEAR_DEPRECATED,
        },
      });
    }

    if (count > 1) {
      throw new ConflictException({
        message: 'Multiple academic years are marked as current.',
        meta: {
          code: MULTIPLE_CURRENT_ACADEMIC_YEARS,
          deprecatedCode: MULTIPLE_ACTIVE_ACADEMIC_YEARS_DEPRECATED,
        },
      });
    }
  }

  async createDefaultAcademicYearIfMissing(orgId: string): Promise<void> {
    const existingCurrent = await this.prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (existingCurrent) return;

    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const startYear = month >= 9 ? year : year - 1;
    const endYear = startYear + 1;

    const label = `${startYear}/${endYear}`;
    const startsAt = new Date(`${startYear}-09-01T00:00:00.000Z`);
    const endsAt = new Date(`${endYear}-08-31T23:59:59.999Z`);

    await this.prisma.$transaction(async (tx) => {
      const currentInTx = await tx.academicYear.findFirst({
        where: { orgId, isCurrent: true },
        select: { id: true },
      });
      if (currentInTx) return;

      await tx.academicYear.updateMany({
        where: { orgId },
        data: { isCurrent: false },
      });

      await tx.academicYear.upsert({
        where: { orgId_label: { orgId, label } },
        create: {
          orgId,
          label,
          startsAt,
          endsAt,
          isCurrent: true,
        },
        update: {
          startsAt,
          endsAt,
          isCurrent: true,
        },
      });
    });
  }
}
