/* ts-node scripts/rbac-smoke.ts
 * Rychlá kontrola RBAC vrstvy po migraci.
 */
import { PrismaClient, PermissionKey, OrganizationType } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1) Permission existence sanity
  const keys = Object.values(PermissionKey);
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });

  console.log(`Permission keys present: ${perms.length}/${keys.length}`);
  if (perms.length !== keys.length) {
    const have = new Set(perms.map(p => p.key));
    const missing = keys.filter(k => !have.has(k));
    console.warn('⚠️ Missing permissions:', missing);
  } else {
    console.log('✅ All PermissionKey values exist in DB.');
  }

  // 2) Unique constraints sanity (pokus o duplicitní insert by měl spadnout)
  try {
    await prisma.permission.create({
      data: {
        key: perms[0]?.key ?? PermissionKey.CREATE_TEST,
        description: 'dup-check',
        allowedTypes: [OrganizationType.SCHOOL],
      },
    });
    console.error('❌ Unique(key) is BROKEN (insert succeeded but should fail).');
  } catch {
    console.log('✅ Unique(key) works.');
  }

  // 3) RolePermission uniq sanity (organizationId+role+permissionId)
  const firstPerm = perms[0];
  if (firstPerm) {
    const org = await prisma.organization.findFirst();
    if (org) {
      // najdeme libovolné role permission a zkusíme duplikovat
      const rp = await prisma.rolePermission.findFirst({
        where: {
          organizationId: { equals: org.id },
          permissionId: { equals: firstPerm.id },
        },
      });

      if (rp) {
        try {
          await prisma.rolePermission.create({
            data: {
              organizationId: rp.organizationId,
              role: rp.role,
              permissionId: rp.permissionId,
              allowed: rp.allowed,
            },
          });
          console.error('❌ @@unique([organizationId, role, permissionId]) is BROKEN.');
        } catch {
          console.log('✅ RolePermission unique composite works.');
        }
      } else {
        console.log('ℹ️ No RolePermission to duplicate yet (seed přijde v Kroku 3).');
      }
    } else {
      console.log('ℹ️ No Organization present; skip RolePermission unique check.');
    }
  }

  // 4) UserPermission uniq sanity (userId+organizationId+permissionId)
  const up = await prisma.userPermission.findFirst();
  if (up) {
    try {
      await prisma.userPermission.create({
        data: {
          userId: up.userId,
          organizationId: up.organizationId,
          permissionId: up.permissionId,
          allowed: up.allowed,
        },
      });
      console.error('❌ @@unique([userId, organizationId, permissionId]) is BROKEN.');
    } catch {
      console.log('✅ UserPermission unique composite works.');
    }
  } else {
    console.log('ℹ️ No UserPermission yet (OK, ověříme po seedingu v Kroku 3).');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
