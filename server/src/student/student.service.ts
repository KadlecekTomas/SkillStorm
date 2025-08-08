import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AuditEntityType,
  OrganizationRole,
  Prisma,
  SystemRole,
} from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import { canAccessStudent } from './utils/access.utils';
import { QueryStudentsDto } from './dto/query-students.dto';
import * as XLSX from 'xlsx';
import { ExportStudentsDto, ExportTemplate } from './dto/export-students.dto';

function toPrismaSearch(search?: string): Prisma.StudentWhereInput | undefined {
  if (!search) return undefined;
  return {
    OR: [
      {
        membership: {
          is: {
            user: { is: { name: { contains: search, mode: 'insensitive' } } },
          },
        },
      },
      { studentNumber: { contains: search, mode: 'insensitive' } },
      { externalId: { contains: search, mode: 'insensitive' } },
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
  // Přehled pro třídního učitele
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
  // Kontakty pro rozesílky
  kontakty: {
    columns: ['userName', 'userEmail', 'classLabel', 'yearLabel'],
    includeEnrollments: true,
    format: 'csv',
    mode: 'light',
    filename: 'kontakty_studentu',
  },
  // Import do LMS (typicky stačí identifikátory)
  lms: {
    columns: ['userId', 'userEmail', 'userName', 'classLabel', 'yearLabel'],
    includeEnrollments: true,
    format: 'csv',
    mode: 'light',
    filename: 'lms_import',
  },
  // Ředitelský přehled (bohatší)
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
    ] as ExportColumn[],
    includeEnrollments: true,
    format: 'xlsx',
    mode: 'full',
    filename: 'reditelsky_prehled',
  },
};

const ALLOWED_COLUMNS = new Set<string>(DEFAULT_COLUMNS as readonly string[]);

