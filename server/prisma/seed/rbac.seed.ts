import {
  OrganizationRole,
  PermissionKey,
  PrismaClient,
  SystemRole,
} from '@prisma/client';
import { logDone, logStep } from './seed-helpers';
import { USER_EMAILS } from './seed-constants';
import { RBAC_DEFAULT_PERMISSIONS } from '@/modules/rbac/rbac.defaults';

const ROLE_MATRIX: Partial<Record<OrganizationRole, PermissionKey[]>> = Object.values(
  OrganizationRole,
).reduce<Partial<Record<OrganizationRole, PermissionKey[]>>>((acc, role) => {
  const defaults = RBAC_DEFAULT_PERMISSIONS[role];
  if (!defaults) return acc;
  acc[role] =
    defaults === '*'
      ? (Object.values(PermissionKey) as PermissionKey[])
      : (defaults as PermissionKey[]);
  return acc;
}, {});

export async function seed(prisma: PrismaClient) {
  logStep('RBAC > Permissions & role policies');

  // 1️⃣  Sync permissions
  for (const key of Object.values(PermissionKey)) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: key.replace(/_/g, ' ') },
      create: {
        key,
        description: key.replace(/_/g, ' '),
        allowedTypes: [],
      },
    });
  }

  const permissions = await prisma.permission.findMany({
    select: { id: true, key: true },
  });
  const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));

  let createdCount = 0;
  let skippedExistingCount = 0;

  // 2️⃣  RolePermission matrix
  for (const [role, keys] of Object.entries(ROLE_MATRIX)) {
    for (const key of keys ?? []) {
      const permissionId = permissionByKey.get(key);
      if (!permissionId) continue;

      const existing = await prisma.rolePermission.findFirst({
        where: {
          organizationId: null,
          role: role as OrganizationRole,
          permissionId,
        },
      });

      if (existing) {
        // Keep manual admin overrides intact (allowed=true/false).
        skippedExistingCount++;
      } else {
        await prisma.rolePermission.create({
          data: {
            organizationId: null,
            role: role as OrganizationRole,
            permissionId,
            allowed: true,
          },
        });
        createdCount++;
      }
    }
  }

  console.log(
    `✅ RBAC > RolePermissions synced (${createdCount} created, ${skippedExistingCount} existing kept)`,
  );

  // 3️⃣  Set SUPERADMIN role for system user (if present)
  await prisma.user
    .update({
      where: { email: USER_EMAILS.superadmin },
      data: { systemRole: SystemRole.SUPERADMIN },
    })
    .catch(() =>
      console.log(
        '⚠️  RBAC > Superadmin user not found yet – will be created in users seed.',
      ),
    );

  logDone('RBAC module seeded');
}
