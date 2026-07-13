// src/assignments/assignments.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { EnrollmentStatus, PermissionKey, PublishStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { Assignment, Prisma } from '@prisma/client';
import type { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import type { TestSessionDto } from './dto/test-session.dto';
import { SubmissionsService } from '@/submissions/submissions.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type {
  MyAssignmentDto,
  EffectiveAssignmentStatus,
} from './my-assignments.dto';
import { RbacService } from '@/modules/rbac/rbac.service';
import {
  computeAssignability,
  type AssignabilityReport,
} from '@/shared/test-assignability.util';
import {
  deriveOrgReadiness,
  OrgReadinessState,
} from '@/shared/org-readiness-v2';
import { createOrgReadinessError } from '@/shared/errors/org-readiness.error';
import { OrgOperationType } from '@/common/decorators/org-operation.decorator';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { assertTenantWhere, withOrg } from '@/common/prisma/tenant-scope';
import { invalidateResourcesFailSafe } from '@/shared/cache/org-cache.utils';

const ALLOWED_TARGET_TYPES = new Set(['CLASS', 'STUDENTS']);

// --- Overview helpers -------------------------------------------------------
const assignmentWithTestSelect = {
  id: true,
  testId: true,
  organizationId: true,
  yearId: true,
  targetType: true,
  classSectionId: true,
  openAt: true,
  closeAt: true,
  maxAttempts: true,
  test: { select: { title: true } },
} as const;

type AssignmentWithTest = {
  id: string;
  testId: string;
  organizationId: string;
  yearId: string;
  targetType: string;
  classSectionId: string | null;
  openAt: Date;
  closeAt: Date;
  maxAttempts: number;
  test: { title: string } | null;
};