// Pomocník: vyřeš columns / includeEnrollments / format z template + overrides
function resolveExportOptions(q: ExportStudentsDto): {
  columns: ExportColumn[];
  includeEnrollments: boolean;
  format: 'csv' | 'xlsx';
  filenameBase: string;
} {
  const tpl = q.template ? TEMPLATES[q.template] : undefined;

  // sloupce: columns > template.columns > DEFAULT
  const columns: ExportColumn[] =
    q.columns && q.columns.length
      ? (q.columns.filter((c) => ALLOWED_COLUMNS.has(c)) as ExportColumn[])
      : (tpl?.columns ?? [...DEFAULT_COLUMNS]);

  // includeEnrollments: explicitní dotaz > template > default(false pro velké exporty)
  const includeEnrollments =
    typeof q.includeEnrollments === 'boolean'
      ? q.includeEnrollments
      : (tpl?.includeEnrollments ?? true);

  // format: explicitní > template > xlsx
  const format = (q.format ?? tpl?.format ?? 'xlsx') as 'csv' | 'xlsx';

  // filename base: explicitní > template > default
  const filenameBase = (
    q.filename && q.filename.trim().length > 1
      ? q.filename.trim()
      : (tpl?.filename ?? 'students_export')
  ).replace(/[^a-z0-9_\-]/gi, '_');

  return { columns, includeEnrollments, format, filenameBase };
}

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  private async audit(opts: {
    userId?: string;
    orgId?: string;
    action: string;
    entityId?: string;
    metadata?: Record<string, any>;
    changedFields?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.ORGANIZATION, // držíme se schématu
        entityId: opts.entityId ?? null,
        action: opts.action,
        metadata: opts.metadata ?? null,
        changedFields: opts.changedFields ?? null,
      },
    });
  }

  async create(dto: CreateStudentDto, user: JwtPayload) {
    // kontrola membership existence + role
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

    // už existuje Student pro to membership?
    const alreadyStudent = await this.prisma.student.findUnique({
      where: { membershipId: dto.membershipId },
      select: { id: true },
    });
    if (alreadyStudent)
      throw new ForbiddenException('Tento uživatel je již studentem.');

    // business pravidlo: TEACHER/DIRECTOR smí jen v rámci své organizace
    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId !== dto.orgId
    ) {
      throw new ForbiddenException(
        'Nelze vytvářet studenta v jiné organizaci.',
      );
    }

    const created = await this.prisma.student.create({
      data: {
        membershipId: dto.membershipId,
        orgId: dto.orgId,
        studentNumber: dto.studentNumber,
        externalId: dto.externalId,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId: dto.orgId,
      action: 'STUDENT_CREATE',
      entityId: dto.orgId, // logujeme na ORGANIZATION
      metadata: { studentId: created.id, membershipId: dto.membershipId },
      changedFields: dto as any,
    });

    return created;
  }

  async findAll(user: JwtPayload, q: QueryStudentsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const baseWhere: Prisma.StudentWhereInput =
      user.systemRole === SystemRole.SUPERADMIN
        ? { deletedAt: null }
        : { deletedAt: null, orgId: user.organizationId };

    const text = toPrismaSearch(q.search);
    const enr = toEnrollmentFilter(q.yearId, q.classSectionId);

    // 🔧 explicitní typ = konec TS kňourání
    const where: Prisma.StudentWhereInput = {
      ...baseWhere,
      ...(text ?? {}),
      ...(enr ?? {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: {
          membership: { include: { user: true } },
          enrollments: {
            include: {
              academicYear: true,
              classSection: {
                include: {
                  teacher: {
                    include: { membership: { include: { user: true } } },
                  },
                },
              },
            },
          },
        },
        // Student NEMÁ createdAt — použij jméno/číslo jako stabilní pořadí
        orderBy: [
          { membership: { user: { name: 'asc' } } }, // nebo vynech, když nechceš nested sort
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
  }

  async findOne(id: string, user: JwtPayload) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        membership: { include: { user: true } },
        enrollments: {
          include: {
            academicYear: true,
            classSection: {
              include: {
                teacher: {
                  include: { membership: { include: { user: true } } },
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

  async update(id: string, dto: UpdateStudentDto, user: JwtPayload) {
    const student = await this.getStudentWithContext(id);
    canAccessStudent(student, user);

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        studentNumber: dto.studentNumber ?? undefined,
        externalId: dto.externalId ?? undefined,
      },
    });

    await this.audit({
      userId: user.userId,
      orgId: student.orgId,
      action: 'STUDENT_UPDATE',
      entityId: student.orgId,
      metadata: { studentId: student.id },
      changedFields: dto as any,
    });

    return updated;
  }

  async remove(id: string, user: JwtPayload) {
    const student = await this.getStudentWithContext(id);

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      !(
        user.organizationRole === OrganizationRole.DIRECTOR &&
        user.organizationId === student.orgId
      )
    ) {
      throw new ForbiddenException(
        'Mazat studenta může jen ředitel nebo superadmin.',
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

    return deleted;
  }

  private async getStudentWithContext(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        membership: { include: { user: true } },
        enrollments: {
          include: {
            academicYear: true,
            classSection: {
              include: {
                teacher: {
                  include: { membership: { include: { user: true } } },
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

  async export(
    user: JwtPayload,
    q: ExportStudentsDto,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const batchSize = q.batchSize ?? 1000;

    // 🔥 z template vyřeš vše potřebné (s ohledem na overrides)
    const { columns, includeEnrollments, format, filenameBase } =
      resolveExportOptions(q);

    // WHERE podle oprávnění + filtrů (beze změny)
    const baseWhere: Prisma.StudentWhereInput =
      user.systemRole === SystemRole.SUPERADMIN
        ? { deletedAt: null }
        : { deletedAt: null, orgId: user.organizationId };

    const where: Prisma.StudentWhereInput = {
      ...baseWhere,
      ...(toPrismaSearch(q.search) ?? {}),
      ...(toEnrollmentFilter(q.yearId, q.classSectionId) ?? {}),
    };

    // (volitelná automatika) pokud je moc řádků a uživatel dal xlsx → přepni na csv
    const total = await this.prisma.student.count({ where });
    const bookType = total > 20000 && format === 'xlsx' ? 'csv' : format;

    // pevně typovaný include → typově víme o user/enrollments
    const studentInclude = Prisma.validator<Prisma.StudentInclude>()({
      organization: true,
      membership: { include: { user: true } },
      enrollments: {
        include: {
          academicYear: true,
          classSection: {
            include: {
              teacher: { include: { membership: { include: { user: true } } } },
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

    await this.audit({
      userId: user.userId,
      orgId:
        user.systemRole === SystemRole.SUPERADMIN ? null : user.organizationId,
      action: `STUDENT_EXPORT_${String(bookType).toUpperCase()}`,
      entityId:
        user.systemRole === SystemRole.SUPERADMIN
          ? null
          : (user.organizationId ?? undefined),
      metadata: {
        total,
        filters: {
          search: q.search,
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
