import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  GuardianPermissionKey,
  GuardianRelationStatus,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { OrgContextService } from '@/common/org-context/org-context.service';
import type { OrgContext } from '@/common/org-context/org-context.types';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { CreateProgressEntryDto } from './dto/create-progress-entry.dto';
import { CreateAttendanceRecordDto } from './dto/create-attendance-record.dto';
import { CreateInterventionDto } from './dto/create-intervention.dto';
import { CreateCompetencyDto } from './dto/create-competency.dto';
import {
  AttendanceStatus,
  InterventionStatus,
  ProgressEntryType,
  type ProgressContext,
} from './progress.types';

type CompetencyRow = {
  id: string;
  subjectId: string | null;
  name: string;
  description: string | null;
  scaleMin: number;
  scaleMax: number;
};

type ProgressRow = {
  id: string;
  type: ProgressEntryType;
  gradeValue: number | null;
  competencyLevel: number | null;
  comment: string | null;
  subjectId: string | null;
  subjectName: string | null;
  competencyId: string | null;
  competencyName: string | null;
  scaleMin: number | null;
  scaleMax: number | null;
  authorName: string;
  occurredAt: Date;
};

type AttendanceRow = {
  id: string;
  status: AttendanceStatus;
  minutesLate: number | null;
  note: string | null;
  subjectName: string | null;
  occurredAt: Date;
};

type InterventionRow = {
  id: string;
  title: string;
  note: string | null;
  status: InterventionStatus;
  subjectName: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
};

