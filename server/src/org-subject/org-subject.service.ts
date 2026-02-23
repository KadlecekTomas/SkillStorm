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
import { SystemRole } from '@prisma/client';

@Injectable()
export class OrgSubjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrgSubjectDto, user: JwtPayload) {
    if (dto.gradeFrom > dto.gradeTo) {
      throw new BadRequestException('gradeFrom must be <= gradeTo');
    }
    if (user.systemRole !== SystemRole.SUPERADMIN && user.organizationId !== dto.organizationId) {
      throw new ForbiddenException('Subject must belong to your organization');
    }
    const existing = await this.prisma.orgSubject.findUnique({
      where: {
        organizationId_name_gradeFrom_gradeTo: {
          organizationId: dto.organizationId,
          name: dto.name,
          gradeFrom: dto.gradeFrom,
          gradeTo: dto.gradeTo,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Subject with this name and grade range already exists');
    }
    return this.prisma.orgSubject.create({
      data: {
        name: dto.name,
        gradeFrom: dto.gradeFrom,
        gradeTo: dto.gradeTo,
        organizationId: dto.organizationId,
      },
    });
  }

  async findAll(user: JwtPayload, query: QueryOrgSubjectsDto) {
    const orgId = user.organizationId;
    if (!orgId && user.systemRole !== SystemRole.SUPERADMIN) {
      return [];
    }
    const where: { organizationId?: string; gradeFrom?: { lte: number }; gradeTo?: { gte: number } } = {};
    if (orgId) where.organizationId = orgId;
    if (query.grade != null) {
      where.gradeFrom = { lte: query.grade };
      where.gradeTo = { gte: query.grade };
    }
    return this.prisma.orgSubject.findMany({
      where,
      orderBy: [{ name: 'asc' }, { gradeFrom: 'asc' }],
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const subject = await this.prisma.orgSubject.findUnique({ where: { id } });
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
    const gradeFrom = dto.gradeFrom ?? current.gradeFrom;
    const gradeTo = dto.gradeTo ?? current.gradeTo;
    if (gradeFrom > gradeTo) {
      throw new BadRequestException('gradeFrom must be <= gradeTo');
    }
    return this.prisma.orgSubject.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.gradeFrom !== undefined && { gradeFrom: dto.gradeFrom }),
        ...(dto.gradeTo !== undefined && { gradeTo: dto.gradeTo }),
      },
    });
  }
}
