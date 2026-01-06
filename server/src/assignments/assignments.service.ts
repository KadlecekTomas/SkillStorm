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
    const test = await this.prisma.test.findUnique({
      where: { id: dto.testId },
      select: { id: true, organizationId: true },
    });
    if (!test || test.organizationId !== dto.organizationId) {
      throw new BadRequestException(
        'Test neexistuje nebo nepatří do organizace',
      );
    }

    // 5) classSection (pokud je) v rámci org
    if (dto.classSectionId) {
      const cs = await this.prisma.classSection.findUnique({
        where: { id: dto.classSectionId },
        select: { id: true, orgId: true },
      });
      if (!cs || cs.orgId !== dto.organizationId) {
        throw new BadRequestException(
          'classSectionId neexistuje nebo nepatří do organizace',
        );
      }
    }

    // 6) createdById membership existuje v org + role TEACHER/DIRECTOR
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

    // 7) STUDENTS -> studentIds povinné + všichni studenti z téže org
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

    // 8) Vytvoření assignmentu (studentIds nejsou sloupec assignmentu)
    if (dto.targetType === 'STUDENTS') {
      // Vytvoř Assignment a AssignmentStudent záznamy
      const { studentIds, ...rest } = dto;
      return this.prisma.assignment.create({
        data: {
          ...rest,
          students: {
            create: (studentIds ?? []).map((id) => ({ studentId: id })),
          },
        },
      });
    } else {
      // CLASS: bez students
      const { studentIds: _unused, ...rest } = dto;
      void _unused;
      return this.prisma.assignment.create({ data: rest });
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
    if (dto.organizationId || dto.testId || dto.createdById || dto.studentIds) {
      throw new BadRequestException(
        'Pole organizationId/testId/createdById/studentIds nelze měnit PATCHem',
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
