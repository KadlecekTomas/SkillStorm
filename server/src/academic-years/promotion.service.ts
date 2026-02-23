import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { SchoolGrade, EnrollmentStatus, OrganizationRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { bumpOrgVersion, cacheScopeForUser } from '@/shared/cache/org-cache.utils';
import { assertSameOrganization } from '@/shared/access.utils';
import { hasAtLeastRole } from '@/shared/access.utils';

const GRADE_ORDER: SchoolGrade[] = [
  'GRADE_1',
  'GRADE_2',
  'GRADE_3',
  'GRADE_4',
  'GRADE_5',
  'GRADE_6',
  'GRADE_7',
  'GRADE_8',
  'GRADE_9',
];

function getNextGrade(grade: SchoolGrade): SchoolGrade | null {
  const i = GRADE_ORDER.indexOf(grade);
  if (i < 0 || i >= GRADE_ORDER.length - 1) return null;
  return GRADE_ORDER[i + 1] ?? null;
}

function sectionKey(grade: string, section: string): string {
  return `${grade}.${section}`;
}

export type PromotionResult = {
  fromYearId: string;
  toYearId: string;
  classroomsCreated: number;
  studentsEnrolled: number;
  durationMs: number;
};

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Promote all classrooms from one academic year to the next (grade + 1, same section).
   * Copies teacher assignments and student enrollments (ACTIVE only).
   *
   * ATOMICITY: Exactly one prisma.$transaction block. All DB reads/writes inside use `tx`.
   * If any insert fails, the transaction rolls back and NOTHING persists.
   * PromotionLog is created as the LAST operation inside the transaction.
   * No raw Prisma errors leak: P2002 → 409, other known codes mapped or rethrown as HTTPException.
   */
  async promoteAcademicYear(
    organizationId: string,
    fromYearId: string,
    toYearId: string,
    user: JwtPayload,
  ): Promise<PromotionResult> {
    assertSameOrganization(organizationId, user, 'promotion');

    const role = user.organizationRole ?? null;
    if (!hasAtLeastRole(role, OrganizationRole.DIRECTOR)) {
      throw new ForbiddenException(
        'Pouze ředitel nebo owner může provést postup ročníku.',
      );
    }

    const [fromYear, toYear] = await Promise.all([
      this.prisma.academicYear.findUnique({
        where: { id: fromYearId, orgId: organizationId },
        select: { id: true, orgId: true, startsAt: true, endsAt: true, label: true },
      }),
      this.prisma.academicYear.findUnique({
        where: { id: toYearId, orgId: organizationId },
        select: { id: true, orgId: true, startsAt: true, label: true },
      }),
    ]);

    const nextYearByStart = fromYear
      ? await this.prisma.academicYear.findFirst({
          where: {
            orgId: organizationId,
            startsAt: { gt: fromYear.startsAt },
          },
          orderBy: { startsAt: 'asc' },
          select: { id: true },
        })
      : null;

    if (!fromYear) {
      throw new NotFoundException('Zdrojový školní rok nebyl nalezen.');
    }
    if (!toYear) {
      throw new NotFoundException('Cílový školní rok nebyl nalezen.');
    }
    if (fromYear.endsAt > new Date()) {
      throw new ConflictException(
        'Postup ročníku je možný až po skončení školního roku (datum konce musí být v minulosti).',
      );
    }
    if (!nextYearByStart || nextYearByStart.id !== toYearId) {
      throw new ConflictException(
        'Cílový rok musí být bezprostředně následující školní rok (podle data začátku).',
      );
    }

    const startPerf = performance.now();

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existingLog = await tx.promotionLog.findUnique({
          where: {
            organizationId_fromYearId: { organizationId, fromYearId },
          },
          select: { id: true },
        });
        if (existingLog) {
          throw new ConflictException(
            'Postup z tohoto školního roku již byl proveden.',
          );
        }

        const sections = await tx.classSection.findMany({
          where: { yearId: fromYearId, orgId: organizationId },
          select: {
            id: true,
            grade: true,
            section: true,
            label: true,
            teacherId: true,
          },
        });

        const sectionsData: Prisma.ClassSectionCreateManyInput[] = [];
        const oldSectionToKey = new Map<string, string>();
        let skippedClassesCount = 0;

        for (const section of sections) {
          const nextGrade = getNextGrade(section.grade as SchoolGrade);
          if (!nextGrade) {
            skippedClassesCount += 1;
            continue;
          }
          const gradeNum = nextGrade.replace('GRADE_', '');
          sectionsData.push({
            orgId: organizationId,
            yearId: toYearId,
            grade: nextGrade,
            section: section.section,
            label: `${gradeNum}.${section.section}`,
            teacherId: section.teacherId,
          });
          oldSectionToKey.set(section.id, sectionKey(nextGrade, section.section));
        }

        const classroomsCreated = sectionsData.length;
        if (classroomsCreated > 0) {
          await tx.classSection.createMany({ data: sectionsData });
        }

        const newSections = await tx.classSection.findMany({
          where: { yearId: toYearId, orgId: organizationId },
          select: { id: true, grade: true, section: true },
        });
        const newSectionByKey = new Map(
          newSections.map((s) => [sectionKey(s.grade, s.section), s.id]),
        );

        const enrollments = await tx.enrollment.findMany({
          where: {
            yearId: fromYearId,
            classSectionId: { in: Array.from(oldSectionToKey.keys()) },
            status: EnrollmentStatus.ACTIVE,
          },
          select: { studentId: true, classSectionId: true },
        });

        const enrollmentRows: Prisma.EnrollmentCreateManyInput[] = [];
        for (const enr of enrollments) {
          const key = oldSectionToKey.get(enr.classSectionId);
          const newSectionId = key ? newSectionByKey.get(key) : undefined;
          if (!newSectionId) continue;
          enrollmentRows.push({
            studentId: enr.studentId,
            classSectionId: newSectionId,
            yearId: toYearId,
            orgId: organizationId,
            status: EnrollmentStatus.ACTIVE,
          });
        }

        let studentsMigratedCount = 0;
        let enrollmentsSkippedCount = 0;
        if (enrollmentRows.length > 0) {
          const createResult = await tx.enrollment.createMany({
            data: enrollmentRows,
            skipDuplicates: true,
          });
          studentsMigratedCount = createResult.count;
          enrollmentsSkippedCount = enrollmentRows.length - createResult.count;
          if (enrollmentsSkippedCount > 0) {
            this.logger.warn(
              `Promotion skipDuplicates: ${enrollmentsSkippedCount} enrollment(s) skipped (student already enrolled in target year).`,
            );
          }
        }

        const durationMs = Math.round(performance.now() - startPerf);

        await tx.promotionLog.create({
          data: {
            organizationId,
            fromYearId,
            toYearId,
            executedBy: user.userId,
            classesCreatedCount: classroomsCreated,
            studentsMigratedCount,
            enrollmentsSkippedCount,
            skippedClassesCount,
            durationMs,
          },
        });

        return {
          classroomsCreated,
          studentsMigratedCount,
          enrollmentsSkippedCount,
          skippedClassesCount,
          durationMs,
        };
      });

      const scope = cacheScopeForUser(user.systemRole ?? null, organizationId);
      await bumpOrgVersion(this.cache, scope);

      const durationMs = Math.round(performance.now() - startPerf);
      this.logger.log(
        `Promotion completed: org=${organizationId} from=${fromYearId} to=${toYearId} ` +
          `classrooms=${result.classroomsCreated} students=${result.studentsMigratedCount} ` +
          `enrollmentsSkipped=${result.enrollmentsSkippedCount} skippedClasses=${result.skippedClassesCount} durationMs=${durationMs}`,
      );

      return {
        fromYearId,
        toYearId,
        classroomsCreated: result.classroomsCreated,
        studentsEnrolled: result.studentsMigratedCount,
        durationMs: result.durationMs,
      };
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException(
            'Postup z tohoto školního roku již byl proveden nebo došlo ke konfliktu dat.',
          );
        }
        if (e.code === 'P2025') {
          throw new NotFoundException('Záznam nebyl nalezen.');
        }
      }
      throw e;
    }
  }

  async getPromotionStatus(
    organizationId: string,
    fromYearId: string,
    user: JwtPayload,
  ): Promise<{ promoted: boolean; toYearId?: string | undefined }> {
    assertSameOrganization(organizationId, user, 'promotion status');

    const log = await this.prisma.promotionLog.findUnique({
      where: {
        organizationId_fromYearId: { organizationId, fromYearId },
      },
      select: { toYearId: true },
    });
    return {
      promoted: !!log,
      ...(log ? { toYearId: log.toYearId } : {}),
    };
  }

  async getNextAcademicYear(
    organizationId: string,
    fromYearId: string,
  ): Promise<{ id: string; label: string } | null> {
    const fromYear = await this.prisma.academicYear.findUnique({
      where: { id: fromYearId, orgId: organizationId },
      select: { startsAt: true },
    });
    if (!fromYear) return null;

    const next = await this.prisma.academicYear.findFirst({
      where: {
        orgId: organizationId,
        startsAt: { gt: fromYear.startsAt },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, label: true },
    });
    return next;
  }
}
