import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AuditEntityType,
  EnrollmentStatus,
  OrganizationRole,
  Prisma,
  SystemRole,
} from '@prisma/client';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { canAccessStudent } from './utils/access.utils';
import type { QueryStudentsDto } from './dto/query-students.dto';
import { hasAtLeastRole } from '@/shared/access.utils';
import * as XLSX from 'xlsx';
import type {
  ExportStudentsDto,
  ExportTemplate,
} from './dto/export-students.dto';
import type {
  StudentDetailResponse,
  StudentDetailPerformanceSummary,
} from './dto/student-detail.dto';
import {
  computeStudentPerformance,
  type SubmissionForPerformance,
} from './student-performance.util';
import { AuditService } from '@/audit/audit.service';

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  bumpOrgVersion,
  cacheGetOrSet,
  cacheScopeForUser,
  getOrgVersion,
} from '@/shared/cache/org-cache.utils';

function toPrismaSearch(search?: string): Prisma.StudentWhereInput | undefined {
  const s = (search ?? '').trim();
  if (!s) return undefined;

  return {
    OR: [
      // jméno / email (uživatelský účet studenta)
      {
        membership: {
          is: { user: { is: { name: { contains: s, mode: 'insensitive' } } } },
        },
      },
      {
        membership: {
          is: { user: { is: { email: { contains: s, mode: 'insensitive' } } } },
        },
      },

      // studentNumber
      { studentNumber: { equals: s, mode: 'insensitive' } },
      { studentNumber: { contains: s, mode: 'insensitive' } },

      // externalId
      { externalId: { equals: s, mode: 'insensitive' } },
      { externalId: { contains: s, mode: 'insensitive' } },
    ],
  };
}

function toEnrollmentFilter(
  yearId?: string,
  classSectionId?: string,
): Prisma.StudentWhereInput | undefined {
  if (!yearId && !classSectionId) return undefined;
  return {
    enrollments: {
      some: {
        ...(yearId ? { yearId } : {}),
        ...(classSectionId ? { classSectionId } : {}),
      },
    },
  };
}

/**
 * Žáci dostupní pro zápis: nemají aktivní Enrollment v dané třídě v daném roce.
 */
function toAvailableForEnrollmentFilter(
  classSectionId?: string,
  yearId?: string,
): Prisma.StudentWhereInput | undefined {
  if (!classSectionId || !yearId) return undefined;
  return {
    enrollments: {
      none: {
        classSectionId,
        yearId,
        status: { not: EnrollmentStatus.LEFT },
      },
    },
  };
}

