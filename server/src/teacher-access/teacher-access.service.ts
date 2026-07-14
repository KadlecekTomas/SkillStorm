import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  AuditEntityType,
  OrganizationRole,
  Prisma,
  SystemRole,
  TeacherClassAccessLevel,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import {
  cacheScopeForUser,
  invalidateResourcesFailSafe,
} from '@/shared/cache/org-cache.utils';
import type { CreateTeacherAccessDto } from './dto/create-teacher-access.dto';
import type { UpdateTeacherAccessDto } from './dto/update-teacher-access.dto';
import type { QueryTeacherAccessDto } from './dto/query-teacher-access.dto';

@Injectable()
export class TeacherAccessService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private includeAccess() {
    return Prisma.validator<Prisma.TeacherClassSectionInclude>()({
      teacher: {
        include: {
          membership: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
      classSection: {
        select: {
          id: true,
          label: true,
          grade: true,
          section: true,
          orgId: true,
          yearId: true,
          academicYear: {
            select: { id: true, label: true, isCurrent: true },
          },
        },
      },
      academicYear: {
        select: { id: true, label: true, isCurrent: true },
      },
    });
  }

  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    changedFields?: Record<string, unknown>;
  }) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: opts.userId ?? null,
      organizationId: opts.orgId ?? null,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: opts.entityId ?? null,
      action: opts.action,
    };
    if (opts.metadata !== undefined) {
      data.metadata = opts.metadata as Prisma.InputJsonValue;
    }
    if (opts.changedFields !== undefined) {
      data.changedFields = opts.changedFields as Prisma.InputJsonValue;
    }
    return this.prisma.auditLog.create({ data });
  }

  private async invalidateAccessReads(
    systemRole: SystemRole | null | undefined,
    orgId: string,
    mutation: string,
  ) {
    await invalidateResourcesFailSafe(this.cache, {
      scopeId: cacheScopeForUser(systemRole, orgId),
      resources: ['teachers', 'classrooms', 'dashboard'],
      mutation,
    });
  }

  private assertValidWindow(validFrom?: Date | null, validTo?: Date | null) {
    if (validFrom && validTo && validFrom > validTo) {
      throw new BadRequestException('validFrom musí být dříve než validTo.');
    }
  }

  private async assertManagerAccess(user: JwtPayload, orgId: string) {
    if (user.systemRole === SystemRole.SUPERADMIN) return;
    if (!user.organizationId || user.organizationId !== orgId) {
      throw new ForbiddenException(
        'Cross-organization teacher access is forbidden.',
      );
    }
    const managerMembership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: orgId,
        deletedAt: null,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.DIRECTOR] },
      },
      select: { id: true },
    });
    if (!managerMembership) {
      throw new ForbiddenException(
        'Pouze owner nebo ředitel může spravovat přístupy učitelů.',
      );
    }
  }

  private async resolveTeacherAndClass(
    teacherId: string,
    classSectionId: string,
  ) {
    const [teacher, classSection] = await Promise.all([
      this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: {
          id: true,
          organizationId: true,
          deletedAt: true,
          membership: { select: { role: true } },
        },
      }),
      this.prisma.classSection.findUnique({
        where: { id: classSectionId },
        select: {
          id: true,
          orgId: true,
          yearId: true,
          teacherId: true,
          academicYear: { select: { isCurrent: true } },
        },
      }),
    ]);

    if (!teacher || teacher.deletedAt) {
      throw new NotFoundException('Učitel nebyl nalezen.');
    }
    if (!classSection) {
      throw new NotFoundException('Třída nebyla nalezena.');
    }
    if (teacher.organizationId !== classSection.orgId) {
      throw new ForbiddenException(
        'Učitel a třída musí patřit do stejné organizace.',
      );
    }
    if (teacher.membership?.role !== OrganizationRole.TEACHER) {
      throw new BadRequestException(
        'Přístup lze přidělit pouze členovi s rolí TEACHER.',
      );
    }
    return { teacher, classSection };
  }

  private async ensureHomeroomAvailability(
    tx: Prisma.TransactionClient,
    teacherId: string,
    classSectionId: string,
    orgId: string,
    yearId: string,
  ) {
    const existingHomeroom = await tx.classSection.findFirst({
      where: {
        teacherId,
        orgId,
        yearId,
        id: { not: classSectionId },
      },
      select: { id: true, label: true },
    });
    if (existingHomeroom) {
      throw new ConflictException(
        `Učitel již je třídní v jiné třídě (${existingHomeroom.label ?? 'neznámá'}).`,
      );
    }
  }

  private async syncHomeroomAccess(
    tx: Prisma.TransactionClient,
    params: {
      classSectionId: string;
      yearId: string;
      orgId: string;
      teacherId: string | null;
      createdById?: string | null;
    },
  ) {
    const now = new Date();
    if (!params.teacherId) {
      await tx.teacherClassSection.updateMany({
        where: {
          classSectionId: params.classSectionId,
          accessLevel: TeacherClassAccessLevel.HOMEROOM,
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
      return;
    }

    await this.ensureHomeroomAvailability(
      tx,
      params.teacherId,
      params.classSectionId,
      params.orgId,
      params.yearId,
    );

    await tx.teacherClassSection.updateMany({
      where: {
        classSectionId: params.classSectionId,
        accessLevel: TeacherClassAccessLevel.HOMEROOM,
        teacherId: { not: params.teacherId },
        deletedAt: null,
      },
      data: { deletedAt: now },
    });

    const existing = await tx.teacherClassSection.findUnique({
      where: {
        teacherId_classSectionId: {
          teacherId: params.teacherId,
          classSectionId: params.classSectionId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await tx.teacherClassSection.update({
        where: { id: existing.id },
        data: {
          yearId: params.yearId,
          accessLevel: TeacherClassAccessLevel.HOMEROOM,
          validFrom: null,
          validTo: null,
          deletedAt: null,
          ...(params.createdById ? { createdById: params.createdById } : {}),
        },
      });
      return;
    }

    await tx.teacherClassSection.create({
      data: {
        teacherId: params.teacherId,
        classSectionId: params.classSectionId,
        yearId: params.yearId,
        accessLevel: TeacherClassAccessLevel.HOMEROOM,
        ...(params.createdById ? { createdById: params.createdById } : {}),
      },
    });
  }

  async findAll(user: JwtPayload, q: QueryTeacherAccessDto) {
    if (!q.teacherId) {
      throw new BadRequestException('teacherId je povinné.');
    }
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: q.teacherId },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (!teacher || teacher.deletedAt) {
      throw new NotFoundException('Učitel nebyl nalezen.');
    }
    await this.assertManagerAccess(user, teacher.organizationId);

    return this.prisma.teacherClassSection.findMany({
      where: {
        teacherId: q.teacherId,
        deletedAt: null,
      },
      take: 500, // safety cap — class links of one teacher
      include: this.includeAccess(),
      orderBy: [
        { classSection: { grade: 'asc' } },
        { classSection: { section: 'asc' } },
        { createdAt: 'asc' },
      ],
    });
  }

  async create(dto: CreateTeacherAccessDto, user: JwtPayload) {
    this.assertValidWindow(dto.validFrom, dto.validTo);
    const { teacher, classSection } = await this.resolveTeacherAndClass(
      dto.teacherId,
      dto.classSectionId,
    );
    await this.assertManagerAccess(user, classSection.orgId);

    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.accessLevel === TeacherClassAccessLevel.HOMEROOM) {
        await this.ensureHomeroomAvailability(
          tx,
          teacher.id,
          classSection.id,
          classSection.orgId,
          classSection.yearId,
        );
      }

      const existing = await tx.teacherClassSection.findUnique({
        where: {
          teacherId_classSectionId: {
            teacherId: dto.teacherId,
            classSectionId: dto.classSectionId,
          },
        },
        select: { id: true, deletedAt: true },
      });

      if (existing && !existing.deletedAt) {
        throw new ConflictException(
          'Přístup učitele k této třídě již existuje.',
        );
      }

      const record = existing
        ? await tx.teacherClassSection.update({
            where: { id: existing.id },
            data: {
              yearId: classSection.yearId,
              accessLevel: dto.accessLevel,
              validFrom: dto.validFrom ?? null,
              validTo: dto.validTo ?? null,
              createdById: user.userId,
              deletedAt: null,
            },
            include: this.includeAccess(),
          })
        : await tx.teacherClassSection.create({
            data: {
              teacherId: dto.teacherId,
              classSectionId: dto.classSectionId,
              yearId: classSection.yearId,
              accessLevel: dto.accessLevel,
              validFrom: dto.validFrom ?? null,
              validTo: dto.validTo ?? null,
              createdById: user.userId,
            },
            include: this.includeAccess(),
          });

      if (dto.accessLevel === TeacherClassAccessLevel.HOMEROOM) {
        await tx.classSection.update({
          where: { id: classSection.id },
          data: { teacherId: teacher.id },
        });
        await tx.teacherClassSection.updateMany({
          where: {
            classSectionId: classSection.id,
            accessLevel: TeacherClassAccessLevel.HOMEROOM,
            teacherId: { not: teacher.id },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }

      return record;
    });

    await this.audit({
      userId: user.userId,
      orgId: classSection.orgId,
      action: 'TEACHER_CLASS_ACCESS_CREATE',
      entityId: created.id,
      changedFields: {
        teacherId: dto.teacherId,
        classSectionId: dto.classSectionId,
        accessLevel: dto.accessLevel,
        validFrom: dto.validFrom ?? null,
        validTo: dto.validTo ?? null,
      },
    });

    await this.invalidateAccessReads(
      user.systemRole,
      classSection.orgId,
      'teacher-access.create',
    );
    return created;
  }

  async update(id: string, dto: UpdateTeacherAccessDto, user: JwtPayload) {
    this.assertValidWindow(dto.validFrom, dto.validTo);
    const current = await this.prisma.teacherClassSection.findUnique({
      where: { id },
      include: {
        classSection: {
          select: { id: true, orgId: true, yearId: true, teacherId: true },
        },
        teacher: {
          select: { id: true, organizationId: true, deletedAt: true },
        },
      },
    });
    if (!current || current.deletedAt) {
      throw new NotFoundException('Přístup nebyl nalezen.');
    }
    await this.assertManagerAccess(user, current.classSection.orgId);

    const nextAccessLevel = dto.accessLevel ?? current.accessLevel;
    const nextValidFrom =
      dto.validFrom === undefined ? current.validFrom : (dto.validFrom ?? null);
    const nextValidTo =
      dto.validTo === undefined ? current.validTo : (dto.validTo ?? null);
    this.assertValidWindow(nextValidFrom, nextValidTo);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextAccessLevel === TeacherClassAccessLevel.HOMEROOM) {
        await this.ensureHomeroomAvailability(
          tx,
          current.teacherId,
          current.classSection.id,
          current.classSection.orgId,
          current.classSection.yearId,
        );
      }

      const record = await tx.teacherClassSection.update({
        where: { id },
        data: {
          accessLevel: nextAccessLevel,
          validFrom: nextValidFrom,
          validTo: nextValidTo,
        },
        include: this.includeAccess(),
      });

      if (nextAccessLevel === TeacherClassAccessLevel.HOMEROOM) {
        await tx.classSection.update({
          where: { id: current.classSection.id },
          data: { teacherId: current.teacherId },
        });
        await tx.teacherClassSection.updateMany({
          where: {
            classSectionId: current.classSection.id,
            accessLevel: TeacherClassAccessLevel.HOMEROOM,
            teacherId: { not: current.teacherId },
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      } else if (
        current.accessLevel === TeacherClassAccessLevel.HOMEROOM &&
        current.classSection.teacherId === current.teacherId
      ) {
        await tx.classSection.update({
          where: { id: current.classSection.id },
          data: { teacherId: null },
        });
      }

      return record;
    });

    await this.audit({
      userId: user.userId,
      orgId: current.classSection.orgId,
      action: 'TEACHER_CLASS_ACCESS_UPDATE',
      entityId: id,
      changedFields: {
        accessLevel: nextAccessLevel,
        validFrom: nextValidFrom,
        validTo: nextValidTo,
      },
    });

    await this.invalidateAccessReads(
      user.systemRole,
      current.classSection.orgId,
      'teacher-access.update',
    );
    return updated;
  }

  async remove(id: string, user: JwtPayload) {
    const current = await this.prisma.teacherClassSection.findUnique({
      where: { id },
      include: {
        classSection: {
          select: { id: true, orgId: true, teacherId: true },
        },
      },
    });
    if (!current || current.deletedAt) {
      throw new NotFoundException('Přístup nebyl nalezen.');
    }
    await this.assertManagerAccess(user, current.classSection.orgId);

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherClassSection.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      if (
        current.accessLevel === TeacherClassAccessLevel.HOMEROOM &&
        current.classSection.teacherId === current.teacherId
      ) {
        await tx.classSection.update({
          where: { id: current.classSection.id },
          data: { teacherId: null },
        });
      }
    });

    await this.audit({
      userId: user.userId,
      orgId: current.classSection.orgId,
      action: 'TEACHER_CLASS_ACCESS_DELETE',
      entityId: id,
      metadata: {
        teacherId: current.teacherId,
        classSectionId: current.classSectionId,
        accessLevel: current.accessLevel,
      },
    });

    await this.invalidateAccessReads(
      user.systemRole,
      current.classSection.orgId,
      'teacher-access.remove',
    );
    return { success: true };
  }

  async syncHomeroomFromClassSection(
    classSectionId: string,
    orgId: string,
    yearId: string,
    teacherId: string | null,
    createdById?: string | null,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.syncHomeroomAccess(tx, {
        classSectionId,
        orgId,
        yearId,
        teacherId,
        ...(createdById !== undefined ? { createdById } : {}),
      });
    });
  }
}
