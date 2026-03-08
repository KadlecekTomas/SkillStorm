// src/modules/classroom/class-sections.service.ts
import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateClassSectionDto } from './dto/create-classroom.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { assertSameOrganization } from '@/shared/access.utils';
import type { UpdateClassroomDto } from './dto/update-classroom.dto';
import type { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import type { SetHomeroomDto } from './dto/set-homeroom.dto';
import type { AttachOrgSubjectsDto } from './dto/attach-org-subjects.dto';
import {
  Prisma,
  OrganizationRole,
  OrganizationStatus,
  SystemRole,
  EnrollmentStatus,
  AuditEntityType,
  SchoolGrade,
} from '@prisma/client';
import { hasAtLeastRole } from '@/shared/access.utils';
import { AuditService } from '@/audit/audit.service';
import { computeStudentRisk } from './risk-overview.util';
import type { ClassroomRiskOverviewResponseDto, ClassroomRiskOverviewStudentDto } from './dto/risk-overview.dto';
import type {
  SubjectPerformanceResponseDto,
  SubjectPerformanceItemDto,
  SubjectPerformanceTrend,
} from './dto/subject-performance.dto';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  buildAuthzScopeKey,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
  bumpOrgVersion,
} from '@/shared/cache/org-cache.utils';

@Injectable()
export class ClassSectionsService {
  private readonly logger = new Logger(ClassSectionsService.name);
  private hasLoggedPageDeprecation = false;

