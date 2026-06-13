import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrganizationRole, PermissionKey } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RBAC_DEFAULT_PERMISSIONS } from './rbac.defaults';

@Injectable()
export class RbacDefaultSyncService implements OnModuleInit {
  private readonly logger = new Logger(RbacDefaultSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncDefaults();
  }

  private async syncDefaults(): Promise<void> {
    const permissionRows = await this.ensurePermissions();
    const permissionIdByKey = new Map(
      permissionRows.map((row) => [row.key, row.id]),
    );

    let createdRolePermissions = 0;

    for (const role of Object.values(OrganizationRole)) {
      const defaults = RBAC_DEFAULT_PERMISSIONS[role];
      if (!defaults) continue;

      const keys =
        defaults === '*'
          ? (Object.values(PermissionKey) as PermissionKey[])
          : (defaults as PermissionKey[]);

      for (const key of keys) {
        const permissionId = permissionIdByKey.get(key);
        if (!permissionId) continue;

        const existing = await this.prisma.rolePermission.findFirst({
          where: {
            organizationId: null,
            role,
            permissionId,
          },
          select: { id: true },
        });

        // Respect manual policy overrides; only create missing defaults.
        if (existing) continue;

        await this.prisma.rolePermission.create({
          data: {
            organizationId: null,
            role,
            permissionId,
            allowed: true,
          },
        });
        createdRolePermissions += 1;
      }
    }

    if (createdRolePermissions > 0) {
      this.logger.log(
        `RBAC default sync created ${createdRolePermissions} missing global role_permissions`,
      );
    }
  }

  private async ensurePermissions() {
    for (const key of Object.values(PermissionKey)) {
      await this.prisma.permission.upsert({
        where: { key },
        update: {
          description: key.replace(/_/g, ' '),
        },
        create: {
          key,
          description: key.replace(/_/g, ' '),
          allowedTypes: [],
        },
      });
    }

    return this.prisma.permission.findMany({
      select: { id: true, key: true },
    });
  }
}
