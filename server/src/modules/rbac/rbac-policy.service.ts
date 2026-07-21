import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PermissionKey, Prisma } from '@prisma/client';
import { AuditEntityType, OrganizationRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { emitRbacInvalidation } from './rbac.events';

type ActorContext = {
  userId?: string | null;
  organizationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type RolePermissionInput = {
  role: OrganizationRole;
  permissionKey: PermissionKey;
  organizationId?: string | null;
};

type UserPermissionInput = {
  userId: string;
  permissionKey: PermissionKey;
  organizationId?: string | null;
};

@Injectable()
export class RbacPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async grantRolePermission(actor: ActorContext, input: RolePermissionInput) {
    const permission = await this.prisma.permission.findUnique({
      where: { key: input.permissionKey },
      select: { id: true },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permission ${input.permissionKey} not found`,
      );
    }

    const record = input.organizationId
      ? await this.prisma.rolePermission.upsert({
          where: {
            organizationId_role_permissionId: {
              organizationId: input.organizationId,
              role: input.role,
              permissionId: permission.id,
            },
          },
          create: {
            organizationId: input.organizationId,
            role: input.role,
            permissionId: permission.id,
            allowed: true,
          },
          update: { allowed: true },
        })
      : await this.upsertGlobalRolePermission(input.role, permission.id);

    await this.audit(actor, {
      action: 'ROLE_PERMISSION_GRANT',
      entityId: record.id,
      metadata: {
        role: input.role,
        permissionKey: input.permissionKey,
        organizationId: input.organizationId ?? null,
      },
    });

    emitRbacInvalidation({
      organizationId: input.organizationId ?? null,
      reason: 'ROLE_PERMISSION_GRANT',
    });

    return record;
  }

  async revokeRolePermission(actor: ActorContext, input: RolePermissionInput) {
    const permission = await this.prisma.permission.findUnique({
      where: { key: input.permissionKey },
      select: { id: true },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permission ${input.permissionKey} not found`,
      );
    }

    const existing = await this.prisma.rolePermission.findFirst({
      where: {
        permissionId: permission.id,
        role: input.role,
        organizationId: input.organizationId ?? null,
      },
    });

    if (!existing) {
      return null;
    }

    await this.prisma.rolePermission.delete({ where: { id: existing.id } });

    await this.audit(actor, {
      action: 'ROLE_PERMISSION_REVOKE',
      entityId: existing.id,
      metadata: {
        role: input.role,
        permissionKey: input.permissionKey,
        organizationId: input.organizationId ?? null,
      },
    });

    emitRbacInvalidation({
      organizationId: input.organizationId ?? null,
      reason: 'ROLE_PERMISSION_REVOKE',
    });

    return existing;
  }

  async grantUserPermission(actor: ActorContext, input: UserPermissionInput) {
    const permission = await this.prisma.permission.findUnique({
      where: { key: input.permissionKey },
      select: { id: true },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permission ${input.permissionKey} not found`,
      );
    }

    // INV4 write-path hardening: org-scoped generický grant nesmí zamířit na
    // PARENT-only membership (rodič nezískává generická oprávnění; přístup je
    // výhradně vztahový). Teacher-parent (má i non-PARENT roli) není blokován —
    // grant se v jeho PARENT kontextu stejně ignoruje v resolveru (canUser).
    // Globální granty se zde neblokují záměrně: u multi-org teacher-parent by
    // globální blok rozbil legitimní non-PARENT kontext; jejich neúčinnost pod
    // aktivní PARENT rolí garantuje resolver. Viz docs/guardian.md.
    if (input.organizationId) {
      await this.assertTargetNotParentOnly(
        input.userId,
        input.organizationId,
        input.permissionKey,
      );
    }

    const record = input.organizationId
      ? await this.prisma.userPermission.upsert({
          where: {
            userId_organizationId_permissionId: {
              userId: input.userId,
              organizationId: input.organizationId,
              permissionId: permission.id,
            },
          },
          create: {
            userId: input.userId,
            organizationId: input.organizationId,
            permissionId: permission.id,
            allowed: true,
          },
          update: { allowed: true },
        })
      : await this.upsertGlobalUserPermission(input.userId, permission.id);

    await this.audit(actor, {
      action: 'USER_PERMISSION_GRANT',
      entityId: record.id,
      metadata: {
        userId: input.userId,
        permissionKey: input.permissionKey,
        organizationId: input.organizationId ?? null,
      },
    });

    emitRbacInvalidation({
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      reason: 'USER_PERMISSION_GRANT',
    });

    return record;
  }

  async revokeUserPermission(actor: ActorContext, input: UserPermissionInput) {
    const permission = await this.prisma.permission.findUnique({
      where: { key: input.permissionKey },
      select: { id: true },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permission ${input.permissionKey} not found`,
      );
    }

    const existing = await this.prisma.userPermission.findFirst({
      where: {
        permissionId: permission.id,
        userId: input.userId,
        organizationId: input.organizationId ?? null,
      },
    });

    if (!existing) {
      return null;
    }

    await this.prisma.userPermission.delete({ where: { id: existing.id } });

    await this.audit(actor, {
      action: 'USER_PERMISSION_REVOKE',
      entityId: existing.id,
      metadata: {
        userId: input.userId,
        permissionKey: input.permissionKey,
        organizationId: input.organizationId ?? null,
      },
    });

    emitRbacInvalidation({
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      reason: 'USER_PERMISSION_REVOKE',
    });

    return existing;
  }

  /**
   * INV4: odmítne org-scoped user-permission grant, pokud je cílová membership
   * v dané organizaci PARENT-only (nemá žádnou non-PARENT roli). Multi-role
   * teacher/ředitel-rodič projde — jeho PARENT kontext jistí resolver.
   */
  private async assertTargetNotParentOnly(
    userId: string,
    organizationId: string,
    permissionKey: PermissionKey,
  ): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, organizationId, deletedAt: null },
      select: {
        role: true,
        roleAssignments: { select: { role: true } },
      },
    });
    if (!membership) {
      return;
    }
    const roles = new Set<OrganizationRole>([
      membership.role,
      ...membership.roleAssignments.map((r) => r.role),
    ]);
    const hasNonParentRole = Array.from(roles).some(
      (role) => role !== OrganizationRole.PARENT,
    );
    if (roles.has(OrganizationRole.PARENT) && !hasNonParentRole) {
      throw new ForbiddenException({
        statusCode: 403,
        message:
          'Rodičovská role nezískává generická oprávnění. Použij vztahový guardian přístup.',
        code: 'PARENT_GENERIC_PERMISSION_FORBIDDEN',
        permissionKey,
      });
    }
  }

  private audit(
    actor: ActorContext,
    payload: {
      action: string;
      entityId: string;
      metadata: Record<string, any>;
    },
  ) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: actor.userId ?? null,
      organizationId: actor.organizationId ?? null,
      entityType: AuditEntityType.PERMISSION,
      entityId: payload.entityId,
      action: payload.action,
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
    };
    if (payload.metadata !== undefined) {
      data.metadata = payload.metadata;
    }
    return this.prisma.auditLog.create({ data });
  }

  private async upsertGlobalRolePermission(
    role: OrganizationRole,
    permissionId: string,
  ) {
    const existing = await this.prisma.rolePermission.findFirst({
      where: { organizationId: null, role, permissionId },
    });
    if (existing) {
      return this.prisma.rolePermission.update({
        where: { id: existing.id },
        data: { allowed: true },
      });
    }
    return this.prisma.rolePermission.create({
      data: { organizationId: null, role, permissionId, allowed: true },
    });
  }

  private async upsertGlobalUserPermission(
    userId: string,
    permissionId: string,
  ) {
    const existing = await this.prisma.userPermission.findFirst({
      where: { userId, organizationId: null, permissionId },
    });
    if (existing) {
      return this.prisma.userPermission.update({
        where: { id: existing.id },
        data: { allowed: true },
      });
    }
    return this.prisma.userPermission.create({
      data: {
        userId,
        organizationId: null,
        permissionId,
        allowed: true,
      },
    });
  }
}
