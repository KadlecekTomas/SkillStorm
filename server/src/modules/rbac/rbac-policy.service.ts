import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditEntityType,
  OrganizationRole,
  PermissionKey,
} from '@prisma/client';
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

    const record = await this.prisma.rolePermission.upsert({
      where: {
        organizationId_role_permissionId: {
          organizationId: input.organizationId ?? null,
          role: input.role,
          permissionId: permission.id,
        },
      },
      create: {
        organizationId: input.organizationId ?? null,
        role: input.role,
        permissionId: permission.id,
        allowed: true,
      },
      update: { allowed: true },
    });

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

    const record = await this.prisma.userPermission.upsert({
      where: {
        userId_organizationId_permissionId: {
          userId: input.userId,
          organizationId: input.organizationId ?? null,
          permissionId: permission.id,
        },
      },
      create: {
        userId: input.userId,
        organizationId: input.organizationId ?? null,
        permissionId: permission.id,
        allowed: true,
      },
      update: { allowed: true },
    });

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

  private audit(
    actor: ActorContext,
    payload: { action: string; entityId: string; metadata: Record<string, any> },
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: actor.userId ?? null,
        organizationId: actor.organizationId ?? null,
        entityType: AuditEntityType.PERMISSION,
        entityId: payload.entityId,
        action: payload.action,
        ipAddress: actor.ipAddress ?? null,
        userAgent: actor.userAgent ?? null,
        metadata: payload.metadata,
      },
    });
  }
}