  private static readonly SCHOOL_GRADE_TO_NUM: Record<SchoolGrade, number> = {
    [SchoolGrade.GRADE_1]: 1,
    [SchoolGrade.GRADE_2]: 2,
    [SchoolGrade.GRADE_3]: 3,
    [SchoolGrade.GRADE_4]: 4,
    [SchoolGrade.GRADE_5]: 5,
    [SchoolGrade.GRADE_6]: 6,
    [SchoolGrade.GRADE_7]: 7,
    [SchoolGrade.GRADE_8]: 8,
    [SchoolGrade.GRADE_9]: 9,
    [SchoolGrade.HIGH_SCHOOL_YEAR_1]: 10,
    [SchoolGrade.HIGH_SCHOOL_YEAR_2]: 11,
    [SchoolGrade.HIGH_SCHOOL_YEAR_3]: 12,
    [SchoolGrade.HIGH_SCHOOL_YEAR_4]: 13,
  };

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly auditService: AuditService,
  ) {}

  private async getCurrentAcademicYear(orgId: string) {
    const current = await this.prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true, orgId: true, isCurrent: true },
    });
    if (!current) {
      throw new NotFoundException('Current academic year was not found.');
    }
    return current;
  }

  private getGradeLabel(grade: string): string {
    if (grade.startsWith('GRADE_')) {
      return grade.replace('GRADE_', '');
    }
    if (grade.startsWith('PRIMARY_')) {
      return grade.replace('PRIMARY_', '');
    }
    return grade;
  }

  private async assertValidAcademicYear(orgId: string, yearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, orgId },
      select: { id: true, orgId: true, isCurrent: true },
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

  private async resolveClassSectionScope(
    classSectionId: string,
    user: JwtPayload,
  ): Promise<{ id: string; orgId: string; grade: SchoolGrade }> {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true, grade: true },
    });
    if (!classSection) {
      throw new NotFoundException('Třída nebyla nalezena');
    }

    if (user.systemRole === SystemRole.SUPERADMIN) {
      return classSection;
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }
    if (classSection.orgId !== user.organizationId) {
      throw new ForbiddenException('Třída nepatří do aktivní organizace.');
    }

    return classSection;
  }

  private async listOrgSubjectsByClassSectionId(classSectionId: string) {
    return this.prisma.orgSubject.findMany({
      where: {
        classSections: {
          some: { classSectionId },
        },
      },
      select: {
        id: true,
        name: true,
        gradeFrom: true,
        gradeTo: true,
        organizationId: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  private encodeClassroomCursor(cursor: {
    grade: SchoolGrade;
    section: string;
    id: string;
  }): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeClassroomCursor(raw: string): {
    grade: SchoolGrade;
    section: string;
    id: string;
  } {
    try {
      const parsed = JSON.parse(
        Buffer.from(raw, 'base64url').toString('utf8'),
      ) as { grade?: unknown; section?: unknown; id?: unknown };
      const grades = Object.values(SchoolGrade);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.section !== 'string' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.grade !== 'string' ||
        !grades.includes(parsed.grade as SchoolGrade)
      ) {
        throw new Error('Invalid cursor payload');
      }
      return {
        grade: parsed.grade as SchoolGrade,
        section: parsed.section,
        id: parsed.id,
      };
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  // -------------------------
  // CREATE
  // -------------------------
  async create(dto: CreateClassSectionDto, user: JwtPayload) {
    if (!user?.organizationId && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Missing organization context.');
    }
    if (dto.yearId && dto.academicYearId && dto.yearId !== dto.academicYearId) {
      throw new BadRequestException('academicYearId a yearId se musí shodovat.');
    }
    const yearId = dto.yearId ?? dto.academicYearId ?? null;
    if (!yearId) {
      throw new BadRequestException('Chybí školní rok (academicYearId).');
    }
    let orgId = user.organizationId ?? null;
    if (!orgId && user.systemRole === SystemRole.SUPERADMIN) {
      const yearOrg = await this.prisma.academicYear.findUnique({
        where: { id: yearId },
        select: { orgId: true },
      });
      orgId = yearOrg?.orgId ?? null;
    }
    if (!orgId) {
      this.logger.warn({
        message: 'Academic year mismatch',
        orgId,
        yearId,
      });
      throw new ForbiddenException('Invalid academic year for organization');
    }
    const resolvedYear = await this.assertValidAcademicYear(orgId, yearId);
    if (!resolvedYear.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }
    assertSameOrganization(resolvedYear.orgId, user, 'třída');

    const teacherId: string | null = dto.teacherId ?? null;
    if (teacherId) {
      const t = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (!t || t.deletedAt)
        throw new NotFoundException('Učitel nebyl nalezen.');
      if (t.organizationId !== resolvedYear.orgId)
        throw new ForbiddenException(
          'Učitel není ze stejné organizace jako třída.',
        );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const section = await tx.classSection.create({
          data: {
            orgId: resolvedYear.orgId,
            yearId: resolvedYear.id,
            grade: dto.grade,
            section: dto.section,
            label: dto.label ?? `${this.getGradeLabel(dto.grade)}.${dto.section}`,
            teacherId,
          },
          select: {
            id: true,
            orgId: true,
            yearId: true,
            grade: true,
            section: true,
            label: true,
            createdAt: true,
          },
        });
        const org = await tx.organization.findUnique({
          where: { id: resolvedYear.orgId },
          select: { status: true },
        });
        if (org?.status === OrganizationStatus.PENDING) {
          await tx.organization.update({
            where: { id: resolvedYear.orgId },
            data: { status: OrganizationStatus.ACTIVE },
          });
        }
        return section;
      });

      await bumpOrgVersion(
        this.cache,
        cacheScopeForUser(user.systemRole, resolvedYear.orgId),
      );
      return {
        id: created.id,
        academicYearId: created.yearId,
        yearId: created.yearId,
        label: created.label,
        grade: created.grade,
        section: created.section,
        createdAt: created.createdAt,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Třída s tímto ročníkem/sekcí už existuje.',
        );
      }
      throw e;
    }
  }

  // -------------------------
  // LIST
  // -------------------------
  async findAll(q: QueryClassSectionsDto, user: JwtPayload) {
    // validace roku + org
    if (!user?.organizationId && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Missing organization context.');
    }
    const yearId = q.yearId ?? q.academicYearId ?? null;
    if (!yearId) {
      throw new BadRequestException('Chybí školní rok (academicYearId).');
    }
    let orgId = user.organizationId ?? null;
    if (!orgId && user.systemRole === SystemRole.SUPERADMIN) {
      const yearOrg = await this.prisma.academicYear.findUnique({
        where: { id: yearId },
        select: { orgId: true },
      });
      orgId = yearOrg?.orgId ?? null;
    }
    if (!orgId) {
      this.logger.warn({
        message: 'Academic year mismatch',
        orgId,
        yearId,
      });
      throw new ForbiddenException('Invalid academic year for organization');
    }
    const resolvedYear = await this.assertValidAcademicYear(orgId, yearId);
    assertSameOrganization(resolvedYear.orgId, user, 'třídy');

    const membership = user.organizationId
      ? await this.prisma.membership.findFirst({
          where: {
            userId: user.userId,
            organizationId: user.organizationId,
            deletedAt: null,
          },
          select: { id: true, role: true },
        })
      : null;
    const role = membership?.role ?? user.organizationRole ?? null;

    const allowedLimits = [5, 10, 20, 50] as const;
    const requestedLimit = q.limit ?? 20;
    const safeLimit = allowedLimits.includes(
      requestedLimit as (typeof allowedLimits)[number],
    )
      ? requestedLimit
      : 20;
    const rawCursor = q.cursor?.trim();
    const direction = q.direction === 'prev' ? 'prev' : 'next';
    const cursorToken = rawCursor && rawCursor.length > 0 ? rawCursor : null;
    const isCursorMode = !!cursorToken;
    const effectiveDirection = isCursorMode ? direction : 'next';
    if (!isCursorMode && typeof q.page === 'number' && !this.hasLoggedPageDeprecation) {
      this.hasLoggedPageDeprecation = true;
      this.logger.warn({
        message: 'Deprecated page parameter ignored for classrooms cursor pagination',
      });
    }

    const where: Prisma.ClassSectionWhereInput = {
      orgId: resolvedYear.orgId,
      yearId: resolvedYear.id,
      ...(q.grade ? { grade: q.grade } : {}),
      ...(q.search?.trim()
        ? {
            label: { contains: q.search.trim(), mode: 'insensitive' },
          }
        : {}),
    };

    if (role === OrganizationRole.TEACHER) {
      const teacher = membership
        ? await this.prisma.teacher.findFirst({
            where: { membershipId: membership.id, deletedAt: null },
            select: { id: true },
          })
        : null;
      if (!teacher) {
        return {
          data: [],
          meta: {
            limit: safeLimit,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
            prevCursor: null,
          },
        };
      }
      where.teacherId = teacher.id;
    } else if (role === OrganizationRole.STUDENT) {
      const student = membership
        ? await this.prisma.student.findFirst({
            where: { membershipId: membership.id, deletedAt: null },
            select: { id: true },
          })
        : null;
      if (!student) {
        return {
          data: [],
          meta: {
            limit: safeLimit,
            hasNextPage: false,
            hasPrevPage: false,
            nextCursor: null,
            prevCursor: null,
          },
        };
      }
      where.enrollments = {
        some: {
          studentId: student.id,
          yearId: resolvedYear.id,
          status: { not: EnrollmentStatus.LEFT },
        },
      };
    } else if (q.teacherId) {
      where.teacherId = q.teacherId;
    } else if (
      role &&
      !hasAtLeastRole(role, OrganizationRole.DIRECTOR) &&
      user.systemRole !== SystemRole.SUPERADMIN
    ) {
      throw new ForbiddenException('Access denied.');
    }

    const orderBy: Prisma.ClassSectionOrderByWithRelationInput[] = [
      { grade: 'asc' },
      { section: 'asc' },
      { id: 'asc' },
    ];
    const reverseOrderBy: Prisma.ClassSectionOrderByWithRelationInput[] = [
      { grade: 'desc' },
      { section: 'desc' },
      { id: 'desc' },
    ];

    let decodedCursor:
      | {
          grade: SchoolGrade;
          section: string;
          id: string;
        }
      | null = null;
    if (cursorToken) {
      decodedCursor = this.decodeClassroomCursor(cursorToken);
      const cursorExists = await this.prisma.classSection.findFirst({
        where: {
          ...where,
          id: decodedCursor.id,
          grade: decodedCursor.grade,
          section: decodedCursor.section,
        },
        select: { id: true },
      });
      if (!cursorExists) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    // Per-user cache is mandatory: teacher/student visibility is user-scoped.
    const authzKey = buildAuthzScopeKey({
      userId: user.userId,
      systemRole: user.systemRole ?? null,
      organizationRole: role ?? null,
    });

    // org‑scoped verzovaná cache
    const scope = cacheScopeForUser(user.systemRole, resolvedYear.orgId);
    const ver = await getOrgVersion(this.cache, scope);
    const cacheKey = buildVersionedListKey({
      namespace: 'classSections',
      scopeId: scope,
      version: ver,
      authz: authzKey,
      limit: safeLimit,
      search: q.search ?? '',
      order: effectiveDirection === 'prev' ? reverseOrderBy : orderBy,
      filters: {
        yearId: resolvedYear.id,
        grade: q.grade ?? null,
        teacherId: q.teacherId ?? null,
        cursor: cursorToken ?? null,
        direction: effectiveDirection,
      },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const take = safeLimit + 1;
      const rows = await this.prisma.classSection.findMany({
        where,
        orderBy: effectiveDirection === 'prev' ? reverseOrderBy : orderBy,
        take,
        ...(decodedCursor
          ? {
              cursor: {
                orgId_yearId_grade_section: {
                  orgId: resolvedYear.orgId,
                  yearId: resolvedYear.id,
                  grade: decodedCursor.grade,
                  section: decodedCursor.section,
                },
              },
              skip: 1,
            }
          : {}),
        include: {
          teacher: {
            select: {
              id: true,
              membership: {
                select: { user: { select: { name: true, email: true } } },
              },
            },
          },
          _count: {
            select: {
              enrollments: {
                where: { status: { not: EnrollmentStatus.LEFT } },
              },
            },
          },
          academicYear: { select: { id: true, label: true, isCurrent: true } },
        },
      });

      const hasMoreInRequestedDirection = rows.length > safeLimit;
      const sliced = hasMoreInRequestedDirection ? rows.slice(0, safeLimit) : rows;
      const data =
        effectiveDirection === 'prev' ? [...sliced].reverse() : sliced;

      if (data.length === 0) {
        return {
          data,
          meta: {
            limit: safeLimit,
            hasNextPage: !!decodedCursor && effectiveDirection === 'prev',
            hasPrevPage: !!decodedCursor && effectiveDirection === 'next',
            nextCursor: null,
            prevCursor: null,
          },
        };
      }

      const first = data[0]!;
      const last = data[data.length - 1]!;
      const hasPrevPage =
        effectiveDirection === 'prev'
          ? hasMoreInRequestedDirection
          : !!decodedCursor;
      const hasNextPage =
        effectiveDirection === 'next'
          ? hasMoreInRequestedDirection
          : !!decodedCursor;
      const nextCursor = hasNextPage
        ? this.encodeClassroomCursor({
            grade: last.grade,
            section: last.section,
            id: last.id,
          })
        : null;
      const prevCursor = hasPrevPage
        ? this.encodeClassroomCursor({
            grade: first.grade,
            section: first.section,
            id: first.id,
          })
        : null;

      return {
        data,
        meta: {
          limit: safeLimit,
          hasNextPage,
          hasPrevPage,
          nextCursor,
          prevCursor,
        },
      };
    });
  }

  // -------------------------
  // DETAIL
  // -------------------------
  async findOne(id: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            membership: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
        enrollments: {
          where: { status: { not: EnrollmentStatus.LEFT } },
          include: {
            student: {
              include: {
                membership: {
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
        },
        academicYear: { select: { isCurrent: true, id: true, label: true } },
      },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId || user.organizationId !== classSection.orgId) {
        throw new NotFoundException('Třída nebyla nalezena');
      }
    }

    assertSameOrganization(classSection.orgId, user, 'třída');
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: classSection.orgId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });
      const role = membership?.role ?? user.organizationRole ?? null;

      if (role === OrganizationRole.TEACHER) {
        const teacher = membership
          ? await this.prisma.teacher.findFirst({
              where: { membershipId: membership.id, deletedAt: null },
              select: { id: true },
            })
          : null;
        if (!teacher || classSection.teacherId !== teacher.id) {
          throw new ForbiddenException('Učitel nemá přístup k této třídě.');
        }
      } else if (role === OrganizationRole.STUDENT) {
        const student = membership
          ? await this.prisma.student.findFirst({
              where: { membershipId: membership.id, deletedAt: null },
              select: { id: true },
            })
          : null;
        const isEnrolled = student
          ? classSection.enrollments.some(
              (enrollment) => enrollment.studentId === student.id,
            )
          : false;
        if (!isEnrolled) {
          throw new ForbiddenException('Student nemá přístup k této třídě.');
        }
      } else if (
        role &&
        !hasAtLeastRole(role, OrganizationRole.DIRECTOR)
      ) {
        throw new ForbiddenException('Access denied.');
      }
    }
    return classSection;
  }

  async listOrgSubjects(classSectionId: string, user: JwtPayload) {
    const classSection = await this.resolveClassSectionScope(classSectionId, user);
    return this.listOrgSubjectsByClassSectionId(classSection.id);
  }

  async attachOrgSubjects(
    classSectionId: string,
    dto: AttachOrgSubjectsDto,
    user: JwtPayload,
  ) {
    const classSection = await this.resolveClassSectionScope(classSectionId, user);
    const uniqueOrgSubjectIds = Array.from(new Set(dto.orgSubjectIds ?? []));

    const subjects = await this.prisma.orgSubject.findMany({
      where: { id: { in: uniqueOrgSubjectIds } },
      select: {
        id: true,
        organizationId: true,
        gradeFrom: true,
        gradeTo: true,
      },
    });
    if (subjects.length !== uniqueOrgSubjectIds.length) {
      throw new BadRequestException('Některé orgSubjectIds neexistují.');
    }

    const foreignOrgSubjectIds = subjects
      .filter((subject) => subject.organizationId !== classSection.orgId)
      .map((subject) => subject.id);
    if (foreignOrgSubjectIds.length > 0) {
      this.logger.debug(
        JSON.stringify({
          message: 'Rejected cross-org class-section subject attach',
          classSectionId,
          classSectionOrgId: classSection.orgId,
          userOrganizationId: user.organizationId ?? null,
          foreignOrgSubjectIds,
        }),
      );
      throw new ForbiddenException(
        'Org subjects must belong to the same organization as class section.',
      );
    }

    const classGradeNumeric = ClassSectionsService.SCHOOL_GRADE_TO_NUM[classSection.grade];
    if (classGradeNumeric === undefined) {
      throw new BadRequestException('Unsupported class grade value.');
    }
    const invalidByGrade = subjects
      .filter((subject) => {
        const min = subject.gradeFrom ?? Number.NEGATIVE_INFINITY;
        const max = subject.gradeTo ?? Number.POSITIVE_INFINITY;
        return classGradeNumeric < min || classGradeNumeric > max;
      })
      .map((subject) => ({
        orgSubjectId: subject.id,
        gradeFrom: subject.gradeFrom,
        gradeTo: subject.gradeTo,
      }));

    if (invalidByGrade.length > 0) {
      throw new UnprocessableEntityException({
        errorCode: 'SUBJECT_OUT_OF_GRADE_RANGE',
        message: 'One or more subjects are outside class grade range.',
        details: {
          grade: classGradeNumeric,
          invalid: invalidByGrade,
          expectedRange: {
            min: classGradeNumeric,
            max: classGradeNumeric,
          },
        },
      });
    }

    if (dto.replaceAll === true) {
      await this.prisma.$transaction(async (tx) => {
        await tx.classSectionOrgSubject.deleteMany({
          where: { classSectionId },
        });
        await tx.classSectionOrgSubject.createMany({
          data: uniqueOrgSubjectIds.map((orgSubjectId) => ({
            classSectionId,
            orgSubjectId,
          })),
          skipDuplicates: true,
        });
      });
    } else {
      await this.prisma.classSectionOrgSubject.createMany({
        data: uniqueOrgSubjectIds.map((orgSubjectId) => ({
          classSectionId,
          orgSubjectId,
        })),
        skipDuplicates: true,
      });
    }

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, classSection.orgId),
    );
    return this.listOrgSubjectsByClassSectionId(classSectionId);
  }

  // -------------------------
  // RISK OVERVIEW (Early Warning Panel)
  // -------------------------
  async getRiskOverview(
    classroomId: string,
    user: JwtPayload,
    subjectId?: string,
    limit?: number,
  ): Promise<ClassroomRiskOverviewResponseDto> {
    const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classroomId },
      include: {
        enrollments: {
          where: { status: { not: EnrollmentStatus.LEFT } },
          orderBy: { createdAt: 'desc' },
          take: safeLimit,
          include: {
            student: {
              include: {
                membership: { include: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: classSection.orgId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });
      const role = membership?.role ?? user.organizationRole ?? null;

      if (role === OrganizationRole.STUDENT) {
        await this.auditService.log({
          action: 'CLASSROOM_RISK_ACCESS_DENIED',
          entityType: AuditEntityType.CLASSROOM,
          entityId: classroomId,
          userId: user.userId,
          organizationId: classSection.orgId,
        });
        throw new ForbiddenException('Přístup k rizikovému přehledu mají pouze učitelé a ředitelé.');
      }

      if (role === OrganizationRole.TEACHER) {
        const teacher = membership
          ? await this.prisma.teacher.findFirst({
              where: { membershipId: membership.id, deletedAt: null },
              select: { id: true },
            })
          : null;
        if (!teacher || classSection.teacherId !== teacher.id) {
          throw new ForbiddenException('Učitel nemá přístup k této třídě.');
        }
      } else if (
        role &&
        !hasAtLeastRole(role, OrganizationRole.DIRECTOR)
      ) {
        throw new ForbiddenException('Access denied.');
      }
    }

    const enrollments = classSection.enrollments ?? [];
    const membershipIds = enrollments
      .map((e) => e.student?.membership?.id)
      .filter((id): id is string => !!id);
    if (membershipIds.length === 0) {
      await this.auditService.log({
        action: 'VIEW_RISK_OVERVIEW',
        entityType: AuditEntityType.CLASSROOM,
        entityId: classroomId,
        userId: user.userId,
        organizationId: classSection.orgId,
      });
      return { classroomId, students: [] };
    }

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId: { in: membershipIds },
        deletedAt: null,
        submittedAt: { not: null },
        ...(subjectId && { test: { subjectId: subjectId } }),
      },
      select: { studentId: true, score: true, submittedAt: true },
      orderBy: { submittedAt: 'desc' },
      take: Math.min(5000, safeLimit * 50),
    });

    const byMembershipId = new Map<string, { score: number | null; submittedAt: Date | null }[]>();
    for (const s of submissions) {
      const list = byMembershipId.get(s.studentId) ?? [];
      list.push({ score: s.score, submittedAt: s.submittedAt });
      byMembershipId.set(s.studentId, list);
    }

    const students: ClassroomRiskOverviewStudentDto[] = [];
    for (const enr of enrollments) {
      const student = enr.student;
      if (!student) continue;
      const membershipId = student.membership?.id;
      if (!membershipId) continue;
      const displayName =
        student.membership?.user?.name?.trim() || 'Žák';
      const rawSubs = byMembershipId.get(membershipId) ?? [];
      const risk = computeStudentRisk({
        displayName,
        submissions: rawSubs,
      });
      students.push({
        studentId: student.id,
        displayName,
        averageScorePercent: risk.averageScorePercent,
        lastActivityAt: risk.lastActivityAt,
        trend: risk.trend,
        riskLevel: risk.riskLevel,
        riskFlags: risk.riskFlags,
      });
    }

    await this.auditService.log({
      action: 'VIEW_RISK_OVERVIEW',
      entityType: AuditEntityType.CLASSROOM,
      entityId: classroomId,
      userId: user.userId,
      organizationId: classSection.orgId,
    });

    return { classroomId, students };
  }

  // -------------------------
  // SUBJECT PERFORMANCE
  // -------------------------
  async getSubjectPerformance(
    classroomId: string,
    user: JwtPayload,
    academicYearId?: string,
    limit?: number,
  ): Promise<SubjectPerformanceResponseDto> {
    const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classroomId },
      select: { id: true, orgId: true, yearId: true, teacherId: true },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');
    assertSameOrganization(classSection.orgId, user, 'třída');

    if (user.systemRole !== SystemRole.SUPERADMIN) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: classSection.orgId,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });
      const role = membership?.role ?? user.organizationRole ?? null;
      if (role === OrganizationRole.STUDENT) {
        await this.auditService.log({
          action: 'CLASSROOM_RISK_ACCESS_DENIED',
          entityType: AuditEntityType.CLASSROOM,
          entityId: classroomId,
          userId: user.userId,
          organizationId: classSection.orgId,
        });
        throw new ForbiddenException(
          'Přístup k výkonu podle předmětu mají pouze učitelé a ředitelé.',
        );
      }
      if (role === OrganizationRole.TEACHER) {
        const teacher = membership
          ? await this.prisma.teacher.findFirst({
              where: { membershipId: membership.id, deletedAt: null },
              select: { id: true },
            })
          : null;
        if (!teacher || classSection.teacherId !== teacher.id) {
          throw new ForbiddenException('Učitel nemá přístup k této třídě.');
        }
      } else if (
        role &&
        !hasAtLeastRole(role, OrganizationRole.DIRECTOR)
      ) {
        throw new ForbiddenException('Access denied.');
      }
    }

    const assignments = await this.prisma.assignment.findMany({
      where: {
        classSectionId: classroomId,
        yearId: academicYearId ?? classSection.yearId,
      },
      orderBy: { openAt: 'desc' },
      take: safeLimit,
      include: {
        test: {
          include: {
            subject: true,
            questions: { select: { score: true } },
          },
        },
        submissions: {
          where: { deletedAt: null },
          select: { score: true, submittedAt: true },
        },
      },
    });

    type SubjectKey = string;
    const bySubject = new Map<
      SubjectKey,
      {
        subject: { id: string; name: string };
        testIds: Set<string>;
        submissions: { score: number; submittedAt: Date | null; maxScore: number }[];
      }
    >();

    for (const a of assignments) {
      const test = a.test;
      if (!test.subject) continue;
      const maxScore = (test.questions ?? []).reduce(
        (sum, q) => sum + (q.score ?? 0),
        0,
      );
      if (maxScore <= 0) continue;
      const subjectKey = test.subject.id;
      let entry = bySubject.get(subjectKey);
      if (!entry) {
        entry = {
          subject: {
            id: test.subject.id,
            name: test.subject.name,
          },
          testIds: new Set<string>(),
          submissions: [],
        };
        bySubject.set(subjectKey, entry);
      }
      entry.testIds.add(test.id);
      for (const s of a.submissions) {
        if (s.score != null) {
          entry.submissions.push({
            score: s.score,
            submittedAt: s.submittedAt,
            maxScore,
          });
        }
      }
    }

    const subjects: SubjectPerformanceItemDto[] = [];
    for (const entry of bySubject.values()) {
      const subs = entry.submissions;
      const submissionCount = subs.length;
      if (submissionCount === 0) continue;

      const averageScorePercent =
        subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) /
        submissionCount;
      const testCount = entry.testIds.size;

      const withDate = subs.filter(
        (s): s is typeof s & { submittedAt: Date } => s.submittedAt != null,
      );
      withDate.sort(
        (a, b) =>
          a.submittedAt.getTime() - b.submittedAt.getTime(),
      );
      const n = withDate.length;
      let trend: SubjectPerformanceTrend = 'STABLE';
      if (n >= 2) {
        const split70 = Math.max(1, Math.floor(n * 0.7));
        const older = withDate.slice(0, split70);
        const recent = withDate.slice(split70);
        const avgOlder =
          older.reduce((a, s) => a + (s.score / s.maxScore) * 100, 0) /
          older.length;
        const avgRecent =
          recent.reduce((a, s) => a + (s.score / s.maxScore) * 100, 0) /
          recent.length;
        const diff = avgRecent - avgOlder;
        if (diff > 5) trend = 'UP';
        else if (diff < -5) trend = 'DOWN';
      }

      subjects.push({
        subjectId: entry.subject.id,
        name: entry.subject.name,
        averageScorePercent: Math.round(averageScorePercent * 10) / 10,
        testCount,
        submissionCount,
        trend,
      });
    }

    subjects.sort((a, b) => a.averageScorePercent - b.averageScorePercent);

    await this.auditService.log({
      action: 'VIEW_SUBJECT_PERFORMANCE',
      entityType: AuditEntityType.CLASSROOM,
      entityId: classroomId,
      userId: user.userId,
      organizationId: classSection.orgId,
    });

    return { classroomId, subjects };
  }

  // -------------------------
  // UPDATE
  // -------------------------
  async update(id: string, dto: UpdateClassroomDto, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      include: { academicYear: { select: { isCurrent: true } } },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');
    assertSameOrganization(classSection.orgId, user, 'třída');
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    let teacherId: string | null | undefined = dto.teacherId;
    if (dto.teacherId !== undefined) {
      teacherId = dto.teacherId ?? null;
      if (teacherId) {
        const t = await this.prisma.teacher.findUnique({
          where: { id: teacherId },
          select: { id: true, organizationId: true, deletedAt: true },
        });
        if (!t || t.deletedAt)
          throw new NotFoundException('Učitel nebyl nalezen.');
        if (t.organizationId !== classSection.orgId)
          throw new ForbiddenException(
            'Učitel není ze stejné organizace jako třída.',
          );
      }
    }

    try {
      const updateData: Prisma.ClassSectionUncheckedUpdateInput = {};
      if (dto.grade !== undefined) {
        updateData.grade = dto.grade;
      }
      if (dto.section !== undefined) {
        updateData.section = dto.section;
      }
      if (dto.label !== undefined) {
        updateData.label = dto.label;
      }
      if (teacherId !== undefined) {
        updateData.teacherId = teacherId;
      }
      // TODO: Přidat studyField do modelu ClassSection a migrace

      const updated = await this.prisma.classSection.update({
        where: { id },
        data: updateData,
      });

      await bumpOrgVersion(
        this.cache,
        cacheScopeForUser(user.systemRole, classSection.orgId),
      );
      return updated; // controller použije orgId pro invalidaci
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // pokud změna (grade/section/…) narazí na unikát
        throw new ConflictException(
          'Třída s tímto ročníkem/sekcí už existuje.',
        );
      }
      throw e;
    }
  }

  // -------------------------
  // DELETE
  // -------------------------
  async remove(id: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      select: { id: true, orgId: true, academicYear: { select: { isCurrent: true } } },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    const deleted = await this.prisma.classSection.delete({ where: { id } });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, classSection.orgId),
    );
    return deleted;
  }

  async setHomeroom(
    classSectionId: string,
    dto: SetHomeroomDto,
    user: JwtPayload,
  ) {
    const cls = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true, teacherId: true, academicYear: { select: { isCurrent: true } } },
    });
    if (!cls) throw new NotFoundException('Třída nebyla nalezena.');
    if (!cls.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze upravovat uzavřený školní rok.');
    }

    const sameOrg = user.organizationId === cls.orgId;
    const isDirector = hasAtLeastRole(
      user.organizationRole ?? null,
      OrganizationRole.DIRECTOR,
    );

    if (
      !(user.systemRole === SystemRole.SUPERADMIN || (sameOrg && isDirector))
    ) {
      throw new ForbiddenException(
        'Pouze ředitel/owner dané školy nebo superadmin může měnit třídnictví.',
      );
    }

    const teacherId: string | null = dto.teacherId ?? null;

    if (teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (!teacher || teacher.deletedAt)
        throw new NotFoundException('Učitel nebyl nalezen.');
      if (teacher.organizationId !== cls.orgId) {
        throw new ForbiddenException(
          'Učitel není ze stejné organizace jako třída.',
        );
      }
    }

    const updated = await this.prisma.classSection.update({
      where: { id: classSectionId },
      data: { teacherId },
      include: {
        academicYear: true,
        teacher: {
          include: {
            membership: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    const scope = cacheScopeForUser(user.systemRole, cls.orgId);
    await bumpOrgVersion(this.cache, scope);

    return updated;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Teacher ↔ ClassSection explicit assignment (TeacherClassSection)
  // ──────────────────────────────────────────────────────────────────────────

  async assignTeacherToClass(
    classSectionId: string,
    teacherId: string,
    orgId: string,
  ) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true },
    });
    if (!classSection || classSection.orgId !== orgId) {
      throw new NotFoundException('Třída nenalezena v organizaci');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw new NotFoundException('Učitel nenalezen v organizaci');
    }

    const record = await this.prisma.teacherClassSection.upsert({
      where: { teacherId_classSectionId: { teacherId, classSectionId } },
      update: { deletedAt: null },
      create: { teacherId, classSectionId },
      select: { id: true, teacherId: true, classSectionId: true, createdAt: true },
    });

    return record;
  }

  async removeTeacherFromClass(
    classSectionId: string,
    teacherId: string,
    orgId: string,
  ) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true },
    });
    if (!classSection || classSection.orgId !== orgId) {
      throw new NotFoundException('Třída nenalezena v organizaci');
    }

    const record = await this.prisma.teacherClassSection.findFirst({
      where: { teacherId, classSectionId, deletedAt: null },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException('Přiřazení učitele k třídě nenalezeno');
    }

    await this.prisma.teacherClassSection.update({
      where: { id: record.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