// ---- export helpers (beze změny) ----
const DEFAULT_COLUMNS = [
  'studentId',
  'orgId',
  'userId',
  'userName',
  'userEmail',
  'studentNumber',
  'externalId',
  'classLabel',
  'classGrade',
  'classSection',
  'teacherName',
  'yearLabel',
  'isCurrentYear',
] as const;
type ExportColumn = (typeof DEFAULT_COLUMNS)[number];
type TemplateConfig = {
  columns: ExportColumn[];
  includeEnrollments: boolean;
  format?: 'csv' | 'xlsx';
  mode?: 'light' | 'full';
  filename?: string;
};
const TEMPLATES: Record<ExportTemplate, TemplateConfig> = {
  tridni: {
    columns: [
      'userName',
      'studentNumber',
      'classLabel',
      'teacherName',
      'yearLabel',
    ],
    includeEnrollments: true,
    format: 'xlsx',
    mode: 'light',
    filename: 'prechled_tridni',
  },
  kontakty: {
    columns: ['userName', 'userEmail', 'classLabel', 'yearLabel'],
    includeEnrollments: true,
    format: 'csv',
    mode: 'light',
    filename: 'kontakty_studentu',
  },
  lms: {
    columns: ['userId', 'userEmail', 'userName', 'classLabel', 'yearLabel'],
    includeEnrollments: true,
    format: 'csv',
    mode: 'light',
    filename: 'lms_import',
  },
  reditel: {
    columns: [
      'classLabel',
      'classGrade',
      'classSection',
      'yearLabel',
      'isCurrentYear',
      'userName',
      'studentNumber',
      'userEmail',
    ],
    includeEnrollments: true,
    format: 'xlsx',
    mode: 'full',
    filename: 'reditelsky_prehled',
  },
};
const ALLOWED_COLUMNS = new Set<string>(DEFAULT_COLUMNS as readonly string[]);
function resolveExportOptions(q: ExportStudentsDto): {
  columns: ExportColumn[];
  includeEnrollments: boolean;
  format: 'csv' | 'xlsx';
  filenameBase: string;
} {
  const tpl = q.template ? TEMPLATES[q.template] : undefined;
  const columns: ExportColumn[] =
    q.columns && q.columns.length
      ? (q.columns.filter((c) => ALLOWED_COLUMNS.has(c)) as ExportColumn[])
      : (tpl?.columns ?? [...DEFAULT_COLUMNS]);
  const includeEnrollments =
    typeof q.includeEnrollments === 'boolean'
      ? q.includeEnrollments
      : (tpl?.includeEnrollments ?? true);
  const format = (q.format ?? tpl?.format ?? 'xlsx') as 'csv' | 'xlsx';
  const filenameBase = (
    q.filename && q.filename.trim().length > 1
      ? q.filename.trim()
      : (tpl?.filename ?? 'students_export')
  ).replace(/[^a-z0-9_\-]/gi, '_');
  return { columns, includeEnrollments, format, filenameBase };
}

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly auditService: AuditService,
  ) {}

  private async audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
    changedFields?: Prisma.InputJsonValue;
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

  // ---------- CREATE ----------
  async create(dto: CreateStudentDto, user: JwtPayload) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: dto.membershipId },
      select: { id: true, role: true, organizationId: true },
    });

    if (!membership)
      throw new NotFoundException('Zadané membershipId neexistuje.');
    if (membership.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException('Membership nemá roli STUDENT.');
    }
    if (membership.organizationId !== dto.orgId) {
      throw new ForbiddenException('Membership nepatří do zadané organizace.');
    }
    const alreadyStudent = await this.prisma.student.findUnique({
      where: { membershipId: dto.membershipId },
      select: { id: true },
    });
    if (alreadyStudent)
      throw new ForbiddenException('Tento uživatel je již studentem.');

    const classSection = await this.prisma.classSection.findUnique({
      where: { id: dto.classSectionId },
      select: { id: true, orgId: true, yearId: true, academicYear: { select: { isCurrent: true } } },
    });
    if (!classSection) {
      throw new NotFoundException('Třída nebyla nalezena.');
    }
    const orgId = classSection.orgId;
    if (classSection.orgId !== dto.orgId) {
      throw new ForbiddenException('Třída není ve stejné organizaci.');
    }
    if (membership.organizationId !== orgId) {
      throw new ForbiddenException('Membership nepatří do zadané organizace.');
    }
    if (user.systemRole !== SystemRole.SUPERADMIN && user.organizationId !== orgId) {
      throw new ForbiddenException('Nelze vytvářet studenta v jiné organizaci.');
    }
    if (classSection.yearId !== dto.academicYearId) {
      throw new BadRequestException('Školní rok neodpovídá třídě.');
    }
    if (!classSection.academicYear?.isCurrent) {
      throw new ForbiddenException('Nelze zapisovat do uzavřeného školního roku.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const classSectionTx = await tx.classSection.findUnique({
        where: { id: dto.classSectionId },
        select: { orgId: true, yearId: true },
      });
      if (!classSectionTx) {
        throw new NotFoundException('Třída nebyla nalezena.');
      }

      const student = await tx.student.create({
        data: {
          membershipId: dto.membershipId,
          orgId: classSectionTx.orgId,
          studentNumber: dto.studentNumber ?? null,
          externalId: dto.externalId ?? null,
        },
      });
      await tx.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId: dto.classSectionId,
          yearId: classSectionTx.yearId,
          orgId: classSectionTx.orgId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      return student;
    });

    await this.audit({
      userId: user.userId,
      orgId,
      action: 'STUDENT_CREATE',
      entityId: orgId,
      metadata: { studentId: created.id, membershipId: dto.membershipId },
      changedFields: dto as any,
    });

    // 🔔 invalidace org‑scoped cache (listy studentů)
    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, orgId),
    );

    return created;
  }

  // ---------- LIST (versioned list cache) ----------
  async findAll(user: JwtPayload, q: QueryStudentsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const baseWhere: Prisma.StudentWhereInput = { deletedAt: null };
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId) {
        throw new ForbiddenException('Missing organization context.');
      }
      baseWhere.orgId = user.organizationId;
    }

    const availableFor = toAvailableForEnrollmentFilter(
      q.availableForClassSectionId,
      q.availableForYearId,
    );
    const enrollmentFilter = toEnrollmentFilter(q.yearId, q.classSectionId);
    if (availableFor && enrollmentFilter) {
      throw new BadRequestException(
        'availableForClassSectionId/availableForYearId nelze kombinovat s yearId/classSectionId.',
      );
    }

    const where: Prisma.StudentWhereInput = {
      ...baseWhere,
      ...(toPrismaSearch(q.search) ?? {}),
      ...(enrollmentFilter ?? {}),
      ...(availableFor ?? {}),
    };

    // verze podle scope (superadmin → 'ALL', jinak orgId)
    const scopeId = cacheScopeForUser(user.systemRole, user.organizationId);
    const ver = await getOrgVersion(this.cache, scopeId);

    const cacheKey = buildVersionedListKey({
      namespace: 'students',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search ?? '',
      includeLevels: false,
      order: [{ 'membership.user.name': 'asc' }, { studentNumber: 'asc' }],
      filters: {
        yearId: q.yearId ?? null,
        classSectionId: q.classSectionId ?? null,
        availableForClassSectionId: q.availableForClassSectionId ?? null,
        availableForYearId: q.availableForYearId ?? null,
      },
    });

    return cacheGetOrSet(this.cache, cacheKey, 300_000, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.student.count({ where }),
        this.prisma.student.findMany({
          where,
          include: {
            membership: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
            enrollments: {
              include: {
                academicYear: true,
                classSection: {
                  include: {
                    teacher: {
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
              },
            },
          },
          orderBy: [
            { membership: { user: { name: 'asc' } } },
            { studentNumber: 'asc' },
            { membershipId: 'asc' },
          ],
          skip,
          take: limit,
        }),
      ]);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }

  // ---------- DETAIL ----------
  async findOne(id: string, user: JwtPayload) {
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
          include: {
            academicYear: true,
            classSection: {
              include: {
                teacher: {
                  include: {
                    membership: {
                      select: {
                        userId: true,
                        user: { select: { id: true, name: true, email: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student || student.deletedAt)
      throw new NotFoundException('Student nenalezen.');

    canAccessStudent(student, user);
    return student;
  }

  // ---------- UPDATE ----------
  async update(id: string, dto: UpdateStudentDto, user: JwtPayload) {
    const student = await this.getStudentWithContext(id);
    canAccessStudent(student, user);

    const data: Prisma.StudentUncheckedUpdateInput = {};
    if (dto.studentNumber !== undefined) {
      data.studentNumber = dto.studentNumber;
    }
    if (dto.externalId !== undefined) {
      data.externalId = dto.externalId;
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data,
    });

    await this.audit({
      userId: user.userId,
      orgId: student.orgId,
      action: 'STUDENT_UPDATE',
      entityId: student.orgId,
      metadata: { studentId: student.id },
      changedFields: dto as any,
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, student.orgId),
    );
    return updated;
  }

  // ---------- DELETE (soft) ----------
  async remove(id: string, user: JwtPayload) {
    // Soft delete: výsledky studenta musí zůstat auditně dohledatelné.
    const student = await this.getStudentWithContext(id);

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      !(
        hasAtLeastRole(user.organizationRole ?? null, OrganizationRole.DIRECTOR) &&
        user.organizationId === student.orgId
      )
    ) {
      throw new ForbiddenException(
        'Mazat studenta může jen ředitel/owner nebo superadmin.',
      );
    }

    const deleted = await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit({
      userId: user.userId,
      orgId: deleted.orgId,
      action: 'STUDENT_DELETE_SOFT',
      entityId: deleted.orgId,
      metadata: { studentId: deleted.id },
    });

    await bumpOrgVersion(
      this.cache,
      cacheScopeForUser(user.systemRole, deleted.orgId),
    );
    return deleted;
  }

  /**
   * GDPR-minimal student detail. Called after StudentAccessGuard.
   * Returns only: id, displayName, classroomLabel, performanceSummary, progressByTopic, recentTests.
   */
  async getDetail(id: string, user: JwtPayload, yearId?: string): Promise<StudentDetailResponse> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        deletedAt: true,
        membershipId: true,
        membership: {
          select: {
            user: { select: { name: true } },
          },
        },
        enrollments: {
          where: {
            status: EnrollmentStatus.ACTIVE,
            ...(yearId ? { yearId } : {}),
          },
          select: {
            yearId: true,
            academicYear: { select: { isCurrent: true, label: true } },
            classSection: { select: { label: true, grade: true, section: true } },
          },
          orderBy: { academicYear: { isCurrent: 'desc' } },
          take: 20,
        },
      },
    });
    if (!student || student.deletedAt)
      throw new NotFoundException('Student nenalezen.');

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId != null &&
      student.orgId !== user.organizationId
    ) {
      throw new ForbiddenException('Nemáš oprávnění zobrazit detail tohoto žáka.');
    }

    // Guard: yearId must belong to this student's org — prevents cross-org year enumeration.
    if (yearId) {
      const yearRecord = await this.prisma.academicYear.findFirst({
        where: { id: yearId, orgId: student.orgId, deletedAt: null },
        select: { id: true },
      });
      if (!yearRecord) {
        throw new BadRequestException({
          code: 'INVALID_YEAR',
          message: 'Zadaný školní rok nebyl nalezen v této organizaci.',
        });
      }
    }

    const displayName =
      student.membership?.user?.name?.trim() || 'Žák';
    // When yearId is provided, find that year's enrollment; otherwise prefer current year
    const currentEnrollment = yearId
      ? student.enrollments?.find((e) => e.yearId === yearId) ?? student.enrollments?.[0]
      : student.enrollments?.find((e) => e.academicYear?.isCurrent) ?? student.enrollments?.[0];
    const classroomLabel =
      currentEnrollment?.classSection?.label ||
      [currentEnrollment?.classSection?.grade, currentEnrollment?.classSection?.section]
        .filter(Boolean)
        .join(' ') ||
      '—';

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId: student.membershipId,
        deletedAt: null,
        ...(yearId ? { assignment: { yearId } } : {}),
      },
      select: {
        score: true,
        submittedAt: true,
        testId: true,
        assignment: {
          select: {
            topicLevelId: true,
            topicLevel: {
              select: {
                id: true,
                catalogTopic: { select: { name: true } },
              },
            },
            test: {
              select: {
                id: true,
                title: true,
                questions: { select: { score: true } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
    });

    // ── Map to SubmissionForPerformance and delegate to shared util ──────────
    const submissionsForPerf: SubmissionForPerformance[] = submissions.map(
      (s) => {
        const test = s.assignment?.test;
        const tl = s.assignment?.topicLevel;
        return {
          testId: s.testId,
          title: test?.title ?? '—',
          score: s.score,
          maxScore:
            test?.questions?.reduce((sum, q) => sum + (q.score ?? 0), 0) ?? 0,
          submittedAt: s.submittedAt,
          topicLevelId: tl?.id ?? null,
          topicName: tl?.catalogTopic?.name ?? null,
        };
      },
    );

    const {
      completedTests,
      averageScore,
      progressByTopic,
      recentTests,
      lastActivityAt,
    } = computeStudentPerformance(submissionsForPerf);

    await this.auditService.log({
      action: 'VIEW_DETAIL',
      entityType: AuditEntityType.STUDENT,
      entityId: id,
      userId: user.userId,
      organizationId: student.orgId ?? user.organizationId ?? null,
    });

    const performanceSummary: StudentDetailPerformanceSummary = {
      averageScore,
      completedTests,
      lastActivityAt,
    };

    return {
      id: student.id,
      displayName,
      classroomLabel,
      performanceSummary,
      progressByTopic,
      recentTests,
    };
  }

  private async getStudentWithContext(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        membership: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        enrollments: {
          include: {
            academicYear: true,
            classSection: {
              include: {
                teacher: {
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
          },
        },
      },
    });
    if (!student || student.deletedAt)
      throw new NotFoundException('Student nenalezen.');
    return student;
  }

  // ---------- EXPORT (beze změny logiky) ----------
  async export(
    user: JwtPayload,
    q: ExportStudentsDto,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const batchSize = q.batchSize ?? 1000;
    const { columns, includeEnrollments, format, filenameBase } =
      resolveExportOptions(q);

    const baseWhere: Prisma.StudentWhereInput = { deletedAt: null };
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!user.organizationId) {
        throw new ForbiddenException('Missing organization context.');
      }
      baseWhere.orgId = user.organizationId;
    }

    const where: Prisma.StudentWhereInput = {
      ...baseWhere,
      ...(toPrismaSearch(q.search) ?? {}),
      ...(toEnrollmentFilter(q.yearId, q.classSectionId) ?? {}),
    };

    const total = await this.prisma.student.count({ where });
    const bookType = total > 20000 && format === 'xlsx' ? 'csv' : format;

    const studentInclude = Prisma.validator<Prisma.StudentInclude>()({
      organization: true,
      membership: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      enrollments: {
        include: {
          academicYear: true,
          classSection: {
            include: {
              teacher: {
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
        },
      },
    });
    type StudentWithAll = Prisma.StudentGetPayload<{
      include: typeof studentInclude;
    }>;

    const wb = XLSX.utils.book_new();
    const rows: any[] = [];

    for (let skip = 0; skip < total; skip += batchSize) {
      const chunk: StudentWithAll[] = await this.prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: [
          { membership: { user: { name: 'asc' } } },
          { membershipId: 'asc' },
        ],
        skip,
        take: batchSize,
      });

      for (const s of chunk) {
        const base = {
          studentId: s.id,
          orgId: s.orgId,
          userId: s.membership?.user?.id ?? null,
          userName: s.membership?.user?.name ?? null,
          userEmail: s.membership?.user?.email ?? null,
          studentNumber: s.studentNumber ?? null,
          externalId: s.externalId ?? null,
        };

        const enrolls =
          includeEnrollments && s.enrollments?.length ? s.enrollments : [null];
        for (const e of enrolls) {
          const row = {
            ...base,
            classLabel: e
              ? (e.classSection?.label ??
                `${e.classSection?.grade ?? ''}${e.classSection?.section ? '.' + e.classSection.section : ''}`)
              : null,
            classGrade: e?.classSection?.grade ?? null,
            classSection: e?.classSection?.section ?? null,
            teacherName:
              e?.classSection?.teacher?.membership?.user?.name ?? null,
            yearLabel: e?.academicYear?.label ?? null,
            isCurrentYear: e?.academicYear?.isCurrent ?? null,
          };
          rows.push(this.pickColumns(row, columns));
        }
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    XLSX.utils.sheet_add_aoa(ws, [columns as string[]], { origin: 'A1' });
    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType });

    // audit exportu
    const exportOrgId =
      user.systemRole === SystemRole.SUPERADMIN
        ? null
        : (user.organizationId ?? null);

    await this.audit({
      userId: user.userId,
      orgId: exportOrgId,
      action: `STUDENT_EXPORT_${String(bookType).toUpperCase()}`,
      ...(exportOrgId ? { entityId: exportOrgId } : {}),
      metadata: {
        total,
        filters: {
          search: q.search ?? '',
          yearId: q.yearId,
          classSectionId: q.classSectionId,
        },
        columns,
        batchSize,
        template: q.template ?? null,
        requestedFormat: q.format ?? null,
        resolvedFormat: bookType,
      },
    });

    const filename = `${filenameBase}.${bookType === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType =
      bookType === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8';

    return { buffer, contentType, filename };
  }

  private pickColumns(
    row: Record<string, any>,
    columns: ReadonlyArray<string>,
  ) {
    const out: Record<string, any> = {};
    for (const c of columns) out[c] = row[c] ?? null;
    return out;
  }
}
