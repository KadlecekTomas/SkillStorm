import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateOrgSubjectDto } from './dto/create-org-subject.dto';
import type { UpdateOrgSubjectDto } from './dto/update-org-subject.dto';
import type { QueryOrgSubjectsDto } from './dto/query-org-subjects.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { SchoolGrade, SystemRole } from '@prisma/client';

@Injectable()
export class OrgSubjectService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly subjectSelect = {
    id: true,
    name: true,
    gradeFrom: true,
    gradeTo: true,
  } as const;

  async create(dto: CreateOrgSubjectDto, user: JwtPayload) {
    if (user.systemRole !== SystemRole.SUPERADMIN && user.organizationId !== dto.organizationId) {
      throw new ForbiddenException('Subject must belong to your organization');
    }

    let subjectId = dto.subjectId;

    if (!subjectId) {
      const name = dto.name?.trim();
      if (!name) {
        throw new BadRequestException('Missing subjectId or custom subject name');
      }
      const gradeFrom = dto.gradeFrom ?? 1;
      const gradeTo = dto.gradeTo ?? 9;
      if (gradeFrom > gradeTo) {
        throw new BadRequestException('gradeFrom must be less than or equal to gradeTo');
      }

      const existingSubject = await this.prisma.subject.findFirst({
        where: {
          name,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existingSubject) {
        subjectId = existingSubject.id;
      } else {
        const createdSubject = await this.prisma.subject.create({
          data: {
            name,
            gradeFrom,
            gradeTo,
            levels: {
              createMany: {
                data: Object.values(SchoolGrade).map((grade) => ({ grade })),
                skipDuplicates: true,
              },
            },
          },
          select: { id: true },
        });
        subjectId = createdSubject.id;
      }
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, deletedAt: true },
    });
    if (!subject || subject.deletedAt) {
      throw new NotFoundException('Subject not found');
    }
    const existing = await this.prisma.orgSubject.findUnique({
      where: {
        organizationId_subjectId: {
          organizationId: dto.organizationId,
          subjectId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Subject already enabled for this organization');
    }
    return this.prisma.orgSubject.create({
      data: {
        organizationId: dto.organizationId,
        subjectId,
        isEnabled: dto.isEnabled ?? true,
        isCustom: dto.isCustom ?? !dto.subjectId,
      },
      include: {
        subject: { select: this.subjectSelect },
      },
    });
  }

  async findAll(user: JwtPayload, query: QueryOrgSubjectsDto) {
    const orgId = user.organizationId;
    if (!orgId && user.systemRole !== SystemRole.SUPERADMIN) {
      return [];
    }
    const where: {
      organizationId?: string;
      isEnabled?: boolean;
      subject?: { gradeFrom?: { lte: number }; gradeTo?: { gte: number } };
    } = {};
    if (orgId) where.organizationId = orgId;
    if (!query.includeDisabled) {
      where.isEnabled = true;
    }
    if (query.grade != null) {
      where.subject = {
        gradeFrom: { lte: query.grade },
        gradeTo: { gte: query.grade },
      };
    }
    return this.prisma.orgSubject.findMany({
      where,
      include: {
        subject: { select: this.subjectSelect },
      },
      orderBy: [{ subject: { name: 'asc' } }, { id: 'asc' }],
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const subject = await this.prisma.orgSubject.findUnique({
      where: { id },
      include: {
        subject: { select: this.subjectSelect },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (user.systemRole !== SystemRole.SUPERADMIN && subject.organizationId !== user.organizationId) {
      throw new ForbiddenException('Subject not in your organization');
    }
    return subject;
  }

  async update(id: string, dto: UpdateOrgSubjectDto, user: JwtPayload) {
    const current = await this.prisma.orgSubject.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Subject not found');
    if (user.systemRole !== SystemRole.SUPERADMIN && current.organizationId !== user.organizationId) {
      throw new ForbiddenException('Subject not in your organization');
    }
    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
        select: { id: true, deletedAt: true },
      });
      if (!subject || subject.deletedAt) {
        throw new NotFoundException('Subject not found');
      }
    }
    return this.prisma.orgSubject.update({
      where: { id },
      data: {
        ...(dto.subjectId !== undefined && { subjectId: dto.subjectId }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.isCustom !== undefined && { isCustom: dto.isCustom }),
      },
      include: {
        subject: { select: this.subjectSelect },
      },
    });
  }
}
