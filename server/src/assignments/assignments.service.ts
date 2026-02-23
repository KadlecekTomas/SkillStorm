// src/assignments/assignments.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PermissionKey } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { Assignment, Prisma } from '@prisma/client';
import type { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { MyAssignmentDto } from './my-assignments.dto';
import { RbacService } from '@/modules/rbac/rbac.service';
import {
  computeAssignability,
  type AssignabilityReport,
} from '@/shared/test-assignability.util';
import { deriveOrgReadiness, OrgReadinessState } from '@/shared/org-readiness-v2';
import { createOrgReadinessError } from '@/shared/errors/org-readiness.error';
import { OrgOperationType } from '@/common/decorators/org-operation.decorator';

const ALLOWED_TARGET_TYPES = new Set(['CLASS', 'STUDENTS']);

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  private async ensureTestAssignable(testId: string): Promise<void> {
    const questions = await this.prisma.question.findMany({
      where: { testId },
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
    });
    const report: AssignabilityReport = computeAssignability(questions);
    if (!report.isAssignable) {
      throw new BadRequestException({
        code: 'TEST_NOT_ASSIGNABLE',
        message: 'Test není připraven k přiřazení.',
        details: report,
      });
    }
  }

  // ------- CREATE ------------------------------------------------------------
  async create(dto: CreateAssignmentDto): Promise<Assignment> {
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
      where: { id: dto.organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organizace neexistuje');

    // 3b) Org readiness >= R2_STRUCTURE_READY (invariant)
    const readiness = await deriveOrgReadiness(this.prisma, dto.organizationId);
    if (!readiness.canExecute) {
      throw createOrgReadinessError({
        operationType: OrgOperationType.EXECUTION,
        state: readiness.state,
        missing: readiness.missing,
        requiredMinState: OrgReadinessState.R2_STRUCTURE_READY,
        messageOverride: 'Organization must have a current year and at least one class section to create assignments.',
      });
    }

    // 4) Test v rámci org
    const test = await this.prisma.test.findFirst({
      where: { id: dto.testId, deletedAt: null },
      select: { id: true, organizationId: true, status: true },
    });
    if (!test || test.organizationId !== dto.organizationId) {
      throw new NotFoundException('Test nenalezen');
    }
    if (String(test.status) !== 'PUBLISHED') {
      throw new BadRequestException('Test must be published before assignment');
    }
    await this.ensureTestAssignable(test.id);

    // 5) AcademicYear v rámci org a musí být aktivní
    const year = await this.prisma.academicYear.findUnique({
      where: { id: dto.academicYearId },
      select: { id: true, orgId: true, isCurrent: true },
    });
    if (!year || year.orgId !== dto.organizationId) {
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
        select: { id: true, orgId: true, yearId: true },
      });
      if (!cs || cs.orgId !== dto.organizationId) {
        throw new NotFoundException('Class section nenalezena');
      }
      if (cs.yearId !== dto.academicYearId) {
        throw new BadRequestException('Assignment year mismatch');
      }
    }

    // 7) createdById membership existuje v org + role TEACHER/DIRECTOR
    const creator = await this.prisma.membership.findFirst({
      where: {
        id: dto.createdById,
        organizationId: dto.organizationId,
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
          organizationId: dto.organizationId,
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

    // 9) Vytvoření assignmentu (studentIds nejsou sloupec assignmentu)
    const { academicYearId: yearId, studentIds, ...rest } = dto;
    if (dto.targetType === 'STUDENTS') {
      return this.prisma.assignment.create({
        data: {
          ...rest,
          yearId,
          students: {
            create: (studentIds ?? []).map((id) => ({ studentId: id })),
          },
        },
      });
    } else {
      const { studentIds: _unused } = dto;
      void _unused;
      return this.prisma.assignment.create({ data: { ...rest, yearId } });
    }
  }

  // ------- READ --------------------------------------------------------------
  async findOne(id: string): Promise<Assignment | null> {
    return this.prisma.assignment.findUnique({ where: { id } });
  }

  async findOneOrThrow(id: string): Promise<Assignment> {
    const a = await this.findOne(id);
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
      this.rbac.canUser(userId, organizationId, PermissionKey.VIEW_ORG_ASSIGNMENTS),
      this.rbac.canUser(userId, organizationId, PermissionKey.VIEW_CLASS_ASSIGNMENTS),
      this.rbac.canUser(userId, organizationId, PermissionKey.VIEW_OWN_ASSIGNMENTS),
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
  async update(id: string, dto: UpdateAssignmentDto): Promise<Assignment> {
    const current = await this.findOneOrThrow(id);

    // Nepovoluj měnit identitu/kontext assignmentu,
    // držíme to jednoduché a bezpečné (není požadavek to dynamicky migrovat).
    if (dto.organizationId || dto.academicYearId || dto.testId || dto.createdById || dto.studentIds) {
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

    return this.prisma.assignment.update({ where: { id }, data });
  }

  // ------- DELETE ------------------------------------------------------------
  async remove(id: string): Promise<Assignment> {
    // Assignment má historickou hodnotu, pokud existují submissions; v tom případě delete zakazujeme.
    const submissions = await this.prisma.submission.count({
      where: { assignmentId: id, deletedAt: null },
    });
    if (submissions > 0) {
      throw new ConflictException('Assignment má navázané submissions.');
    }
    // Bez submissions je hard delete bezpečný (konfigurační záznam bez historie).
    return this.prisma.assignment.delete({ where: { id } });
  }

  async listForUser(user: JwtPayload): Promise<MyAssignmentDto[]> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        ...(user.organizationId ? { organizationId: user.organizationId } : {}),
        deletedAt: null,
      },
      select: { id: true, organizationId: true },
    });
    if (!membership?.organizationId) {
      return [];
    }
    const orgId = membership.organizationId;
    const scopes = await this.getAssignmentScopes(user.userId, orgId);
    if (!scopes.viewOrg && !scopes.viewClass && !scopes.viewOwn) {
      return [];
    }

    const idSets: Set<string> = new Set();

    if (scopes.viewOrg) {
      const orgAssignments = await this.prisma.assignment.findMany({
        where: { organizationId: orgId },
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

    if (scopes.viewOwn) {
      const student = await this.prisma.student.findFirst({
        where: { membershipId: membership.id, orgId },
        select: { id: true },
      });
      if (student) {
        const enrolledSections = await this.prisma.enrollment.findMany({
          where: { studentId: student.id },
          select: { classSectionId: true },
        });
        const sectionIds = enrolledSections.map((e) => e.classSectionId);
        if (sectionIds.length > 0) {
          const ownClassAssignments = await this.prisma.assignment.findMany({
            where: { organizationId: orgId, classSectionId: { in: sectionIds } },
            select: { id: true },
          });
          ownClassAssignments.forEach((a) => idSets.add(a.id));
        }
      }
      const directStudentAssignments = await this.prisma.assignment.findMany({
        where: { students: { some: { studentId: membership.id } } },
        select: { id: true },
      });
      directStudentAssignments.forEach((a) => idSets.add(a.id));
    }

    const ids = Array.from(idSets);
    if (ids.length === 0) {
      return [];
    }
    const assignments = await this.prisma.assignment.findMany({
      where: { id: { in: ids } },
      include: { submissions: { where: { studentId: membership.id } } },
      orderBy: { openAt: 'asc' },
    });
    return assignments.map((a) => ({
      id: a.id,
      testId: a.testId,
      classSectionId: a.classSectionId,
      organizationId: a.organizationId,
      openAt: a.openAt,
      closeAt: a.closeAt,
      maxAttempts: a.maxAttempts,
      attemptNo: a.submissions?.[0]?.attemptNo ?? 0,
    }));
  }
}
