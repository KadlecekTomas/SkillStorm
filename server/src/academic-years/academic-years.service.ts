import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { SystemRole } from '@prisma/client';

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
    const startsAt = new Date(dto.startDate);
    const endsAt = new Date(dto.endDate);
    if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf())) {
      throw new BadRequestException('Neplatné datum.');
    }
    if (startsAt >= endsAt) {
      throw new BadRequestException('Datum začátku musí být před koncem.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
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
          label: dto.name.trim(),
          startsAt,
          endsAt,
          isCurrent: shouldActivate,
        },
      });
    });

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

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({
        where: { orgId, isCurrent: true },
        data: { isCurrent: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isCurrent: true },
      });
    });

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
}
