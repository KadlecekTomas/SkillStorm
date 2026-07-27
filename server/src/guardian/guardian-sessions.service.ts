import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEntityType,
  ChildVerification,
  GuardianLaunchPolicy,
  GuardianPermissionKey,
  LearningSessionStatus,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuthService } from '@/auth/auth.service';
import { JwtPayload } from '@/auth/types/jwt-payload';
import { GuardianService } from './guardian.service';
import {
  LEARNING_SESSION_TTL_MINUTES,
  PIN_LOCK_MINUTES,
  PIN_MAX_ATTEMPTS,
} from './guardian.constants';

/**
 * Guardian Etapa C — žákovské relace („Spustit pro Matěje").
 * Návrh: docs/guardian/etapa-c-stop3-navrh.md (schválený STOP #3).
 *
 * Bezpečnostní kontrakt (bod 13): server ověřuje vztah, oprávnění, policy
 * zadání, příslušnost zadání dítěti, PIN a kolizi relací — v tomto pořadí.
 * studentId z klienta se nikdy nepřijímá bez ověření vztahu. Relace se
 * nikdy nemažou (jsou zdrojem provenance); expirace navazuje na rozpracovaný
 * pokus (existující nedokončená submission se znovu použije — pipeline
 * odevzdání je na relaci nezávislá a nový pokus nikdy nevzniká).
 */
