import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEntityType,
  OrganizationRole,
  Prisma,
  SystemRole,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { emitRbacInvalidation } from '@/modules/rbac/rbac.events';
import type { JwtPayload } from '@/auth/types/jwt-payload';

/**
 * Jediná aplikační cesta zápisu multi-role assignmentů (guardian Etapa A,
 * docs/guardian/etapa-a-analyza.md §4.1). Legacy single-role cesty
 * (invite accept, seedy, memberships.update) pracují dál jen s
 * memberships.role — o jejich assignment se stará DB sync trigger
 * membership_primary_role_sync. Konzistenci finálního stavu každé transakce
 * hlídá deferred CHECK trigger membership_primary_role_guard_*.
 *
 * Pravidla:
 * - STUDENT je exkluzivní (rozhodnutí STOP #1) — nelze ho přidat jako další
 *   roli ani přidat další roli k STUDENT membershipu.
 * - Primární roli nelze revokovat, jen změnit (changePrimaryRole).
 * - Satelity: TEACHER ⇔ Teacher řádek, STUDENT ⇔ Student řádek; PARENT,
 *   DIRECTOR a OWNER satelit nemají.
 */
@Injectable()
export class MembershipRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listActiveRoles(
    membershipId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<OrganizationRole[]> {
    const assignments = await db.membershipRoleAssignment.findMany({
      where: { membershipId, deletedAt: null },
      select: { role: true },
      orderBy: { createdAt: 'asc' },
    });
    return assignments.map((assignment) => assignment.role);
  }

  /** Tenant-scoped čtení pro API (cross-org zásah zakázán mimo SUPERADMIN). */
  async listActiveRolesFor(membershipId: string, actor: JwtPayload) {
    const membership = await this.getMembershipOrFail(membershipId);
    if (
      actor.systemRole !== SystemRole.SUPERADMIN &&
      actor.organizationId !== membership.organizationId
    ) {
      throw new ForbiddenException('Cross-organization update is forbidden.');
    }
    return this.listActiveRoles(membershipId);
  }

  /**
   * Eskalační a tenant pravidla správy rolí:
   * - cross-org zásah zakázán (mimo SUPERADMIN),
   * - OWNER se přes tento kanál nepřiřazuje ani neodebírá (transfer
   *   vlastnictví je jiná operace),
   * - DIRECTOR roli přiřazuje/odebírá jen OWNER nebo SUPERADMIN,
   * - vlastnímu členství lze přidat jen ne-eskalující roli PARENT.
   */
  private assertActorCanManage(
    actor: JwtPayload,
    membership: { userId: string; organizationId: string },
    role: OrganizationRole,
  ) {
    if (actor.systemRole === SystemRole.SUPERADMIN) return;
    if (actor.organizationId !== membership.organizationId) {
      throw new ForbiddenException('Cross-organization update is forbidden.');
    }
    if (role === OrganizationRole.OWNER) {
      throw new ForbiddenException(
        'Roli OWNER nelze spravovat přes role assignments.',
      );
    }
    if (
      role === OrganizationRole.DIRECTOR &&
      actor.organizationRole !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException(
        'Roli DIRECTOR může přiřadit jen owner nebo SUPERADMIN.',
      );
    }
    if (
      membership.userId === actor.userId &&
      role !== OrganizationRole.PARENT
    ) {
      throw new ForbiddenException(
        'Vlastnímu členství lze přidat jen roli PARENT.',
      );
    }
  }

  /** Přidá membershipu další roli (aditivně). */
  async assignRole(input: {
    membershipId: string;
    role: OrganizationRole;
    actor: JwtPayload;
  }) {
    const { membershipId, role } = input;
    if (role === OrganizationRole.STUDENT) {
      throw new BadRequestException({
        code: 'STUDENT_ROLE_EXCLUSIVE',
        message:
          'Role STUDENT je exkluzivní — nelze ji přidat jako další roli členství.',
      });
    }

    const membership = await this.getMembershipOrFail(membershipId);
    this.assertActorCanManage(input.actor, membership, role);
    if (membership.role === OrganizationRole.STUDENT) {
      throw new BadRequestException({
        code: 'STUDENT_ROLE_EXCLUSIVE',
        message: 'K žákovskému členství nelze přidávat další role.',
      });
    }

    const existing = await this.prisma.membershipRoleAssignment.findUnique({
      where: { membershipId_role: { membershipId, role } },
      select: { id: true, deletedAt: true },
    });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException({
        code: 'ROLE_ALREADY_ASSIGNED',
        message: 'Členství už tuto roli má.',
      });
    }

    const actorMembershipId = input.actor.membershipId ?? null;
    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.membershipRoleAssignment.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            createdById: actorMembershipId,
          },
        });
      } else {
        await tx.membershipRoleAssignment.create({
          data: {
            membershipId,
            role,
            createdById: actorMembershipId,
          },
        });
      }
      await this.ensureSatellite(tx, membership, role);
    });

    await this.auditService.log({
      action: 'MEMBERSHIP_ROLE_ASSIGN',
      entityType: AuditEntityType.PERMISSION,
      entityId: membershipId,
      userId: input.actor.userId ?? null,
      organizationId: membership.organizationId,
      metadata: {
        role,
        targetUserId: membership.userId,
        actorMembershipId,
      },
    });
    emitRbacInvalidation({
      userId: membership.userId,
      organizationId: membership.organizationId,
      reason: 'MEMBERSHIP_ROLE_ASSIGN',
    });
    return this.listActiveRoles(membershipId);
  }

  /**
   * Odebere membershipu roli. Revokace je účinná okamžitě — jwt.strategy
   * ověřuje activeRole claim proti aktivním assignments na každém requestu
   * (docs/guardian/etapa-a-analyza.md §4.2).
   */
  async revokeRole(input: {
    membershipId: string;
    role: OrganizationRole;
    actor: JwtPayload;
  }) {
    const { membershipId, role } = input;
    const membership = await this.getMembershipOrFail(membershipId);
    this.assertActorCanManage(input.actor, membership, role);

    if (membership.role === role) {
      throw new BadRequestException({
        code: 'CANNOT_REVOKE_PRIMARY_ROLE',
        message:
          'Primární roli nelze odebrat — nejdřív ji změň (change primary role).',
      });
    }

    const assignment = await this.prisma.membershipRoleAssignment.findUnique({
      where: { membershipId_role: { membershipId, role } },
      select: { id: true, deletedAt: true },
    });
    if (!assignment || assignment.deletedAt !== null) {
      throw new NotFoundException({
        code: 'ROLE_NOT_ASSIGNED',
        message: 'Členství tuto roli nemá.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.membershipRoleAssignment.update({
        where: { id: assignment.id },
        data: { deletedAt: new Date() },
      });
      if (membership.lastActiveRole === role) {
        await tx.membership.update({
          where: { id: membershipId },
          data: { lastActiveRole: null },
        });
      }
      await this.softDeleteSatellite(tx, membershipId, role);
    });

    await this.auditService.log({
      action: 'MEMBERSHIP_ROLE_REVOKE',
      entityType: AuditEntityType.PERMISSION,
      entityId: membershipId,
      userId: input.actor.userId ?? null,
      organizationId: membership.organizationId,
      metadata: {
        role,
        targetUserId: membership.userId,
        actorMembershipId: input.actor.membershipId ?? null,
      },
    });
    emitRbacInvalidation({
      userId: membership.userId,
      organizationId: membership.organizationId,
      reason: 'MEMBERSHIP_ROLE_REVOKE',
    });
    return this.listActiveRoles(membershipId);
  }

  /**
   * Změní primární roli při zachování ostatních přiřazených rolí.
   * (DB sync trigger má replace sémantiku pro legacy cesty, proto se tady
   * ostatní role po updatu v téže transakci znovu aktivují.)
   */
  async changePrimaryRole(input: {
    membershipId: string;
    role: OrganizationRole;
    actorUserId?: string | null;
  }) {
    const { membershipId, role } = input;
    const membership = await this.getMembershipOrFail(membershipId);
    if (membership.role === role) return this.listActiveRoles(membershipId);

    const activeRoles = await this.listActiveRoles(membershipId);
    if (!activeRoles.includes(role)) {
      throw new BadRequestException({
        code: 'ROLE_NOT_ASSIGNED',
        message: 'Primární rolí se může stát jen přiřazená role.',
      });
    }
    const rolesToKeep = activeRoles.filter((r) => r !== role);

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membershipId },
        data: { role },
      });
      // sync trigger právě soft-deletnul ostatní assignments — vrátit je
      for (const keep of rolesToKeep) {
        await tx.membershipRoleAssignment.update({
          where: { membershipId_role: { membershipId, role: keep } },
          data: { deletedAt: null },
        });
      }
    });

    await this.auditService.log({
      action: 'MEMBERSHIP_PRIMARY_ROLE_CHANGE',
      entityType: AuditEntityType.PERMISSION,
      entityId: membershipId,
      userId: input.actorUserId ?? null,
      organizationId: membership.organizationId,
      metadata: {
        previousRole: membership.role,
        nextRole: role,
        targetUserId: membership.userId,
      },
    });
    emitRbacInvalidation({
      userId: membership.userId,
      organizationId: membership.organizationId,
      reason: 'MEMBERSHIP_PRIMARY_ROLE_CHANGE',
    });
    return this.listActiveRoles(membershipId);
  }

  private async getMembershipOrFail(membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        lastActiveRole: true,
      },
    });
    if (!membership) {
      throw new NotFoundException('Členství nenalezeno.');
    }
    return membership;
  }

  private async ensureSatellite(
    tx: Prisma.TransactionClient,
    membership: { id: string; organizationId: string },
    role: OrganizationRole,
  ) {
    if (role === OrganizationRole.TEACHER) {
      const teacher = await tx.teacher.findUnique({
        where: { membershipId: membership.id },
        select: { id: true, deletedAt: true },
      });
      if (!teacher) {
        await tx.teacher.create({
          data: {
            membershipId: membership.id,
            organizationId: membership.organizationId,
          },
        });
      } else if (teacher.deletedAt !== null) {
        await tx.teacher.update({
          where: { id: teacher.id },
          data: { deletedAt: null },
        });
      }
    }
    // STUDENT sem nikdy nedojde (exkluzivita), PARENT/DIRECTOR/OWNER satelit nemají.
  }

  private async softDeleteSatellite(
    tx: Prisma.TransactionClient,
    membershipId: string,
    role: OrganizationRole,
  ) {
    if (role === OrganizationRole.TEACHER) {
      await tx.teacher.updateMany({
        where: { membershipId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }
  }
}