type DashboardRow = {
  classSectionId: string;
  classLabel: string;
  studentCount: number;
  averageGrade: number | null;
  averageCompetency: number | null;
  attendanceRate: number | null;
  openInterventions: number;
  progressEntries: number;
};

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orgContext: OrgContextService,
  ) {}

  async getContext(user: JwtPayload): Promise<ProgressContext> {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const yearId = this.requireCurrentYear(ctx);
    const now = new Date();

    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, orgId: ctx.organizationId, deletedAt: null },
      select: { id: true, label: true },
    });
    if (!year) throw new NotFoundException('Active academic year not found');

    let teacherId: string | null = null;
    let teacherSubjectIds: string[] | null = null;
    if (ctx.role === OrganizationRole.TEACHER) {
      const teacher = await this.teacherForContext(ctx);
      teacherId = teacher.id;
      const teacherSubjects = await this.prisma.teacherSubject.findMany({
        where: { teacherId },
        select: { subjectId: true },
      });
      teacherSubjectIds = teacherSubjects.map((item) => item.subjectId);
    }

    const classes = await this.prisma.classSection.findMany({
      where: {
        orgId: ctx.organizationId,
        yearId,
        ...(teacherId
          ? {
              OR: [
                { teacherId },
                {
                  teachers: {
                    some: {
                      teacherId,
                      yearId,
                      deletedAt: null,
                      OR: [{ validFrom: null }, { validFrom: { lte: now } }],
                      AND: [
                        {
                          OR: [{ validTo: null }, { validTo: { gte: now } }],
                        },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
      select: {
        id: true,
        label: true,
        grade: true,
        section: true,
        enrollments: {
          where: {
            yearId,
            status: EnrollmentStatus.ACTIVE,
            student: { deletedAt: null },
          },
          orderBy: { student: { membership: { user: { name: 'asc' } } } },
          select: {
            student: {
              select: {
                id: true,
                membership: { select: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    const orgSubjects = await this.prisma.orgSubject.findMany({
      where: {
        organizationId: ctx.organizationId,
        isEnabled: true,
        ...(teacherSubjectIds
          ? { subjectId: { in: teacherSubjectIds.length ? teacherSubjectIds : ['__none__'] } }
          : {}),
        subject: { deletedAt: null },
      },
      orderBy: { subject: { name: 'asc' } },
      select: { subject: { select: { id: true, name: true } } },
    });
    const subjects = orgSubjects.map((item) => item.subject);
    const allowedSubjectIds = new Set(subjects.map((subject) => subject.id));

    const competencies = await this.listCompetencies(ctx.organizationId);

    return {
      academicYear: year,
      classes: classes.map((classSection) => ({
        id: classSection.id,
        label: this.classLabel(classSection.label, classSection.grade, classSection.section),
        grade: classSection.grade,
        students: classSection.enrollments.map((enrollment) => ({
          id: enrollment.student.id,
          name: enrollment.student.membership.user.name,
        })),
      })),
      subjects,
      competencies: competencies.filter(
        (competency) =>
          competency.subjectId === null || allowedSubjectIds.has(competency.subjectId),
      ),
    };
  }

  async createCompetency(dto: CreateCompetencyDto, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertLeadershipRole(ctx);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('COMPETENCY_NAME_REQUIRED');
    const scaleMin = dto.scaleMin ?? 1;
    const scaleMax = dto.scaleMax ?? 4;
    if (scaleMax < scaleMin) {
      throw new BadRequestException('COMPETENCY_SCALE_INVALID');
    }
    if (dto.subjectId) await this.assertSubjectEnabled(dto.subjectId, ctx, false);

    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "competency_id" AS id
      FROM "competencies"
      WHERE "organization_id" = ${ctx.organizationId}
        AND "subject_id" IS NOT DISTINCT FROM ${dto.subjectId ?? null}
        AND lower("name") = lower(${name})
        AND "deleted_at" IS NULL
      LIMIT 1
    `);
    if (existing[0]) throw new BadRequestException('COMPETENCY_ALREADY_EXISTS');

    const id = randomUUID();
    const rows = await this.prisma.$queryRaw<CompetencyRow[]>(Prisma.sql`
      INSERT INTO "competencies" (
        "competency_id", "organization_id", "subject_id", "name", "description",
        "scale_min", "scale_max", "created_at", "updated_at"
      ) VALUES (
        ${id}, ${ctx.organizationId}, ${dto.subjectId ?? null}, ${name},
        ${dto.description?.trim() || null}, ${scaleMin}, ${scaleMax}, NOW(), NOW()
      )
      RETURNING
        "competency_id" AS id,
        "subject_id" AS "subjectId",
        "name",
        "description",
        "scale_min" AS "scaleMin",
        "scale_max" AS "scaleMax"
    `);

    await this.audit.log({
      action: 'COMPETENCY_CREATED',
      entityType: 'STUDENT',
      entityId: id,
      userId: user.userId,
      organizationId: ctx.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: {
        subjectId: dto.subjectId ?? null,
        scaleMin,
        scaleMax,
      },
    });
    return rows[0];
  }

  async createEntry(dto: CreateProgressEntryDto, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const student = await this.resolveStudentForStaff(dto.studentId, ctx);

    const competency = dto.competencyId
      ? await this.findCompetency(dto.competencyId, ctx.organizationId)
      : null;
    let subjectId = dto.subjectId ?? competency?.subjectId ?? null;
    if (competency && dto.subjectId && competency.subjectId && competency.subjectId !== dto.subjectId) {
      throw new BadRequestException('COMPETENCY_SUBJECT_MISMATCH');
    }
    if (subjectId) {
      await this.assertSubjectEnabled(subjectId, ctx, true);
    }

    if (dto.gradeValue !== undefined && !subjectId) {
      throw new BadRequestException('GRADE_REQUIRES_SUBJECT');
    }
    if (dto.competencyLevel !== undefined && !competency) {
      throw new BadRequestException('COMPETENCY_LEVEL_REQUIRES_COMPETENCY');
    }
    if (
      competency &&
      dto.competencyLevel !== undefined &&
      (dto.competencyLevel < competency.scaleMin || dto.competencyLevel > competency.scaleMax)
    ) {
      throw new BadRequestException('COMPETENCY_LEVEL_OUT_OF_SCALE');
    }

    const comment = dto.comment?.trim() || null;
    if (dto.gradeValue === undefined && dto.competencyLevel === undefined && !comment) {
      throw new BadRequestException('PROGRESS_VALUE_REQUIRED');
    }
    const type = dto.type ?? ProgressEntryType.ASSESSMENT;
    if (
      type === ProgressEntryType.ASSESSMENT &&
      dto.gradeValue === undefined &&
      dto.competencyLevel === undefined
    ) {
      throw new BadRequestException('ASSESSMENT_VALUE_REQUIRED');
    }

    if (dto.clientMutationId) {
      const duplicate = await this.findEntryByMutation(
        ctx.organizationId,
        ctx.membershipId,
        dto.clientMutationId,
      );
      if (duplicate) return { ...duplicate, duplicate: true };
    }

    const id = randomUUID();
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('OCCURRED_AT_INVALID');
    }

    const inserted = await this.prisma.$queryRaw<
      Array<{
        id: string;
        studentId: string;
        subjectId: string | null;
        competencyId: string | null;
        gradeValue: number | null;
        competencyLevel: number | null;
        comment: string | null;
        type: ProgressEntryType;
        occurredAt: Date;
        clientMutationId: string | null;
      }>
    >(Prisma.sql`
      INSERT INTO "student_progress_entries" (
        "progress_entry_id", "organization_id", "student_id", "academic_year_id",
        "class_section_id", "subject_id", "competency_id", "created_by_id",
        "entry_type", "grade_value", "competency_level", "comment",
        "client_mutation_id", "occurred_at", "created_at", "updated_at"
      ) VALUES (
        ${id}, ${ctx.organizationId}, ${student.id}, ${student.yearId},
        ${student.classSectionId}, ${subjectId}, ${competency?.id ?? null}, ${ctx.membershipId},
        CAST(${type} AS "ProgressEntryType"), ${dto.gradeValue ?? null},
        ${dto.competencyLevel ?? null}, ${comment}, ${dto.clientMutationId ?? null},
        ${occurredAt}, NOW(), NOW()
      )
      RETURNING
        "progress_entry_id" AS id,
        "student_id" AS "studentId",
        "subject_id" AS "subjectId",
        "competency_id" AS "competencyId",
        "grade_value" AS "gradeValue",
        "competency_level" AS "competencyLevel",
        "comment",
        "entry_type"::text AS type,
        "occurred_at" AS "occurredAt",
        "client_mutation_id" AS "clientMutationId"
    `);

    await this.audit.log({
      action: 'STUDENT_PROGRESS_CREATED',
      entityType: 'STUDENT',
      entityId: student.id,
      userId: user.userId,
      organizationId: ctx.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: {
        progressEntryId: id,
        classSectionId: student.classSectionId,
        subjectId,
        competencyId: competency?.id ?? null,
        type,
        hasGrade: dto.gradeValue !== undefined,
        hasCompetencyLevel: dto.competencyLevel !== undefined,
        hasComment: Boolean(comment),
      },
    });

    return { ...inserted[0], duplicate: false };
  }

  async syncEntries(entries: CreateProgressEntryDto[], user: JwtPayload) {
    const results: Array<{
      clientMutationId: string | null;
      status: 'SYNCED' | 'FAILED';
      entry?: unknown;
      error?: string;
    }> = [];
    for (const entry of entries) {
      try {
        const created = await this.createEntry(entry, user);
        results.push({
          clientMutationId: entry.clientMutationId ?? null,
          status: 'SYNCED',
          entry: created,
        });
      } catch (error) {
        results.push({
          clientMutationId: entry.clientMutationId ?? null,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'SYNC_FAILED',
        });
      }
    }
    return { results };
  }

  async createAttendance(dto: CreateAttendanceRecordDto, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const student = await this.resolveStudentForStaff(dto.studentId, ctx);
    if (dto.subjectId) await this.assertSubjectEnabled(dto.subjectId, ctx, true);
    if (dto.status !== AttendanceStatus.LATE && dto.minutesLate !== undefined) {
      throw new BadRequestException('MINUTES_LATE_ONLY_FOR_LATE');
    }

    const id = randomUUID();
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const rows = await this.prisma.$queryRaw<Array<{ id: string; occurredAt: Date }>>(Prisma.sql`
      INSERT INTO "attendance_records" (
        "attendance_record_id", "organization_id", "student_id", "academic_year_id",
        "class_section_id", "subject_id", "created_by_id", "status",
        "minutes_late", "note", "occurred_at", "created_at", "updated_at"
      ) VALUES (
        ${id}, ${ctx.organizationId}, ${student.id}, ${student.yearId},
        ${student.classSectionId}, ${dto.subjectId ?? null}, ${ctx.membershipId},
        CAST(${dto.status} AS "AttendanceStatus"), ${dto.minutesLate ?? null},
        ${dto.note?.trim() || null}, ${occurredAt}, NOW(), NOW()
      )
      RETURNING "attendance_record_id" AS id, "occurred_at" AS "occurredAt"
    `);

    await this.audit.log({
      action: 'ATTENDANCE_RECORDED',
      entityType: 'STUDENT',
      entityId: student.id,
      userId: user.userId,
      organizationId: ctx.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: {
        attendanceRecordId: id,
        classSectionId: student.classSectionId,
        subjectId: dto.subjectId ?? null,
        status: dto.status,
        minutesLate: dto.minutesLate ?? null,
      },
    });
    return { id, studentId: student.id, status: dto.status, occurredAt: rows[0]?.occurredAt };
  }

  async createIntervention(dto: CreateInterventionDto, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const student = await this.resolveStudentForStaff(dto.studentId, ctx);
    if (dto.subjectId) await this.assertSubjectEnabled(dto.subjectId, ctx, true);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('INTERVENTION_TITLE_REQUIRED');

    const id = randomUUID();
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "student_interventions" (
        "intervention_id", "organization_id", "student_id", "academic_year_id",
        "class_section_id", "subject_id", "created_by_id", "title", "note",
        "status", "started_at", "created_at", "updated_at"
      ) VALUES (
        ${id}, ${ctx.organizationId}, ${student.id}, ${student.yearId},
        ${student.classSectionId}, ${dto.subjectId ?? null}, ${ctx.membershipId},
        ${title}, ${dto.note?.trim() || null}, CAST(${InterventionStatus.OPEN} AS "InterventionStatus"),
        NOW(), NOW(), NOW()
      )
    `);

    await this.audit.log({
      action: 'STUDENT_INTERVENTION_CREATED',
      entityType: 'STUDENT',
      entityId: student.id,
      userId: user.userId,
      organizationId: ctx.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: {
        interventionId: id,
        classSectionId: student.classSectionId,
        subjectId: dto.subjectId ?? null,
      },
    });
    return { id, studentId: student.id, status: InterventionStatus.OPEN };
  }

  async resolveIntervention(interventionId: string, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const rows = await this.prisma.$queryRaw<Array<{ studentId: string; status: InterventionStatus }>>(Prisma.sql`
      SELECT "student_id" AS "studentId", "status"::text AS status
      FROM "student_interventions"
      WHERE "intervention_id" = ${interventionId}
        AND "organization_id" = ${ctx.organizationId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) throw new NotFoundException('Intervention not found');
    await this.resolveStudentForStaff(row.studentId, ctx);
    if (row.status === InterventionStatus.RESOLVED) {
      return { id: interventionId, status: InterventionStatus.RESOLVED, alreadyResolved: true };
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "student_interventions"
      SET "status" = CAST(${InterventionStatus.RESOLVED} AS "InterventionStatus"),
          "resolved_at" = NOW(), "updated_at" = NOW()
      WHERE "intervention_id" = ${interventionId}
        AND "organization_id" = ${ctx.organizationId}
    `);
    await this.audit.log({
      action: 'STUDENT_INTERVENTION_RESOLVED',
      entityType: 'STUDENT',
      entityId: row.studentId,
      userId: user.userId,
      organizationId: ctx.organizationId,
      systemRole: user.systemRole ?? null,
      metadata: { interventionId },
    });
    return { id: interventionId, status: InterventionStatus.RESOLVED, alreadyResolved: false };
  }

  async getStudentDetail(studentId: string, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const student = await this.resolveStudentForStaff(studentId, ctx);
    return this.buildStudentDetail(student, ctx, true);
  }

  async getGuardianStudentDetail(studentId: string, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    if (ctx.role !== OrganizationRole.PARENT || !user.membershipId) {
      throw new ForbiddenException('PARENT_ROLE_REQUIRED');
    }
    const yearId = this.requireCurrentYear(ctx);
    const relation = await this.prisma.guardianStudentRelation.findFirst({
      where: {
        guardianMembershipId: user.membershipId,
        studentId,
        organizationId: ctx.organizationId,
        status: GuardianRelationStatus.VERIFIED,
        revokedAt: null,
        permissions: { has: GuardianPermissionKey.VIEW_RESULTS },
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!relation) throw new ForbiddenException('NOT_YOUR_CHILD');

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        orgId: ctx.organizationId,
        deletedAt: null,
        enrollments: {
          some: { yearId, status: EnrollmentStatus.ACTIVE },
        },
      },
      select: {
        id: true,
        membershipId: true,
        membership: { select: { user: { select: { name: true } } } },
        enrollments: {
          where: { yearId, status: EnrollmentStatus.ACTIVE },
          take: 1,
          select: {
            yearId: true,
            classSectionId: true,
            classSection: {
              select: { label: true, grade: true, section: true },
            },
          },
        },
      },
    });
    const enrollment = student?.enrollments[0];
    if (!student || !enrollment) throw new NotFoundException('Student not found');
    return this.buildStudentDetail(
      {
        id: student.id,
        membershipId: student.membershipId,
        name: student.membership.user.name,
        yearId: enrollment.yearId,
        classSectionId: enrollment.classSectionId,
        classLabel: this.classLabel(
          enrollment.classSection.label,
          enrollment.classSection.grade,
          enrollment.classSection.section,
        ),
      },
      ctx,
      false,
    );
  }

  async getSchoolDashboard(user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertLeadershipRole(ctx);
    const yearId = this.requireCurrentYear(ctx);
    const classes = await this.dashboardRows(ctx.organizationId, yearId, null);
    return this.aggregateDashboard(classes);
  }

  async getClassDashboard(classSectionId: string, user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    this.assertStaffRole(ctx);
    const yearId = this.requireCurrentYear(ctx);
    await this.assertClassAccess(classSectionId, ctx);
    const rows = await this.dashboardRows(ctx.organizationId, yearId, classSectionId);
    const row = rows[0];
    if (!row) throw new NotFoundException('Class section not found');
    return { ...row };
  }

  private async buildStudentDetail(
    student: {
      id: string;
      membershipId: string;
      name: string;
      yearId: string;
      classSectionId: string;
      classLabel: string;
    },
    ctx: OrgContext,
    includeInterventions: boolean,
  ) {
    const progress = await this.prisma.$queryRaw<ProgressRow[]>(Prisma.sql`
      SELECT
        p."progress_entry_id" AS id,
        p."entry_type"::text AS type,
        p."grade_value" AS "gradeValue",
        p."competency_level" AS "competencyLevel",
        p."comment",
        p."subject_id" AS "subjectId",
        s."name" AS "subjectName",
        p."competency_id" AS "competencyId",
        c."name" AS "competencyName",
        c."scale_min" AS "scaleMin",
        c."scale_max" AS "scaleMax",
        u."name" AS "authorName",
        p."occurred_at" AS "occurredAt"
      FROM "student_progress_entries" p
      JOIN "memberships" m ON m."membership_id" = p."created_by_id"
      JOIN "users" u ON u."user_id" = m."user_id"
      LEFT JOIN "subjects" s ON s."subject_id" = p."subject_id"
      LEFT JOIN "competencies" c ON c."competency_id" = p."competency_id"
      WHERE p."organization_id" = ${ctx.organizationId}
        AND p."academic_year_id" = ${student.yearId}
        AND p."student_id" = ${student.id}
        AND p."deleted_at" IS NULL
      ORDER BY p."occurred_at" DESC
      LIMIT 250
    `);

    const attendance = await this.prisma.$queryRaw<AttendanceRow[]>(Prisma.sql`
      SELECT
        a."attendance_record_id" AS id,
        a."status"::text AS status,
        a."minutes_late" AS "minutesLate",
        a."note",
        s."name" AS "subjectName",
        a."occurred_at" AS "occurredAt"
      FROM "attendance_records" a
      LEFT JOIN "subjects" s ON s."subject_id" = a."subject_id"
      WHERE a."organization_id" = ${ctx.organizationId}
        AND a."academic_year_id" = ${student.yearId}
        AND a."student_id" = ${student.id}
        AND a."deleted_at" IS NULL
      ORDER BY a."occurred_at" DESC
      LIMIT 250
    `);

    const interventions = includeInterventions
      ? await this.prisma.$queryRaw<InterventionRow[]>(Prisma.sql`
          SELECT
            i."intervention_id" AS id,
            i."title",
            i."note",
            i."status"::text AS status,
            s."name" AS "subjectName",
            i."started_at" AS "startedAt",
            i."resolved_at" AS "resolvedAt"
          FROM "student_interventions" i
          LEFT JOIN "subjects" s ON s."subject_id" = i."subject_id"
          WHERE i."organization_id" = ${ctx.organizationId}
            AND i."academic_year_id" = ${student.yearId}
            AND i."student_id" = ${student.id}
            AND i."deleted_at" IS NULL
          ORDER BY i."started_at" DESC
          LIMIT 100
        `)
      : [];

    const tests = await this.prisma.submissionFact.findMany({
      where: {
        organizationId: ctx.organizationId,
        academicYearId: student.yearId,
        studentId: student.id,
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        testId: true,
        percentage: true,
        submittedAt: true,
        subjectId: true,
      },
    });

    const subjectIds = Array.from(
      new Set(tests.map((test) => test.subjectId).filter((id): id is string => Boolean(id))),
    );
    const testSubjects = subjectIds.length
      ? await this.prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectNameById = new Map(testSubjects.map((subject) => [subject.id, subject.name]));

    const competencyMap = new Map<
      string,
      {
        id: string;
        name: string;
        subjectName: string | null;
        level: number;
        scaleMin: number;
        scaleMax: number;
        updatedAt: Date;
      }
    >();
    for (const entry of progress) {
      if (
        entry.competencyId &&
        entry.competencyName &&
        entry.competencyLevel !== null &&
        entry.scaleMin !== null &&
        entry.scaleMax !== null &&
        !competencyMap.has(entry.competencyId)
      ) {
        competencyMap.set(entry.competencyId, {
          id: entry.competencyId,
          name: entry.competencyName,
          subjectName: entry.subjectName,
          level: entry.competencyLevel,
          scaleMin: entry.scaleMin,
          scaleMax: entry.scaleMax,
          updatedAt: entry.occurredAt,
        });
      }
    }

    const gradeValues = progress
      .map((entry) => entry.gradeValue)
      .filter((value): value is number => value !== null);
    const competencyPercents = progress
      .filter(
        (entry) =>
          entry.competencyLevel !== null &&
          entry.scaleMin !== null &&
          entry.scaleMax !== null &&
          entry.scaleMax > entry.scaleMin,
      )
      .map((entry) =>
        ((entry.competencyLevel! - entry.scaleMin!) /
          (entry.scaleMax! - entry.scaleMin!)) *
        100,
      );
    const attended = attendance.filter(
      (item) => item.status === AttendanceStatus.PRESENT || item.status === AttendanceStatus.LATE,
    ).length;

    const timeline = [
      ...progress.map((entry) => ({
        id: `progress:${entry.id}`,
        kind: entry.type === ProgressEntryType.PRAISE ? 'PRAISE' : entry.type === ProgressEntryType.COMMENT ? 'COMMENT' : entry.gradeValue !== null ? 'GRADE' : 'COMPETENCY',
        occurredAt: entry.occurredAt,
        title:
          entry.type === ProgressEntryType.PRAISE
            ? 'Pochvala'
            : entry.type === ProgressEntryType.COMMENT
              ? 'Poznámka učitele'
              : entry.gradeValue !== null
                ? `${entry.subjectName ?? 'Hodnocení'} · známka ${entry.gradeValue}`
                : entry.competencyName ?? 'Kompetence',
        detail:
          entry.competencyLevel !== null && entry.competencyName
            ? `${entry.competencyName}: ${entry.competencyLevel}/${entry.scaleMax ?? 4}${entry.comment ? ` · ${entry.comment}` : ''}`
            : entry.comment,
        subjectName: entry.subjectName,
        authorName: entry.authorName,
      })),
      ...tests.map((test) => ({
        id: `test:${test.id}`,
        kind: 'TEST',
        occurredAt: test.submittedAt,
        title: `${subjectNameById.get(test.subjectId ?? '') ?? 'Test'} · ${Math.round(test.percentage)} %`,
        detail: null,
        subjectName: subjectNameById.get(test.subjectId ?? '') ?? null,
        authorName: null,
      })),
      ...attendance
        .filter((item) => item.status !== AttendanceStatus.PRESENT)
        .map((item) => ({
          id: `attendance:${item.id}`,
          kind: 'ATTENDANCE',
          occurredAt: item.occurredAt,
          title:
            item.status === AttendanceStatus.LATE
              ? `Pozdní příchod${item.minutesLate ? ` · ${item.minutesLate} min` : ''}`
              : item.status === AttendanceStatus.EXCUSED
                ? 'Omluvená absence'
                : 'Absence',
          detail: item.note,
          subjectName: item.subjectName,
          authorName: null,
        })),
      ...interventions.map((item) => ({
        id: `intervention:${item.id}`,
        kind: 'INTERVENTION',
        occurredAt: item.startedAt,
        title: item.title,
        detail: item.note,
        subjectName: item.subjectName,
        authorName: null,
      })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      student: {
        id: student.id,
        name: student.name,
        classSectionId: student.classSectionId,
        classLabel: student.classLabel,
      },
      summary: {
        averageGrade:
          gradeValues.length > 0
            ? Math.round((gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length) * 100) / 100
            : null,
        competencyMasteryPercent:
          competencyPercents.length > 0
            ? Math.round(
                competencyPercents.reduce((sum, value) => sum + value, 0) /
                  competencyPercents.length,
              )
            : null,
        attendanceRate:
          attendance.length > 0 ? Math.round((attended / attendance.length) * 100) : null,
        openInterventions: includeInterventions
          ? interventions.filter((item) => item.status !== InterventionStatus.RESOLVED).length
          : undefined,
      },
      competencyMap: Array.from(competencyMap.values()),
      timeline: timeline.slice(0, 250),
      attendance: {
        total: attendance.length,
        present: attendance.filter((item) => item.status === AttendanceStatus.PRESENT).length,
        late: attendance.filter((item) => item.status === AttendanceStatus.LATE).length,
        absent: attendance.filter((item) => item.status === AttendanceStatus.ABSENT).length,
        excused: attendance.filter((item) => item.status === AttendanceStatus.EXCUSED).length,
      },
      ...(includeInterventions ? { interventions } : {}),
    };
  }

  private async dashboardRows(
    organizationId: string,
    yearId: string,
    classSectionId: string | null,
  ): Promise<DashboardRow[]> {
    return this.prisma.$queryRaw<DashboardRow[]>(Prisma.sql`
      WITH class_students AS (
        SELECT e."class_section_id", COUNT(*)::int AS student_count
        FROM "enrollments" e
        JOIN "students" st ON st."student_id" = e."student_id"
        WHERE e."organization_id" = ${organizationId}
          AND e."academic_year_id" = ${yearId}
          AND e."status" = 'ACTIVE'
          AND st."deleted_at" IS NULL
        GROUP BY e."class_section_id"
      ), progress AS (
        SELECT p."class_section_id",
          AVG(p."grade_value")::float8 AS average_grade,
          AVG(p."competency_level")::float8 AS average_competency,
          COUNT(*)::int AS progress_entries
        FROM "student_progress_entries" p
        WHERE p."organization_id" = ${organizationId}
          AND p."academic_year_id" = ${yearId}
          AND p."deleted_at" IS NULL
        GROUP BY p."class_section_id"
      ), attendance AS (
        SELECT a."class_section_id",
          (100.0 * COUNT(*) FILTER (WHERE a."status" IN ('PRESENT','LATE')) /
            NULLIF(COUNT(*), 0))::float8 AS attendance_rate
        FROM "attendance_records" a
        WHERE a."organization_id" = ${organizationId}
          AND a."academic_year_id" = ${yearId}
          AND a."deleted_at" IS NULL
        GROUP BY a."class_section_id"
      ), interventions AS (
        SELECT i."class_section_id",
          COUNT(*) FILTER (WHERE i."status" <> 'RESOLVED')::int AS open_interventions
        FROM "student_interventions" i
        WHERE i."organization_id" = ${organizationId}
          AND i."academic_year_id" = ${yearId}
          AND i."deleted_at" IS NULL
        GROUP BY i."class_section_id"
      )
      SELECT
        cs."class_section_id" AS "classSectionId",
        COALESCE(cs."label", cs."section") AS "classLabel",
        COALESCE(st.student_count, 0)::int AS "studentCount",
        p.average_grade AS "averageGrade",
        p.average_competency AS "averageCompetency",
        a.attendance_rate AS "attendanceRate",
        COALESCE(i.open_interventions, 0)::int AS "openInterventions",
        COALESCE(p.progress_entries, 0)::int AS "progressEntries"
      FROM "class_sections" cs
      LEFT JOIN class_students st ON st."class_section_id" = cs."class_section_id"
      LEFT JOIN progress p ON p."class_section_id" = cs."class_section_id"
      LEFT JOIN attendance a ON a."class_section_id" = cs."class_section_id"
      LEFT JOIN interventions i ON i."class_section_id" = cs."class_section_id"
      WHERE cs."organization_id" = ${organizationId}
        AND cs."academic_year_id" = ${yearId}
        ${classSectionId ? Prisma.sql`AND cs."class_section_id" = ${classSectionId}` : Prisma.empty}
      ORDER BY cs."grade" ASC, cs."section" ASC
    `);
  }

  private aggregateDashboard(classes: DashboardRow[]) {
    const weighted = <K extends 'averageGrade' | 'averageCompetency' | 'attendanceRate'>(key: K) => {
      const values = classes.filter((item) => item[key] !== null && item.studentCount > 0);
      const weight = values.reduce((sum, item) => sum + item.studentCount, 0);
      if (!weight) return null;
      return (
        values.reduce((sum, item) => sum + Number(item[key]) * item.studentCount, 0) /
        weight
      );
    };
    return {
      summary: {
        studentCount: classes.reduce((sum, item) => sum + item.studentCount, 0),
        averageGrade: this.roundNullable(weighted('averageGrade'), 2),
        averageCompetency: this.roundNullable(weighted('averageCompetency'), 2),
        attendanceRate: this.roundNullable(weighted('attendanceRate'), 0),
        openInterventions: classes.reduce((sum, item) => sum + item.openInterventions, 0),
        progressEntries: classes.reduce((sum, item) => sum + item.progressEntries, 0),
      },
      classes: classes.map((item) => ({
        ...item,
        averageGrade: this.roundNullable(item.averageGrade, 2),
        averageCompetency: this.roundNullable(item.averageCompetency, 2),
        attendanceRate: this.roundNullable(item.attendanceRate, 0),
      })),
    };
  }

  private async resolveStudentForStaff(studentId: string, ctx: OrgContext) {
    const yearId = this.requireCurrentYear(ctx);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        orgId: ctx.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        membershipId: true,
        membership: { select: { user: { select: { name: true } } } },
        enrollments: {
          where: { yearId, status: EnrollmentStatus.ACTIVE },
          take: 1,
          select: {
            yearId: true,
            classSectionId: true,
            classSection: {
              select: { label: true, grade: true, section: true },
            },
          },
        },
      },
    });
    const enrollment = student?.enrollments[0];
    if (!student || !enrollment) throw new NotFoundException('Student not found');
    await this.assertClassAccess(enrollment.classSectionId, ctx);
    return {
      id: student.id,
      membershipId: student.membershipId,
      name: student.membership.user.name,
      yearId: enrollment.yearId,
      classSectionId: enrollment.classSectionId,
      classLabel: this.classLabel(
        enrollment.classSection.label,
        enrollment.classSection.grade,
        enrollment.classSection.section,
      ),
    };
  }

  private async assertClassAccess(classSectionId: string, ctx: OrgContext) {
    const yearId = this.requireCurrentYear(ctx);
    const now = new Date();
    if (ctx.role === OrganizationRole.DIRECTOR || ctx.role === OrganizationRole.OWNER) {
      const classSection = await this.prisma.classSection.findFirst({
        where: { id: classSectionId, orgId: ctx.organizationId, yearId },
        select: { id: true },
      });
      if (!classSection) throw new NotFoundException('Class section not found');
      return;
    }
    if (ctx.role !== OrganizationRole.TEACHER) {
      throw new ForbiddenException('STAFF_ROLE_REQUIRED');
    }
    const teacher = await this.teacherForContext(ctx);
    const classSection = await this.prisma.classSection.findFirst({
      where: {
        id: classSectionId,
        orgId: ctx.organizationId,
        yearId,
        OR: [
          { teacherId: teacher.id },
          {
            teachers: {
              some: {
                teacherId: teacher.id,
                yearId,
                deletedAt: null,
                OR: [{ validFrom: null }, { validFrom: { lte: now } }],
                AND: [
                  { OR: [{ validTo: null }, { validTo: { gte: now } }] },
                ],
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!classSection) throw new ForbiddenException('TEACHER_CLASS_SCOPE_REQUIRED');
  }

  private async assertSubjectEnabled(
    subjectId: string,
    ctx: OrgContext,
    requireTeacherSubject: boolean,
  ) {
    const enabled = await this.prisma.orgSubject.findFirst({
      where: {
        organizationId: ctx.organizationId,
        subjectId,
        isEnabled: true,
        subject: { deletedAt: null },
      },
      select: { id: true },
    });
    if (!enabled) throw new NotFoundException('Subject not found');
    if (requireTeacherSubject && ctx.role === OrganizationRole.TEACHER) {
      const teacher = await this.teacherForContext(ctx);
      const assignment = await this.prisma.teacherSubject.findFirst({
        where: { teacherId: teacher.id, subjectId },
        select: { id: true },
      });
      if (!assignment) throw new ForbiddenException('TEACHER_SUBJECT_SCOPE_REQUIRED');
    }
  }

  private async teacherForContext(ctx: OrgContext) {
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        membershipId: ctx.membershipId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!teacher) throw new ForbiddenException('TEACHER_PROFILE_REQUIRED');
    return teacher;
  }

  private async listCompetencies(organizationId: string): Promise<CompetencyRow[]> {
    return this.prisma.$queryRaw<CompetencyRow[]>(Prisma.sql`
      SELECT
        "competency_id" AS id,
        "subject_id" AS "subjectId",
        "name",
        "description",
        "scale_min" AS "scaleMin",
        "scale_max" AS "scaleMax"
      FROM "competencies"
      WHERE "organization_id" = ${organizationId}
        AND "is_active" = true
        AND "deleted_at" IS NULL
      ORDER BY "sort_order" NULLS LAST, "name" ASC
    `);
  }

  private async findCompetency(id: string, organizationId: string): Promise<CompetencyRow> {
    const rows = await this.prisma.$queryRaw<CompetencyRow[]>(Prisma.sql`
      SELECT
        "competency_id" AS id,
        "subject_id" AS "subjectId",
        "name",
        "description",
        "scale_min" AS "scaleMin",
        "scale_max" AS "scaleMax"
      FROM "competencies"
      WHERE "competency_id" = ${id}
        AND "organization_id" = ${organizationId}
        AND "is_active" = true
        AND "deleted_at" IS NULL
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Competency not found');
    return rows[0];
  }

  private async findEntryByMutation(
    organizationId: string,
    createdById: string,
    mutationId: string,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        studentId: string;
        subjectId: string | null;
        competencyId: string | null;
        gradeValue: number | null;
        competencyLevel: number | null;
        comment: string | null;
        type: ProgressEntryType;
        occurredAt: Date;
        clientMutationId: string | null;
      }>
    >(Prisma.sql`
      SELECT
        "progress_entry_id" AS id,
        "student_id" AS "studentId",
        "subject_id" AS "subjectId",
        "competency_id" AS "competencyId",
        "grade_value" AS "gradeValue",
        "competency_level" AS "competencyLevel",
        "comment",
        "entry_type"::text AS type,
        "occurred_at" AS "occurredAt",
        "client_mutation_id" AS "clientMutationId"
      FROM "student_progress_entries"
      WHERE "organization_id" = ${organizationId}
        AND "created_by_id" = ${createdById}
        AND "client_mutation_id" = ${mutationId}
        AND "deleted_at" IS NULL
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private requireCurrentYear(ctx: OrgContext): string {
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('ACTIVE_ACADEMIC_YEAR_REQUIRED');
    }
    return ctx.activeAcademicYearId;
  }

  private assertStaffRole(ctx: OrgContext) {
    if (
      ctx.role !== OrganizationRole.TEACHER &&
      ctx.role !== OrganizationRole.DIRECTOR &&
      ctx.role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('STAFF_ROLE_REQUIRED');
    }
  }

  private assertLeadershipRole(ctx: OrgContext) {
    if (ctx.role !== OrganizationRole.DIRECTOR && ctx.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException('LEADERSHIP_ROLE_REQUIRED');
    }
  }

  private classLabel(label: string | null, grade: string, section: string): string {
    if (label?.trim()) return label.trim();
    const gradeMatch = grade.match(/(?:GRADE_|YEAR_)(\d+)/);
    return gradeMatch ? `${gradeMatch[1]}.${section}` : section;
  }

  private roundNullable(value: number | null, digits: number): number | null {
    if (value === null || !Number.isFinite(Number(value))) return null;
    const factor = 10 ** digits;
    return Math.round(Number(value) * factor) / factor;
  }
}
