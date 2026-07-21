import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEntityType,
  EnrollmentStatus,
  GuardianPermissionKey,
  GuardianRelationStatus,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { InvitesService } from '@/invites/invites.service';
import { OrgContext } from '@/common/org-context/org-context.types';
import { JwtPayload } from '@/auth/types/jwt-payload';
import { teacherClassScope } from '@/shared/access.utils';
import { DEFAULT_GUARDIAN_PERMISSIONS } from './guardian.constants';

/**
 * Guardian Etapa B — vztahy rodič↔žák a školou řízené párování.
 *
 * Bezpečnostní kontrakt (STOP #2 §4):
 * - cizí tenant → 404 (nikdy nepotvrzujeme existenci),
 * - vztah/žák v org, ale mimo scope aktéra → 403,
 * - revokace platí okamžitě — stav se čte z DB, nikdy z JWT,
 * - odpovědi rodiči nikdy nenesou XP/level/parťáka.
 */
@Injectable()
export class GuardianService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly invitesService: InvitesService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Rodičovská strana
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Děti aktivního (PARENT) membershipu: VERIFIED jako children, PENDING
   * zvlášť k potvrzovací obrazovce. DISPUTED se vrací jen jako příznak —
   * rodič k dítěti nemá žádný přístup, řeší škola.
   */
  async listChildren(user: JwtPayload) {
    const membershipId = this.requireParentMembership(user);
    const relations = await this.prisma.guardianStudentRelation.findMany({
      where: {
        guardianMembershipId: membershipId,
        revokedAt: null,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        permissions: true,
        student: {
          select: {
            id: true,
            membership: { select: { user: { select: { name: true } } } },
            enrollments: {
              where: { status: EnrollmentStatus.ACTIVE },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                classSection: { select: { label: true, yearId: true } },
              },
            },
          },
        },
      },
    });

    const shape = (r: (typeof relations)[number]) => ({
      relationId: r.id,
      studentId: r.student.id,
      name: r.student.membership.user.name,
      classLabel: r.student.enrollments[0]?.classSection.label ?? null,
      permissions: r.permissions,
    });

    return {
      children: relations
        .filter((r) => r.status === GuardianRelationStatus.VERIFIED)
        .map(shape),
      pendingConfirmation: relations
        .filter((r) => r.status === GuardianRelationStatus.PENDING)
        .map(shape),
      disputed: relations
        .filter((r) => r.status === GuardianRelationStatus.DISPUTED)
        .map((r) => ({ relationId: r.id })),
    };
  }

  /**
   * Potvrzovací obrazovka („Je X vaše dítě?"): Ano → VERIFIED + default
   * oprávnění. Ne → DISPUTED, viditelné škole; rodiči nedává žádný přístup.
   */
  async resolvePendingRelation(
    relationId: string,
    confirmed: boolean,
    user: JwtPayload,
  ) {
    const membershipId = this.requireParentMembership(user);
    const relation = await this.prisma.guardianStudentRelation.findFirst({
      where: { id: relationId, guardianMembershipId: membershipId },
      select: { id: true, status: true, organizationId: true, studentId: true },
    });
    // Cizí/neexistující vztah → 404: nepotvrzujeme existenci.
    if (!relation) throw new NotFoundException('Relation not found');
    if (relation.status !== GuardianRelationStatus.PENDING) {
      throw new BadRequestException('RELATION_NOT_PENDING');
    }

    const now = new Date();
    const updated = await this.prisma.guardianStudentRelation.updateMany({
      where: { id: relation.id, status: GuardianRelationStatus.PENDING },
      data: confirmed
        ? {
            status: GuardianRelationStatus.VERIFIED,
            verifiedAt: now,
            permissions: DEFAULT_GUARDIAN_PERMISSIONS,
          }
        : { status: GuardianRelationStatus.DISPUTED, disputedAt: now },
    });
    if (updated.count === 0) {
      throw new BadRequestException('RELATION_NOT_PENDING');
    }

    await this.audit(
      confirmed ? 'GUARDIAN_RELATION_CONFIRMED' : 'GUARDIAN_RELATION_DISPUTED',
      relation.organizationId,
      relation.id,
      user.userId,
      { studentId: relation.studentId },
    );
    return { relationId: relation.id, confirmed };
  }

  /**
   * Rodinný prostor — data pro jednu obrazovku dítěte (STOP #2 / spec bod 3):
   * Co je potřeba udělat · Jak se dítěti daří · Zprávy · Doporučený další
   * krok. Vztah + oprávnění už ověřil GuardianAccessGuard. Lidský jazyk a
   * basic/detail je věc klienta — server vrací data; nikdy XP/level/parťáka.
   */
  async getChildOverview(studentId: string) {
    const now = new Date();
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: studentId },
      select: {
        id: true,
        orgId: true,
        membershipId: true,
        membership: { select: { user: { select: { name: true } } } },
        enrollments: {
          where: { status: EnrollmentStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            classSectionId: true,
            classSection: { select: { label: true } },
          },
        },
      },
    });
    const classSectionId = student.enrollments[0]?.classSectionId ?? null;

    const assignments = await this.prisma.assignment.findMany({
      where: {
        organizationId: student.orgId,
        openAt: { lte: now },
        closeAt: { gte: now },
        OR: [
          ...(classSectionId ? [{ classSectionId }] : []),
          { students: { some: { studentId: student.membershipId } } },
        ],
      },
      orderBy: { closeAt: 'asc' },
      select: {
        id: true,
        closeAt: true,
        guardianLaunchPolicy: true,
        test: { select: { title: true } },
        submissions: {
          where: { studentId: student.membershipId },
          select: { id: true, submittedAt: true },
        },
      },
    });

    const todo = assignments
      .filter((a) => !a.submissions.some((s) => s.submittedAt))
      .map((a) => ({
        assignmentId: a.id,
        title: a.test.title,
        dueAt: a.closeAt,
        started: a.submissions.length > 0,
        // Guardian Etapa C: klient podle policy ukáže „Spustit pro …"
        // (ALLOWED), vyžádá PIN (REQUIRE_CHILD_PIN), nebo tlačítko neukáže.
        guardianLaunchPolicy: a.guardianLaunchPolicy,
      }));

    const recentSubmissions = await this.prisma.submission.findMany({
      where: {
        studentId: student.membershipId,
        submittedAt: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      take: 5,
      select: {
        submittedAt: true,
        score: true,
        assignment: { select: { test: { select: { title: true } } } },
      },
    });

    const nextStep = todo[0]
      ? {
          type: 'ASSIGNMENT_DUE' as const,
          assignmentId: todo[0].assignmentId,
          title: todo[0].title,
          dueAt: todo[0].dueAt,
        }
      : null;

    return {
      student: {
        id: student.id,
        name: student.membership.user.name,
        classLabel: student.enrollments[0]?.classSection.label ?? null,
      },
      todo,
      progress: recentSubmissions.map((s) => ({
        title: s.assignment.test.title,
        submittedAt: s.submittedAt,
        score: s.score,
      })),
      // Školní oznámení zatím neexistují (plný messaging je mimo rozsah);
      // blok Zprávy je v UI, data přijdou s notifikačním projektem.
      messages: [] as never[],
      nextStep,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Školní strana (párování)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Nastavení/reset žákovského PINu školou (spec bod 11). PIN je 4–6 číslic
   * (STOP #2), ukládá se výhradně bcrypt hash, hodnota se nesmí objevit v
   * lozích ani auditu; počítadla pokusů vynucuje až ověřovací cesta Etapy C.
   */
  async setStudentPin(studentId: string, pin: string, ctx: OrgContext) {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('PIN_FORMAT_INVALID');
    }
    const student = await this.findStudentInOrgOrThrow(studentId, ctx);
    await this.assertActorScopeForStudent(student.id, ctx);

    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        pinHash,
        pinUpdatedAt: new Date(),
        pinFailedCount: 0,
        pinLockedUntil: null,
      },
    });

    await this.audit('STUDENT_PIN_SET', ctx.organizationId, student.id, null, {
      studentId: student.id,
    });
    return { studentId: student.id, updated: true };
  }

  /** Jednorázový párovací kód pro jednoho žáka (sekundární flow). */
  async createGuardianInvite(studentId: string, ctx: OrgContext) {
    const student = await this.findStudentInOrgOrThrow(studentId, ctx);
    await this.assertActorScopeForStudent(student.id, ctx);

    const invite = await this.invitesService.createGuardianInvite({
      organizationId: ctx.organizationId,
      studentId: student.id,
      createdById: ctx.membershipId,
    });

    await this.audit(
      'GUARDIAN_INVITE_CREATED',
      ctx.organizationId,
      student.id,
      null,
      { studentId: student.id, expiresAt: invite.expiresAt.toISOString() },
    );

    return {
      studentId: student.id,
      studentName: student.name,
      code: invite.code,
      token: invite.token,
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Primární flow: kódy pro celou třídu najednou (arch lístečků tiskne
   * klient z vrácených dat). Kód vzniká jen žákům bez živého VERIFIED
   * vztahu? NE — i dítě s jedním ověřeným rodičem může dostat kód pro
   * druhého rodiče; generujeme všem aktivně zapsaným žákům třídy.
   */
  async createBulkGuardianInvites(classSectionId: string, ctx: OrgContext) {
    const classSection = await this.prisma.classSection.findFirst({
      where: { id: classSectionId, orgId: ctx.organizationId },
      select: { id: true, label: true, yearId: true },
    });
    if (!classSection) throw new NotFoundException('Class section not found');
    await this.assertActorScopeForClass(classSection.id, ctx);

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classSectionId: classSection.id,
        status: EnrollmentStatus.ACTIVE,
        student: { deletedAt: null },
      },
      orderBy: {
        student: { membership: { user: { name: 'asc' } } },
      },
      select: {
        student: {
          select: {
            id: true,
            membership: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });

    const slips = [] as {
      studentId: string;
      studentName: string;
      code: string | null;
      token: string;
      expiresAt: Date;
    }[];
    for (const e of enrollments) {
      const invite = await this.invitesService.createGuardianInvite({
        organizationId: ctx.organizationId,
        studentId: e.student.id,
        createdById: ctx.membershipId,
      });
      slips.push({
        studentId: e.student.id,
        studentName: e.student.membership.user.name,
        code: invite.code,
        token: invite.token,
        expiresAt: invite.expiresAt,
      });
    }

    await this.audit(
      'GUARDIAN_INVITE_BULK_CREATED',
      ctx.organizationId,
      classSection.id,
      null,
      { classSectionId: classSection.id, count: slips.length },
    );

    return { classSectionId: classSection.id, classLabel: classSection.label, slips };
  }

  /** Stav párování žáka pro školu (třídní vidí i DISPUTED). */
  async listStudentGuardians(studentId: string, ctx: OrgContext) {
    const student = await this.findStudentInOrgOrThrow(studentId, ctx);
    await this.assertActorScopeForStudent(student.id, ctx);

    const relations = await this.prisma.guardianStudentRelation.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        type: true,
        permissions: true,
        verifiedAt: true,
        disputedAt: true,
        revokedAt: true,
        validUntil: true,
        createdAt: true,
        guardianMembership: {
          select: { user: { select: { name: true, email: true } } },
        },
        verifiedBy: { select: { user: { select: { name: true } } } },
      },
    });

    return relations.map((r) => ({
      relationId: r.id,
      status: r.status,
      type: r.type,
      guardianName: r.guardianMembership.user.name,
      guardianEmail: r.guardianMembership.user.email,
      permissions: r.permissions,
      verifiedAt: r.verifiedAt,
      verifiedByName: r.verifiedBy?.user.name ?? null,
      disputedAt: r.disputedAt,
      revokedAt: r.revokedAt,
      validUntil: r.validUntil,
      createdAt: r.createdAt,
    }));
  }

  /** Revokace vztahu školou — okamžitý konec přístupu (i pro DISPUTED). */
  async revokeRelation(relationId: string, ctx: OrgContext) {
    const relation = await this.prisma.guardianStudentRelation.findFirst({
      where: { id: relationId, organizationId: ctx.organizationId },
      select: { id: true, studentId: true, revokedAt: true },
    });
    if (!relation) throw new NotFoundException('Relation not found');
    await this.assertActorScopeForStudent(relation.studentId, ctx);
    if (relation.revokedAt) {
      return { relationId: relation.id, alreadyRevoked: true };
    }

    await this.prisma.guardianStudentRelation.update({
      where: { id: relation.id },
      data: {
        status: GuardianRelationStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: ctx.membershipId,
      },
    });

    await this.audit(
      'GUARDIAN_RELATION_REVOKED',
      ctx.organizationId,
      relation.id,
      null,
      { studentId: relation.studentId },
    );
    return { relationId: relation.id, alreadyRevoked: false };
  }

  /**
   * Veřejný kontrakt pro guardian operace mimo :studentId routy (Etapa C —
   * spuštění relace se studentId v těle): VERIFIED vztah + oprávnění,
   * sémantika 404/403 shodná s GuardianAccessGuard.
   */
  async requireVerifiedRelation(
    guardianMembershipId: string,
    organizationId: string,
    studentId: string,
    permission: GuardianPermissionKey,
  ): Promise<{ relationId: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, orgId: organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    const relation = await this.prisma.guardianStudentRelation.findFirst({
      where: {
        guardianMembershipId,
        studentId,
        status: GuardianRelationStatus.VERIFIED,
        revokedAt: null,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      select: { id: true, permissions: true },
    });
    if (!relation || !relation.permissions.includes(permission)) {
      throw new ForbiddenException('NOT_YOUR_CHILD');
    }
    return { relationId: relation.id };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interní
  // ─────────────────────────────────────────────────────────────────────────

  private requireParentMembership(user: JwtPayload): string {
    if (
      !user.membershipId ||
      user.organizationRole !== OrganizationRole.PARENT
    ) {
      throw new ForbiddenException('PARENT_ROLE_REQUIRED');
    }
    return user.membershipId;
  }

  private async findStudentInOrgOrThrow(studentId: string, ctx: OrgContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        orgId: ctx.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        membership: { select: { user: { select: { name: true } } } },
      },
    });
    // Cizí tenant i neexistující žák → 404.
    if (!student) throw new NotFoundException('Student not found');
    return { id: student.id, name: student.membership.user.name };
  }

  /**
   * TEACHER smí párovat jen žáky svých tříd (homeroom NEBO aktivní úvazek —
   * `teacherClassScope`, nikdy samotné `{ teacherId }`); DIRECTOR/OWNER
   * org-wide.
   */
  private async assertActorScopeForStudent(studentId: string, ctx: OrgContext) {
    if (ctx.role !== OrganizationRole.TEACHER) return;
    const teacher = await this.teacherOrThrow(ctx);
    const inScope = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        status: EnrollmentStatus.ACTIVE,
        classSection: this.teacherScopedClass(teacher.id, ctx),
      },
      select: { id: true },
    });
    if (!inScope) throw new ForbiddenException('NOT_YOUR_CLASS');
  }

  private async assertActorScopeForClass(
    classSectionId: string,
    ctx: OrgContext,
  ) {
    if (ctx.role !== OrganizationRole.TEACHER) return;
    const teacher = await this.teacherOrThrow(ctx);
    const inScope = await this.prisma.classSection.findFirst({
      where: {
        id: classSectionId,
        ...this.teacherScopedClass(teacher.id, ctx),
      },
      select: { id: true },
    });
    if (!inScope) throw new ForbiddenException('NOT_YOUR_CLASS');
  }

  private teacherScopedClass(
    teacherId: string,
    ctx: OrgContext,
  ): Prisma.ClassSectionWhereInput {
    return {
      orgId: ctx.organizationId,
      ...teacherClassScope(teacherId, ctx.activeAcademicYearId ?? undefined),
    };
  }

  private async teacherOrThrow(ctx: OrgContext) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { membershipId: ctx.membershipId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) throw new ForbiddenException('NOT_YOUR_CLASS');
    return teacher;
  }

  private async audit(
    action: string,
    organizationId: string,
    entityId: string,
    userId: string | null,
    metadata: Prisma.InputJsonObject,
  ) {
    try {
      await this.auditService.log({
        action,
        entityType: AuditEntityType.STUDENT,
        userId,
        organizationId,
        entityId,
        metadata,
      });
    } catch {
      // Audit nesmí blokovat primární cestu (vzor invites.service).
    }
  }
}