@Injectable()
export class GuardianSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly guardianService: GuardianService,
  ) {}

  async startSession(
    dto: {
      studentId: string;
      assignmentId: string;
      assistanceDeclared?: boolean;
      pin?: string;
    },
    user: JwtPayload,
  ) {
    const guardianMembershipId = this.requireParent(user);
    const organizationId = user.organizationId!;

    // 1) VERIFIED vztah + oprávnění spouštět (v1: START_HOMEWORK — doména
    //    zatím nerozlišuje úkol/test; klasifikované testy chrání policy
    //    DISABLED na zadání, viz STOP #3 rozhodnutí 4).
    const { relationId } = await this.guardianService.requireVerifiedRelation(
      guardianMembershipId,
      organizationId,
      dto.studentId,
      GuardianPermissionKey.START_HOMEWORK,
    );

    // 2) Zadání existuje, je otevřené a patří dítěti (třída NEBO adresně).
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: dto.studentId },
      select: {
        id: true,
        membershipId: true,
        membership: {
          select: { userId: true, user: { select: { name: true } } },
        },
        enrollments: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { classSectionId: true },
        },
      },
    });
    const now = new Date();
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: dto.assignmentId, organizationId },
      select: {
        id: true,
        openAt: true,
        closeAt: true,
        guardianLaunchPolicy: true,
        classSectionId: true,
        test: { select: { title: true } },
        students: {
          where: { studentId: student.membershipId },
          select: { id: true },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    const targetsChild =
      assignment.students.length > 0 ||
      (assignment.classSectionId !== null &&
        assignment.classSectionId === student.enrollments[0]?.classSectionId);
    if (!targetsChild) throw new NotFoundException('Assignment not found');
    if (assignment.openAt > now || assignment.closeAt < now) {
      throw new ConflictException('ASSIGNMENT_NOT_OPEN');
    }

    // 3) Policy zadání (konzervativní default DISABLED — princip 4).
    if (assignment.guardianLaunchPolicy === GuardianLaunchPolicy.DISABLED) {
      throw new ConflictException('GUARDIAN_LAUNCH_DISABLED');
    }
    let verificationMethod: ChildVerification = ChildVerification.NONE;
    if (
      assignment.guardianLaunchPolicy ===
      GuardianLaunchPolicy.REQUIRE_CHILD_PIN
    ) {
      await this.verifyChildPin(student.id, dto.pin, organizationId);
      verificationMethod = ChildVerification.PIN;
    }

    // 4) Kolize relací: vlastní ACTIVE relaci dítěte ukončíme (sourozenci /
    //    opakované spuštění), cizí ACTIVE → 409.
    const active = await this.prisma.learningSession.findFirst({
      where: { studentId: student.id, status: LearningSessionStatus.ACTIVE },
      select: { id: true, initiatorMembershipId: true },
    });
    if (active && active.initiatorMembershipId !== guardianMembershipId) {
      throw new ConflictException('SESSION_ALREADY_ACTIVE');
    }

    const expiresAt = new Date(
      now.getTime() + LEARNING_SESSION_TTL_MINUTES * 60 * 1000,
    );
    const session = await this.prisma.$transaction(async (tx) => {
      if (active) {
        await tx.learningSession.updateMany({
          where: { id: active.id, status: LearningSessionStatus.ACTIVE },
          data: { status: LearningSessionStatus.ENDED, endedAt: now },
        });
      }
      return tx.learningSession.create({
        data: {
          studentId: student.id,
          organizationId,
          initiatorMembershipId: guardianMembershipId,
          guardianRelationId: relationId,
          assignmentId: assignment.id,
          verificationMethod,
          assistanceDeclared: dto.assistanceDeclared ?? false,
          expiresAt,
        },
        select: { id: true, expiresAt: true },
      });
    });

    const { accessToken } = await this.authService.issueLearningSessionToken({
      childUserId: student.membership.userId,
      childMembershipId: student.membershipId,
      learningSessionId: session.id,
      expiresAt: session.expiresAt,
    });

    await this.audit('GUARDIAN_SESSION_STARTED', organizationId, session.id, {
      studentId: student.id,
      assignmentId: assignment.id,
      verificationMethod,
      assistanceDeclared: dto.assistanceDeclared ?? false,
    });

    return {
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        studentName: student.membership.user.name,
        assignmentId: assignment.id,
        assignmentTitle: assignment.test.title,
      },
      accessToken,
    };
  }

  /**
   * Ukončení: smí dítě běžící relace (token s claimem), iniciátor (rodič)
   * a škola (DIRECTOR/OWNER organizace). Idempotentní pro už ukončené.
   */
  async endSession(sessionId: string, user: JwtPayload) {
    const session = await this.prisma.learningSession.findFirst({
      where: { id: sessionId },
      select: {
        id: true,
        organizationId: true,
        studentId: true,
        initiatorMembershipId: true,
        status: true,
      },
    });
    // Cizí tenant/neexistující → 404.
    if (!session || session.organizationId !== user.organizationId) {
      throw new NotFoundException('Session not found');
    }

    const isChildInSession = user.learningSessionId === session.id;
    const isInitiator = user.membershipId === session.initiatorMembershipId;
    const isSchool =
      user.organizationRole === OrganizationRole.DIRECTOR ||
      user.organizationRole === OrganizationRole.OWNER;
    if (!isChildInSession && !isInitiator && !isSchool) {
      throw new ForbiddenException('NOT_SESSION_PARTICIPANT');
    }

    const updated = await this.prisma.learningSession.updateMany({
      where: { id: session.id, status: LearningSessionStatus.ACTIVE },
      data: {
        status: isSchool && !isInitiator && !isChildInSession
          ? LearningSessionStatus.REVOKED
          : LearningSessionStatus.ENDED,
        endedAt: new Date(),
      },
    });
    if (updated.count > 0) {
      await this.audit(
        'GUARDIAN_SESSION_ENDED',
        session.organizationId,
        session.id,
        { studentId: session.studentId, endedByRole: user.organizationRole },
      );
    }
    return { sessionId: session.id, ended: true, wasChild: isChildInSession };
  }

  /** Běžící relace dítěte pro rodinný prostor (indikace + tlačítko Ukončit). */
  async activeSessionFor(studentId: string, user: JwtPayload) {
    const guardianMembershipId = this.requireParent(user);
    await this.guardianService.requireVerifiedRelation(
      guardianMembershipId,
      user.organizationId!,
      studentId,
      GuardianPermissionKey.VIEW_ASSIGNMENTS,
    );
    const session = await this.prisma.learningSession.findFirst({
      where: {
        studentId,
        status: LearningSessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        expiresAt: true,
        assignment: { select: { test: { select: { title: true } } } },
      },
    });
    return session
      ? {
          id: session.id,
          expiresAt: session.expiresAt,
          assignmentTitle: session.assignment.test.title,
        }
      : null;
  }

  // ───────────────────────────────────────────────────────────────────────

  /**
   * PIN dítěte (STOP #3 §2.4): bcrypt hash z Etapy B, 5 pokusů → zámek
   * 15 minut. PIN se nikdy neloguje ani nevrací; audit nese jen událost.
   */
  private async verifyChildPin(
    studentId: string,
    pin: string | undefined,
    organizationId: string,
  ) {
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: studentId },
      select: {
        id: true,
        pinHash: true,
        pinFailedCount: true,
        pinLockedUntil: true,
      },
    });
    if (!student.pinHash) {
      throw new ConflictException('PIN_NOT_SET');
    }
    const now = new Date();
    if (student.pinLockedUntil && student.pinLockedUntil > now) {
      await this.audit('CHILD_PIN_LOCKED', organizationId, student.id, {});
      throw new ForbiddenException('PIN_LOCKED');
    }
    if (!pin) throw new BadRequestException('PIN_REQUIRED');

    const ok = await bcrypt.compare(pin, student.pinHash);
    if (!ok) {
      const failed = student.pinFailedCount + 1;
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          pinFailedCount: failed,
          ...(failed >= PIN_MAX_ATTEMPTS
            ? {
                pinLockedUntil: new Date(
                  now.getTime() + PIN_LOCK_MINUTES * 60 * 1000,
                ),
                pinFailedCount: 0,
              }
            : {}),
        },
      });
      await this.audit('CHILD_PIN_FAILED', organizationId, student.id, {});
      throw new ForbiddenException(
        failed >= PIN_MAX_ATTEMPTS ? 'PIN_LOCKED' : 'PIN_INVALID',
      );
    }
    await this.prisma.student.update({
      where: { id: student.id },
      data: { pinFailedCount: 0, pinLockedUntil: null },
    });
    await this.audit('CHILD_PIN_VERIFIED', organizationId, student.id, {});
  }

  private requireParent(user: JwtPayload): string {
    if (
      !user.membershipId ||
      !user.organizationId ||
      user.organizationRole !== OrganizationRole.PARENT
    ) {
      throw new ForbiddenException('PARENT_ROLE_REQUIRED');
    }
    return user.membershipId;
  }

  private async audit(
    action: string,
    organizationId: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    try {
      await this.auditService.log({
        action,
        entityType: AuditEntityType.STUDENT,
        userId: null,
        organizationId,
        entityId,
        metadata,
      });
    } catch {
      // Audit nesmí blokovat primární cestu.
    }
  }
}