export type AssignmentOverviewItem = {
  assignmentId: string;
  testId: string;
  title: string;
  openAt: string;
  closeAt: string;
  maxAttempts: number;
  remainingAttempts: number;
  attemptsUsed: number;
};

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly submissions: SubmissionsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private async invalidateAssignmentReads(scopeId: string, mutation: string) {
    await invalidateResourcesFailSafe(this.cache, {
      scopeId,
      resources: ['assignments', 'dashboard'],
      mutation,
      logger: this.logger,
    });
  }

  private async ensureTestAssignable(testId: string): Promise<void> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: {
        allowedGrades: true,
        questions: {
          select: {
            id: true,
            type: true,
            correctAnswer: true,
            correctAnswers: true,
            score: true,
            options: {
              select: { text: true },
            },
          },
        },
      },
    });
    const report: AssignabilityReport = computeAssignability(
      test?.questions ?? [],
      test?.allowedGrades ?? [],
    );
    if (!report.isAssignable) {
      throw new BadRequestException({
        code: 'TEST_NOT_ASSIGNABLE',
        message: 'Test není připraven k přiřazení.',
        details: report,
      });
    }
  }

  // ------- CREATE ------------------------------------------------------------
  async create(dto: CreateAssignmentDto, ctx: OrgContext): Promise<Assignment> {
    // 1) Target type
    if (!ALLOWED_TARGET_TYPES.has(dto.targetType)) {
      throw new BadRequestException(
        'targetType musí být "CLASS" nebo "STUDENTS"',
      );
    }

    // 2) Časy a maxAttempts
    const openAt = new Date(dto.openAt);
    const closeAt = new Date(dto.closeAt);
    if (openAt.getTime() >= closeAt.getTime()) {
      throw new BadRequestException({
        code: 'INVALID_TIME_WINDOW',
        message: 'openAt musí být dříve než closeAt',
      });
    }
    if (dto.maxAttempts == null || dto.maxAttempts < 1) {
      throw new BadRequestException({
        code: 'INVALID_MAX_ATTEMPTS',
        message: 'maxAttempts must be at least 1',
      });
    }

    // 3) Organizace
    const org = await this.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organizace neexistuje');

    // 3b) Org readiness >= R2_STRUCTURE_READY (invariant)
    const readiness = await deriveOrgReadiness(this.prisma, ctx.organizationId);
    if (!readiness.canExecute) {
      throw createOrgReadinessError({
        operationType: OrgOperationType.EXECUTION,
        state: readiness.state,
        missing: readiness.missing,
        requiredMinState: OrgReadinessState.R2_STRUCTURE_READY,
        messageOverride:
          'Organization must have a current year and at least one class section to create assignments.',
      });
    }

    // 4) Test v rámci org
    const testWhere = withOrg(
      { id: dto.testId, deletedAt: null },
      ctx.organizationId,
    );
    assertTenantWhere(testWhere, ctx.organizationId);
    const test = await this.prisma.test.findFirst({
      where: testWhere,
      select: {
        id: true,
        organizationId: true,
        status: true,
        academicYearId: true,
        allowedGrades: true,
        subjectId: true,
      },
    });
    if (!test || test.organizationId !== ctx.organizationId) {
      throw new NotFoundException('Test nenalezen');
    }
    if (String(test.status) !== 'PUBLISHED') {
      throw new BadRequestException('Test must be published before assignment');
    }
    // Guard: test's academic year must match the current active year.
    if (
      test.academicYearId &&
      test.academicYearId !== ctx.activeAcademicYearId
    ) {
      throw new BadRequestException({
        code: 'YEAR_MISMATCH',
        message: 'Test byl vytvořen pro jiný školní rok než je aktuální.',
      });
    }
    // 5) AcademicYear v rámci org a musí být aktivní
    if (!ctx.activeAcademicYearId) {
      throw new BadRequestException('Active academic year is not configured.');
    }

    const year = await this.prisma.academicYear.findUnique({
      where: { id: ctx.activeAcademicYearId },
      select: { id: true, orgId: true, isCurrent: true },
    });
    if (!year || year.orgId !== ctx.organizationId) {
      throw new NotFoundException('Academic year nenalezen');
    }
    if (!year.isCurrent) {
      throw new BadRequestException(
        'Assignment can only be created for the current academic year.',
      );
    }

    // 6) classSection (pokud je) v rámci org + yearId shoda
    if (dto.targetType === 'CLASS' && !dto.classSectionId) {
      throw new BadRequestException(
        'Pro targetType=CLASS je nutné zadat classSectionId',
      );
    }
    if (dto.classSectionId) {
      const cs = await this.prisma.classSection.findUnique({
        where: { id: dto.classSectionId },
        select: { id: true, orgId: true, yearId: true, grade: true },
      });
      // Tenancy before diagnostics: a foreign/unknown class must be an
      // indistinguishable 404, never a report about the test's state.
      if (!cs || cs.orgId !== ctx.organizationId) {
        throw new NotFoundException('Class section nenalezena');
      }
      if (cs.yearId !== ctx.activeAcademicYearId) {
        throw new BadRequestException('Assignment year mismatch');
      }

      if (!test.allowedGrades.includes(cs.grade)) {
        throw new BadRequestException({
          code: 'TEST_NOT_ALLOWED_FOR_GRADE',
          message: 'Test není určen pro daný ročník.',
        });
      }

      if (dto.topicLevelId) {
        const topicLevel = await this.prisma.topicLevel.findUnique({
          where: { id: dto.topicLevelId },
          select: {
            id: true,
            subjectLevel: {
              select: {
                subjectId: true,
              },
            },
          },
        });
        if (!topicLevel) {
          throw new NotFoundException('Téma nebylo nalezeno.');
        }
        if (
          !test.subjectId ||
          topicLevel.subjectLevel.subjectId !== test.subjectId
        ) {
          throw new BadRequestException({
            code: 'TOPIC_NOT_IN_TEST_SUBJECT',
            message: 'Vybrané téma nepatří do předmětu tohoto testu.',
          });
        }
      } else {
        this.logger.warn(
          `[create assignment] assignment for test ${test.id} created without topicLevelId; diagnostics will use fallback topic`,
        );
      }

      // 6b) Enrollment guard: class must have at least one ACTIVE enrolled student
      if (dto.targetType === 'CLASS') {
        const enrolledCount = await this.prisma.enrollment.count({
          where: {
            classSectionId: dto.classSectionId,
            yearId: ctx.activeAcademicYearId,
            orgId: ctx.organizationId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
        this.logger.log(
          `[create assignment] classSectionId=${dto.classSectionId} enrolledStudentCount=${enrolledCount} ` +
            `orgId=${ctx.organizationId}`,
        );
        if (enrolledCount === 0) {
          throw new BadRequestException({
            code: 'CLASS_HAS_NO_ENROLLED_STUDENTS',
            message:
              'Vybraná třída nemá žádné aktivně zapsané studenty v aktuálním školním roce.',
          });
        }
      }
    }

    // 7) createdById membership existuje v org + role TEACHER/DIRECTOR
    const creator = await this.prisma.membership.findFirst({
      where: {
        id: ctx.membershipId,
        organizationId: ctx.organizationId,
        deletedAt: null,
        role: { in: ['TEACHER', 'DIRECTOR'] },
      },
      select: { id: true },
    });
    if (!creator) {
      throw new BadRequestException(
        'createdById musí být aktivní člen (TEACHER nebo DIRECTOR) v organizaci',
      );
    }

    // 8) STUDENTS -> studentIds povinné + všichni studenti z téže org
    if (dto.targetType === 'STUDENTS') {
      const ids = dto.studentIds ?? [];
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new BadRequestException(
          'Pro targetType=STUDENTS je nutné zadat studentIds',
        );
      }
      const found = await this.prisma.membership.findMany({
        where: {
          id: { in: ids },
          organizationId: ctx.organizationId,
          role: 'STUDENT',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (found.length !== ids.length) {
        throw new BadRequestException(
          'Někteří studenti neexistují nebo nepatří do organizace',
        );
      }
    }

    // 9a) Test musí být připraven k přiřazení — až PO všech tenancy
    // validacích výše, aby diagnostika neunikala přes cizí identifikátory.
    await this.ensureTestAssignable(test.id);

    // 9) Vytvoření assignmentu (studentIds nejsou sloupec assignmentu)
    const {
      academicYearId: _ignoredYearId,
      studentIds,
      createdById: _ignoredCreatedBy,
      ...rest
    } = dto;
    void _ignoredYearId;
    void _ignoredCreatedBy;
    const yearId = ctx.activeAcademicYearId;
    if (dto.targetType === 'STUDENTS') {
      const created = await this.prisma.assignment.create({
        data: {
          ...rest,
          organizationId: ctx.organizationId,
          createdById: ctx.membershipId,
          yearId,
          students: {
            create: (studentIds ?? []).map((id) => ({ studentId: id })),
          },
        },
      });
      await this.invalidateAssignmentReads(
        ctx.organizationId,
        'assignments.create',
      );
      return created;
    } else {
      const { studentIds: _unused } = dto;
      void _unused;
      const created = await this.prisma.assignment.create({
        data: {
          ...rest,
          organizationId: ctx.organizationId,
          createdById: ctx.membershipId,
          yearId,
        },
      });
      await this.invalidateAssignmentReads(
        ctx.organizationId,
        'assignments.create',
      );
      return created;
    }
  }

  // ------- READ --------------------------------------------------------------
  async findOne(id: string): Promise<Assignment | null> {
    return this.prisma.assignment.findUnique({ where: { id } });
  }

  async findOneScoped(id: string, ctx: OrgContext): Promise<Assignment | null> {
    const where = withOrg({ id }, ctx.organizationId);
    assertTenantWhere(where, ctx.organizationId);
    return this.prisma.assignment.findFirst({ where });
  }

  async findOneOrThrow(id: string): Promise<Assignment> {
    const a = await this.findOne(id);
    if (!a) throw new NotFoundException('Assignment nenalezen');
    return a;
  }

  async findOneOrThrowScoped(id: string, ctx: OrgContext): Promise<Assignment> {
    const a = await this.findOneScoped(id, ctx);
    if (!a) throw new NotFoundException('Assignment nenalezen');
    return a;
  }

  /** Resolve which assignment-view permissions the user has in the org. */
  private async getAssignmentScopes(
    userId: string,
    organizationId: string | null,
  ): Promise<{ viewOrg: boolean; viewClass: boolean; viewOwn: boolean }> {
    if (!organizationId) {
      return { viewOrg: false, viewClass: false, viewOwn: false };
    }
    const [viewOrg, viewClass, viewOwn] = await Promise.all([
      this.rbac.canUser(
        userId,
        organizationId,
        PermissionKey.VIEW_ORG_ASSIGNMENTS,
      ),
      this.rbac.canUser(
        userId,
        organizationId,
        PermissionKey.VIEW_CLASS_ASSIGNMENTS,
      ),
      this.rbac.canUser(
        userId,
        organizationId,
        PermissionKey.VIEW_OWN_ASSIGNMENTS,
      ),
    ]);
    return { viewOrg, viewClass, viewOwn };
  }

  /** Check if user can access this assignment (permission-based scope). */
  async canAccessAssignment(
    assignment: Assignment,
    userId: string,
    organizationId: string | null,
    membershipId: string,
  ): Promise<boolean> {
    if (assignment.organizationId !== organizationId) {
      return false;
    }
    const scopes = await this.getAssignmentScopes(userId, organizationId);
    if (scopes.viewOrg) return true;
    if (scopes.viewClass && assignment.classSectionId) {
      const section = await this.prisma.classSection.findUnique({
        where: { id: assignment.classSectionId },
        select: { teacherId: true },
      });
      if (section?.teacherId) {
        const teacher = await this.prisma.teacher.findUnique({
          where: { id: section.teacherId },
          select: { membershipId: true },
        });
        if (teacher?.membershipId === membershipId) return true;
      }
    }
    if (scopes.viewOwn) {
      if (assignment.classSectionId) {
        const student = await this.prisma.student.findFirst({
          where: { membershipId, orgId: organizationId! },
          select: { id: true },
        });
        if (student) {
          const enrolled = await this.prisma.enrollment.findFirst({
            where: {
              studentId: student.id,
              classSectionId: assignment.classSectionId,
              yearId: assignment.yearId,
              status: EnrollmentStatus.ACTIVE,
            },
            select: { id: true },
          });
          if (enrolled) return true;
        }
      }
      const inStudents = await this.prisma.assignmentStudent.findFirst({
        where: { assignmentId: assignment.id, studentId: membershipId },
        select: { id: true },
      });
      if (inStudents) return true;
    }
    return false;
  }

  // ------- UPDATE ------------------------------------------------------------
  async update(
    id: string,
    dto: UpdateAssignmentDto,
    ctx: OrgContext,
  ): Promise<Assignment> {
    const current = await this.findOneOrThrowScoped(id, ctx);

    // Nepovoluj měnit identitu/kontext assignmentu,
    // držíme to jednoduché a bezpečné (není požadavek to dynamicky migrovat).
    if (
      dto.organizationId ||
      dto.academicYearId ||
      dto.testId ||
      dto.createdById ||
      dto.studentIds
    ) {
      throw new BadRequestException(
        'Pole organizationId/academicYearId/testId/createdById/studentIds nelze měnit PATCHem',
      );
    }

    // Validace targetType (pokud přichází)
    if (dto.targetType && !ALLOWED_TARGET_TYPES.has(dto.targetType)) {
      throw new BadRequestException(
        'targetType musí být "CLASS" nebo "STUDENTS"',
      );
    }

    // Pokud se mění classSectionId → ověř org
    if (dto.classSectionId) {
      const cs = await this.prisma.classSection.findUnique({
        where: { id: dto.classSectionId },
        select: { id: true, orgId: true, yearId: true },
      });
      if (!cs || cs.orgId !== current.organizationId) {
        throw new BadRequestException(
          'classSectionId neexistuje nebo nepatří do organizace',
        );
      }
      if (cs.yearId !== current.yearId) {
        throw new BadRequestException('Assignment year mismatch');
      }
    }

    // Časy – ber v potaz kombinace (jen openAt / jen closeAt / obojí)
    const nextOpenAt =
      dto.openAt !== undefined
        ? new Date(dto.openAt)
        : new Date(current.openAt);
    const nextCloseAt =
      dto.closeAt !== undefined
        ? new Date(dto.closeAt)
        : new Date(current.closeAt);

    if (dto.openAt !== undefined || dto.closeAt !== undefined) {
      if (nextOpenAt.getTime() >= nextCloseAt.getTime()) {
        throw new BadRequestException('openAt musí být dříve než closeAt');
      }
    }

    // UPDATE – odfiltruj studentIds (není sloupec)
    const data: Prisma.AssignmentUncheckedUpdateInput = {};
    if (dto.targetType !== undefined) data.targetType = dto.targetType;
    if (dto.classSectionId !== undefined) {
      data.classSectionId = dto.classSectionId;
    }
    if (dto.topicLevelId !== undefined) {
      data.topicLevelId = dto.topicLevelId;
    }
    if (dto.openAt !== undefined) data.openAt = dto.openAt;
    if (dto.closeAt !== undefined) data.closeAt = dto.closeAt;
    if (dto.maxAttempts !== undefined) data.maxAttempts = dto.maxAttempts;
    if (dto.timeLimitSec !== undefined) {
      data.timeLimitSec = dto.timeLimitSec;
    }
    if (dto.shuffle !== undefined) data.shuffle = dto.shuffle;
    if (dto.showExplain !== undefined) data.showExplain = dto.showExplain;

    const updated = await this.prisma.assignment.update({
      where: { id },
      data,
    });
    await this.invalidateAssignmentReads(
      current.organizationId,
      'assignments.update',
    );
    return updated;
  }

  // ------- DELETE ------------------------------------------------------------
  async remove(id: string, ctx: OrgContext): Promise<Assignment> {
    // Assignment má historickou hodnotu, pokud existují submissions; v tom případě delete zakazujeme.
    const submissionsWhere = withOrg(
      { assignmentId: id, deletedAt: null },
      ctx.organizationId,
    );
    assertTenantWhere(submissionsWhere, ctx.organizationId);
    const submissions = await this.prisma.submission.count({
      where: submissionsWhere,
    });
    if (submissions > 0) {
      throw new ConflictException('Assignment má navázané submissions.');
    }
    // Bez submissions je hard delete bezpečný (konfigurační záznam bez historie).
    const current = await this.findOneOrThrowScoped(id, ctx);
    const deleted = await this.prisma.assignment.delete({ where: { id } });
    await this.invalidateAssignmentReads(
      current.organizationId,
      'assignments.remove',
    );
    return deleted;
  }

  // ------- STUDENT OVERVIEW -------------------------------------------------
  /**
   * Returns bucketed assignment overview for the authenticated student.
   * Buckets: active | upcoming | closedUnsubmitted | completed
   */
  async getStudentOverview(
    membershipId: string,
    organizationId: string,
    activeYearId: string | null,
  ): Promise<{
    now: string;
    active: AssignmentOverviewItem[];
    upcoming: AssignmentOverviewItem[];
    closedUnsubmitted: AssignmentOverviewItem[];
    completed: AssignmentOverviewItem[];
  }> {
    const now = new Date();

    // 1) Resolve Student from membershipId
    const student = await this.prisma.student.findFirst({
      where: { membershipId, orgId: organizationId, deletedAt: null },
      select: { id: true },
    });

    // 2) Get enrolled classSectionIds for the current academic year
    let classSectionIds: string[] = [];
    if (student && activeYearId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          studentId: student.id,
          yearId: activeYearId,
          orgId: organizationId,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { classSectionId: true },
      });
      classSectionIds = enrollments.map((e) => e.classSectionId);

      if (classSectionIds.length === 0) {
        this.logger.warn(
          `[getStudentOverview] Student has no ACTIVE enrollment for current academic year. ` +
            `membershipId=${membershipId} orgId=${organizationId} yearId=${activeYearId}. ` +
            `CLASS-targeted assignments will not be visible.`,
        );
      }
    } else if (!student) {
      this.logger.warn(
        `[getStudentOverview] No Student record found for membershipId=${membershipId} orgId=${organizationId}. ` +
          `Returning empty overview.`,
      );
    } else if (!activeYearId) {
      this.logger.warn(
        `[getStudentOverview] No active academic year for orgId=${organizationId}. ` +
          `CLASS-targeted assignments will not be visible.`,
      );
    }

    // 3) Fetch all assignments in org targeting this student (by class or directly)
    const [classAssignments, directAssignments] = await Promise.all([
      classSectionIds.length > 0
        ? this.prisma.assignment.findMany({
            where: {
              organizationId,
              targetType: 'CLASS',
              classSectionId: { in: classSectionIds },
            },
            select: assignmentWithTestSelect,
          })
        : [],
      this.prisma.assignment.findMany({
        where: {
          organizationId,
          targetType: 'STUDENTS',
          students: { some: { studentId: membershipId } },
        },
        select: assignmentWithTestSelect,
      }),
    ]);

    // Deduplicate (shouldn't overlap, but defensive)
    const seen = new Set<string>();
    const allAssignments: AssignmentWithTest[] = [];
    for (const a of [...classAssignments, ...directAssignments]) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        allAssignments.push(a as AssignmentWithTest);
      }
    }

    // 4) Fetch submissions for this student across these assignments
    const assignmentIds = allAssignments.map((a) => a.id);
    const submissions =
      assignmentIds.length > 0
        ? await this.prisma.submission.findMany({
            where: {
              organizationId,
              studentId: membershipId,
              assignmentId: { in: assignmentIds },
              deletedAt: null,
            },
            select: {
              id: true,
              assignmentId: true,
              attemptNo: true,
              score: true,
              status: true,
              submittedAt: true,
            },
          })
        : [];

    // Group submissions by assignmentId
    const subsByAssignment = new Map<string, typeof submissions>();
    for (const s of submissions) {
      const arr = subsByAssignment.get(s.assignmentId) ?? [];
      arr.push(s);
      subsByAssignment.set(s.assignmentId, arr);
    }

    // 5) Bucket assignments
    const active: AssignmentOverviewItem[] = [];
    const upcoming: AssignmentOverviewItem[] = [];
    const closedUnsubmitted: AssignmentOverviewItem[] = [];
    const completed: AssignmentOverviewItem[] = [];

    for (const a of allAssignments) {
      const subs = subsByAssignment.get(a.id) ?? [];
      const attemptsUsed = subs.length;
      const remainingAttempts = Math.max(0, a.maxAttempts - attemptsUsed);
      const item: AssignmentOverviewItem = {
        assignmentId: a.id,
        testId: a.testId,
        title: a.test?.title ?? '—',
        openAt: a.openAt.toISOString(),
        closeAt: a.closeAt.toISOString(),
        maxAttempts: a.maxAttempts,
        remainingAttempts,
        attemptsUsed,
      };

      const isOpen = a.openAt <= now && now <= a.closeAt;
      const isUpcoming = a.openAt > now;
      const isClosed = a.closeAt < now;
      const hasSubmission = attemptsUsed > 0;
      const exhausted = remainingAttempts === 0;

      if (isUpcoming) {
        // Not yet open — always upcoming regardless of submissions
        upcoming.push(item);
      } else if (isOpen && !exhausted) {
        // Open window, attempts available → actively actionable
        active.push(item);
      } else if (isOpen && exhausted && hasSubmission) {
        // Open but no attempts left, already submitted → completed
        completed.push(item);
      } else if (isOpen && exhausted && !hasSubmission) {
        // Defensive: maxAttempts=0 or state anomaly — treat as active so student is never silently hidden
        this.logger.warn(
          `[getStudentOverview] Assignment ${a.id} is OPEN and exhausted=true but has no submissions. ` +
            `Possible data anomaly. membershipId=${membershipId}`,
        );
        active.push(item);
      } else if (isClosed && hasSubmission) {
        // Closed and has submission → completed
        completed.push(item);
      } else if (isClosed && !hasSubmission) {
        // Closed, never submitted → missed
        closedUnsubmitted.push(item);
      }
    }

    return {
      now: now.toISOString(),
      active,
      upcoming,
      closedUnsubmitted,
      completed,
    };
  }

  private computeEffectiveStatus(
    assignment: { openAt: Date; closeAt: Date; maxAttempts: number },
    latestSubmission: { submittedAt: Date | null } | null,
    attemptsUsed: number,
    now: Date,
  ): EffectiveAssignmentStatus {
    // 1. Explicit submission always wins — student can always view their result.
    if (latestSubmission?.submittedAt) return 'SUBMITTED';
    // 2. Time window checks: temporal state beats in-progress state.
    if (now < assignment.openAt) return 'UPCOMING';
    if (now > assignment.closeAt) return 'CLOSED';
    // 3. Exhausted attempts (window is still open but no tries left).
    if (attemptsUsed >= assignment.maxAttempts) return 'NO_ATTEMPTS_LEFT';
    // 4. Started but not yet submitted (and window is open, attempts remain).
    if (attemptsUsed > 0) return 'IN_PROGRESS';
    return 'OPEN';
  }

  /** Enrollment-first student path: single enrollment per year, PUBLISHED tests only. */
  private async listForStudent(
    membershipId: string,
    orgId: string,
    ctx: OrgContext,
  ): Promise<MyAssignmentDto[]> {
    // 1. Resolve student domain record.
    const student = await this.prisma.student.findFirst({
      where: { membershipId, orgId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      this.logger.warn(
        `[listForStudent] No Student record found. membershipId=${membershipId} orgId=${orgId}`,
      );
    }

    // 2. Find the single ACTIVE enrollment for the current academic year.
    //    Enrollment has @@unique([studentId, yearId]) — at most one per year.
    const enrollments = student
      ? await this.prisma.enrollment.findMany({
          where: {
            studentId: student.id,
            orgId,
            status: EnrollmentStatus.ACTIVE,
            ...(ctx.activeAcademicYearId
              ? { yearId: ctx.activeAcademicYearId }
              : {}),
          },
          select: { classSectionId: true },
        })
      : [];

    const classSectionIds = enrollments.map(
      (enrollment) => enrollment.classSectionId,
    );

    this.logger.log(
      `[listForStudent] membershipId=${membershipId} studentId=${student?.id ?? 'NONE'} ` +
        `classSectionIds=${JSON.stringify(classSectionIds)} yearId=${ctx.activeAcademicYearId ?? 'NONE'}`,
    );

    // 3. Fetch assignments targeted either to the student's class(es) or directly to the student.
    const [classAssignments, directAssignments] = await Promise.all([
      classSectionIds.length > 0
        ? this.prisma.assignment.findMany({
            where: {
              organizationId: orgId,
              classSectionId: { in: classSectionIds },
              ...(ctx.activeAcademicYearId
                ? { yearId: ctx.activeAcademicYearId }
                : {}),
              test: { status: PublishStatus.PUBLISHED, deletedAt: null },
            },
            include: {
              submissions: {
                where: { studentId: membershipId, deletedAt: null },
                orderBy: { attemptNo: 'desc' },
              },
            },
            orderBy: { openAt: 'asc' },
          })
        : [],
      this.prisma.assignment.findMany({
        where: {
          organizationId: orgId,
          targetType: 'STUDENTS',
          students: { some: { studentId: membershipId } },
          ...(ctx.activeAcademicYearId
            ? { yearId: ctx.activeAcademicYearId }
            : {}),
          test: { status: PublishStatus.PUBLISHED, deletedAt: null },
        },
        include: {
          submissions: {
            where: { studentId: membershipId, deletedAt: null },
            orderBy: { attemptNo: 'desc' },
          },
        },
        orderBy: { openAt: 'asc' },
      }),
    ]);

    const assignments = [...classAssignments, ...directAssignments].filter(
      (assignment, index, all) =>
        all.findIndex((candidate) => candidate.id === assignment.id) === index,
    );

    const now = new Date();
    return assignments.map((a) => {
      const attemptsUsed = a.submissions?.length ?? 0;
      const latestSubmission = a.submissions?.[0] ?? null;
      return {
        id: a.id,
        testId: a.testId,
        classSectionId: a.classSectionId,
        organizationId: a.organizationId,
        openAt: a.openAt,
        closeAt: a.closeAt,
        maxAttempts: a.maxAttempts,
        attemptNo: latestSubmission?.attemptNo ?? 0,
        attemptsUsed,
        submissionId: latestSubmission?.id ?? null,
        submittedAt: latestSubmission?.submittedAt?.toISOString() ?? null,
        submissionStatus: latestSubmission?.status ?? null,
        effectiveStatus: this.computeEffectiveStatus(
          a,
          latestSubmission,
          attemptsUsed,
          now,
        ),
      };
    });
  }

  async listForUser(
    user: JwtPayload,
    ctx: OrgContext,
  ): Promise<MyAssignmentDto[]> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true, organizationId: true },
    });
    if (!membership?.organizationId) {
      return [];
    }
    const orgId = ctx.organizationId;
    const scopes = await this.getAssignmentScopes(user.userId, orgId);
    if (!scopes.viewOrg && !scopes.viewClass && !scopes.viewOwn) {
      return [];
    }

    // Fast path: pure student — use enrollment-first query with PUBLISHED test filter.
    if (scopes.viewOwn && !scopes.viewOrg && !scopes.viewClass) {
      return this.listForStudent(membership.id, orgId, ctx);
    }

    // Teacher / Director path — collect assignment IDs then fetch with submissions.
    const idSets: Set<string> = new Set();

    if (scopes.viewOrg) {
      const orgAssignments = await this.prisma.assignment.findMany({
        where: withOrg({}, orgId),
        select: { id: true },
      });
      orgAssignments.forEach((a) => idSets.add(a.id));
    }

    if (scopes.viewClass) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { membershipId: membership.id, organizationId: orgId },
        select: { id: true },
      });
      if (teacher) {
        const classAssignments = await this.prisma.assignment.findMany({
          where: {
            organizationId: orgId,
            classSection: { teacherId: teacher.id },
          },
          select: { id: true },
        });
        classAssignments.forEach((a) => idSets.add(a.id));
      }
    }

    const ids = Array.from(idSets);
    if (ids.length === 0) {
      return [];
    }
    const assignments = await this.prisma.assignment.findMany({
      where: withOrg({ id: { in: ids } }, orgId),
      include: {
        submissions: {
          where: { studentId: membership.id, deletedAt: null },
          orderBy: { attemptNo: 'desc' },
        },
      },
      orderBy: { openAt: 'asc' },
    });
    const now = new Date();
    return assignments.map((a) => {
      const attemptsUsed = a.submissions?.length ?? 0;
      const latestSubmission = a.submissions?.[0] ?? null;
      return {
        id: a.id,
        testId: a.testId,
        classSectionId: a.classSectionId,
        organizationId: a.organizationId,
        openAt: a.openAt,
        closeAt: a.closeAt,
        maxAttempts: a.maxAttempts,
        attemptNo: latestSubmission?.attemptNo ?? 0,
        attemptsUsed,
        submissionId: latestSubmission?.id ?? null,
        submittedAt: latestSubmission?.submittedAt?.toISOString() ?? null,
        submissionStatus: latestSubmission?.status ?? null,
        effectiveStatus: this.computeEffectiveStatus(
          a,
          latestSubmission,
          attemptsUsed,
          now,
        ),
      };
    });
  }

  // ------- FOCUS TEST SESSION (student) -------------------------------------
  /**
   * Bootstraps a distraction-free test session for a student.
   *
   * Resume-first, never duplicate: if the student has an unsubmitted attempt it is
   * resumed; otherwise a new attempt is created via SubmissionsService.create, which
   * enforces access (targetType), the open/close window, the academic-year window and
   * maxAttempts. The payload NEVER includes correctAnswer/correctAnswers.
   */
  async getOrCreateTestSession(
    assignmentId: string,
    user: JwtPayload,
    ctx: OrgContext,
  ): Promise<TestSessionDto> {
    // 1) Assignment scoped to org → 404 cross-org (no existence leak).
    const assignment = await this.findOneOrThrowScoped(assignmentId, ctx);

    // 2) Resume the latest in-progress attempt for this student, if any.
    let submission = await this.prisma.submission.findFirst({
      where: {
        organizationId: ctx.organizationId,
        assignmentId: assignment.id,
        studentId: ctx.membershipId,
        submittedAt: null,
        deletedAt: null,
      },
      orderBy: { attemptNo: 'desc' },
      select: {
        id: true,
        attemptNo: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        submittedAt: true,
      },
    });

    // 3) Otherwise start a new attempt. create() validates access + window + maxAttempts
    //    and is idempotent on the unique constraint, so no duplicate active submission appears.
    if (!submission) {
      const created = await this.submissions.create(
        { assignmentId: assignment.id },
        user,
        ctx,
      );
      submission = {
        id: created.id,
        attemptNo: created.attemptNo,
        status: created.status,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        submittedAt: created.submittedAt,
      };
    }

    // 4) Sanitized test (answer key omitted) + persisted responses for rehydration.
    const test = await this.prisma.test.findFirst({
      where: withOrg({ id: assignment.testId }, ctx.organizationId),
      select: {
        id: true,
        title: true,
        description: true,
        questions: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            text: true,
            type: true,
            options: { select: { id: true, text: true } },
          },
        },
      },
    });
    if (!test) throw new NotFoundException('Test nenalezen');

    const responses = await this.prisma.response.findMany({
      where: { submissionId: submission.id },
      select: { questionId: true, givenText: true },
    });

    return {
      assignment: {
        id: assignment.id,
        title: test.title,
        openAt: assignment.openAt.toISOString(),
        closeAt: assignment.closeAt.toISOString(),
        maxAttempts: assignment.maxAttempts,
        timeLimitSec: assignment.timeLimitSec ?? null,
        showExplain: assignment.showExplain,
      },
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        questions: test.questions,
      },
      submission: {
        id: submission.id,
        attemptNo: submission.attemptNo,
        status: submission.status,
        startedAt: submission.createdAt.toISOString(),
        updatedAt: submission.updatedAt.toISOString(),
        submittedAt: submission.submittedAt?.toISOString() ?? null,
      },
      responses: responses.map((r) => ({
        questionId: r.questionId,
        givenText: r.givenText,
      })),
    };
  }
}
