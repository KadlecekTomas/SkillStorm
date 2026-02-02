// src/assignments/assignments.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Assignment, Prisma } from '@prisma/client';
import type { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { MyAssignmentDto } from './my-assignments.dto';

const ALLOWED_TARGET_TYPES = new Set(['CLASS', 'STUDENTS']);

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private isQuestionScoreable(q: {
    type: string;
    correctAnswer: string | null;
    correctAnswers: string[];
  }) {
    const hasAnswer = this.normalizeText(q.correctAnswer) !== null;
    const hasAnswers = Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0;

    if (q.type === 'MULTIPLE_CHOICE') {
      if (hasAnswer && hasAnswers) return false;
      return hasAnswer || hasAnswers;
    }
    if (q.type === 'TRUE_FALSE' || q.type === 'FILL_IN_THE_BLANK') {
      return hasAnswer;
    }
    return false;
  }

  private async ensureTestScoreable(testId: string) {
    const questions = await this.prisma.question.findMany({
      where: { testId },
      select: {
        id: true,
        type: true,
        correctAnswer: true,
        correctAnswers: true,
      },
    });
    if (questions.length === 0) {
      throw new BadRequestException('Test has no questions');
    }
    const unscorable = questions.filter((q) => !this.isQuestionScoreable(q));
    if (unscorable.length > 0) {
      throw new BadRequestException('Test contains unscorable questions');
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

    // 2) Časy
    const openAt = new Date(dto.openAt);
    const closeAt = new Date(dto.closeAt);
    if (openAt.getTime() >= closeAt.getTime()) {
      throw new BadRequestException('openAt musí být dříve než closeAt');
    }

    // 3) Organizace
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organizace neexistuje');

    // 4) Test v rámci org
    const test = await this.prisma.test.findFirst({
      where: { id: dto.testId, deletedAt: null },
      select: { id: true, organizationId: true, status: true },
    });
    if (!test || test.organizationId !== dto.organizationId) {
      throw new BadRequestException(
        'Test neexistuje nebo nepatří do organizace',
      );
    }
    if (String(test.status) !== 'PUBLISHED') {
      throw new BadRequestException('Test must be published before assignment');
    }
    await this.ensureTestScoreable(test.id);

    // 5) AcademicYear v rámci org
    const year = await this.prisma.academicYear.findUnique({
      where: { id: dto.academicYearId },
      select: { id: true, orgId: true },
    });
    if (!year || year.orgId !== dto.organizationId) {
      throw new BadRequestException(
        'academicYearId neexistuje nebo nepatří do organizace',
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
        throw new BadRequestException(
          'classSectionId neexistuje nebo nepatří do organizace',
        );
      }
      if (cs.yearId !== dto.academicYearId) {
        throw new BadRequestException(
          'classSectionId musí patřit do zadaného akademického roku',
        );
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
        select: { id: true, orgId: true },
      });
      if (!cs || cs.orgId !== current.organizationId) {
        throw new BadRequestException(
          'classSectionId neexistuje nebo nepatří do organizace',
        );
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
    if (!membership) {
      return [];
    }
    const assignments = await this.prisma.assignment.findMany({
      where: {
        organizationId: membership.organizationId,
        targetType: 'CLASS',
      },
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
