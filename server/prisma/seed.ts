import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type PermissionKey =
  | 'CREATE_TEST'
  | 'EDIT_TEST'
  | 'DELETE_TEST'
  | 'VIEW_RESULTS'
  | 'MANAGE_STUDENTS'
  | 'MANAGE_TEACHERS';

type OrganizationRole = 'STUDENT' | 'TEACHER' | 'DIRECTOR';
type PlanTarget = 'SCHOOL' | 'PRIVATE' | 'COMMUNITY';

async function main() {
  console.log('🌱 Starting seed...');

  // 1️⃣ Seed Permissions
  const permissionKeys: PermissionKey[] = [
    'CREATE_TEST',
    'EDIT_TEST',
    'DELETE_TEST',
    'VIEW_RESULTS',
    'MANAGE_STUDENTS',
    'MANAGE_TEACHERS',
  ];

  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        description: key.replace(/_/g, ' ').toLowerCase(),
        allowedTypes: ['SCHOOL', 'PRIVATE', 'COMMUNITY'],
      },
    });
  }

  // 2️⃣ Role → Permissions map
  const rolePermissions: Record<OrganizationRole, PermissionKey[]> = {
    STUDENT: ['VIEW_RESULTS'],
    TEACHER: [
      'CREATE_TEST',
      'EDIT_TEST',
      'DELETE_TEST',
      'VIEW_RESULTS',
      'MANAGE_STUDENTS',
    ],
    DIRECTOR: [
      'CREATE_TEST',
      'EDIT_TEST',
      'DELETE_TEST',
      'VIEW_RESULTS',
      'MANAGE_STUDENTS',
      'MANAGE_TEACHERS',
    ],
  };

  const allPermissions = await prisma.permission.findMany();

  // 3️⃣ Assign permissions to roles
  for (const role of Object.keys(rolePermissions) as OrganizationRole[]) {
    for (const permKey of rolePermissions[role]) {
      const perm = allPermissions.find((p) => p.key === permKey);
      if (!perm) continue;

      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          role,
          permissionId: perm.id,
          allowed: true,
        },
      });
    }
  }

  // 4️⃣ Subscription Plan
  await prisma.subscriptionPlan.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Free School Plan',
      target: 'SCHOOL' as PlanTarget,
      price: 0,
      currency: 'USD',
      billingCycle: 'monthly',
      maxUsers: 50,
      features: { tests: true, materials: true, reports: true },
    },
  });

  // 5️⃣ Superadmin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'superadmin@skillstorm.com' },
    update: {},
    create: {
      email: 'superadmin@skillstorm.com',
      passwordHash: hashedPassword,
      name: 'Super Admin',
      systemRole: 'SUPERADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Seed completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
