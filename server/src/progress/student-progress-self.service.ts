import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, OrganizationRole, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { OrgContextService } from '@/common/org-context/org-context.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { AttendanceStatus, ProgressEntryType } from './progress.types';

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

/**
 * Student-only read projection over the existing Progress domain.
 *
 * Security contract:
 * - the client never supplies a student id;
 * - the student profile is resolved from the active membership + tenant;
 * - only the active academic-year enrollment is read;
 * - interventions are intentionally not exposed in the student projection.
 */
@Injectable()
export class StudentProgressSelfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgContext: OrgContextService,
  ) {}

  async getOwnDetail(user: JwtPayload) {
    const ctx = await this.orgContext.getForUser(user);
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException('STUDENT_ROLE_REQUIRED');
    }
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('ACTIVE_ACADEMIC_YEAR_REQUIRED');
    }

    const yearId = ctx.activeAcademicYearId;
    const student = await this.prisma.student.findFirst({
      where: {
        membershipId: ctx.membershipId,
        orgId: ctx.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        membership: { select: { user: { select: { name: true } } } },
        enrollments: {
          where: { yearId, status: EnrollmentStatus.ACTIVE },
          take: 1,
          select: {
            classSectionId: true,
            classSection: {
              select: { label: true, grade: true, section: true },
            },
          },
        },
      },
    });

    const enrollment = student?.enrollments[0];
    if (!student || !enrollment) {
      throw new NotFoundException('Student not found');
    }

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
        AND p."academic_year_id" = ${yearId}
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
        AND a."academic_year_id" = ${yearId}
        AND a."student_id" = ${student.id}
        AND a."deleted_at" IS NULL
      ORDER BY a."occurred_at" DESC
      LIMIT 250
    `);

    const tests = await this.prisma.submissionFact.findMany({
      where: {
        organizationId: ctx.organizationId,
        academicYearId: yearId,
        studentId: student.id,
      },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      select: {
        id: true,
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
      .map(
        (entry) =>
          ((entry.competencyLevel! - entry.scaleMin!) /
            (entry.scaleMax! - entry.scaleMin!)) *
          100,
      );
    const attended = attendance.filter(
      (item) =>
        item.status === AttendanceStatus.PRESENT || item.status === AttendanceStatus.LATE,
    ).length;

    const timeline = [
      ...progress.map((entry) => ({
        id: `progress:${entry.id}`,
        kind:
          entry.type === ProgressEntryType.PRAISE
            ? 'PRAISE'
            : entry.type === ProgressEntryType.COMMENT
              ? 'COMMENT'
              : entry.gradeValue !== null
                ? 'GRADE'
                : 'COMPETENCY',
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
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return {
      student: {
        id: student.id,
        name: student.membership.user.name,
        classSectionId: enrollment.classSectionId,
        classLabel: this.classLabel(
          enrollment.classSection.label,
          enrollment.classSection.grade,
          enrollment.classSection.section,
        ),
      },
      summary: {
        averageGrade:
          gradeValues.length > 0
            ? Math.round(
                (gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length) * 100,
              ) / 100
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
    };
  }

  private classLabel(label: string | null, grade: string, section: string): string {
    if (label?.trim()) return label.trim();
    const gradeMatch = grade.match(/(?:GRADE_|YEAR_)(\d+)/);
    return gradeMatch ? `${gradeMatch[1]}.${section}` : section;
  }
}
