import {
  OrganizationRole,
  PermissionKey,
  PrismaClient,
  SystemRole,
} from '@prisma/client';
import { logDone, logStep } from './seed-helpers';
import { USER_EMAILS } from './seed-constants';
import { RBAC_DEFAULT_PERMISSIONS } from '../../src/modules/rbac/rbac.defaults';

// Seed uses same role→permission mapping as runtime defaults. DIRECTOR is a superset of TEACHER (business rule).
const TEACHER_KEYS = (RBAC_DEFAULT_PERMISSIONS[OrganizationRole.TEACHER] as PermissionKey[]) ?? [];
const TEACHER_KEYS_HARDENED = TEACHER_KEYS.includes(PermissionKey.ASSIGN_TESTS)
  ? TEACHER_KEYS
  : [...TEACHER_KEYS, PermissionKey.ASSIGN_TESTS];
const DIRECTOR_KEYS =
  (RBAC_DEFAULT_PERMISSIONS[OrganizationRole.DIRECTOR] as PermissionKey[]) ??
  Object.values(PermissionKey);

const ROLE_MATRIX: Partial<Record<OrganizationRole, PermissionKey[]>> = {
  [OrganizationRole.DIRECTOR]: DIRECTOR_KEYS,
  [OrganizationRole.TEACHER]: TEACHER_KEYS_HARDENED,
  [OrganizationRole.STUDENT]: [
    PermissionKey.VIEW_RESULTS,
    PermissionKey.VIEW_TEST_OVERVIEW,
    PermissionKey.VIEW_SUBMISSIONS,
    PermissionKey.VIEW_OWN_ASSIGNMENTS,
  ],
  [OrganizationRole.PARENT]: [PermissionKey.VIEW_RESULTS, PermissionKey.VIEW_SUBMISSIONS],
};

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
  let updatedCount = 0;

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
        await prisma.rolePermission.update({
          where: { id: existing.id },
          data: { allowed: true },
        });
        updatedCount++;
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
    `✅ RBAC > RolePermissions synced (${createdCount} created, ${updatedCount} updated)`,
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
