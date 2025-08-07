import { PrismaClient, OrganizationRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1️⃣ Superadmin
  const existingAdmin = await prisma.user.findFirst({
    where: { systemRole: 'SUPERADMIN' },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Super Admin',
        passwordHash,
        systemRole: 'SUPERADMIN',
      },
    });
    console.log(' Superadmin vytvořen: admin@example.com / admin123');
  } else {
    console.log(' Superadmin už existuje, seed vynechán.');
  }

  // 2️⃣ Základní organizace pro test
  let organization = await prisma.organization.findFirst();
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Test School',
        type: 'SCHOOL',
      },
    });
    console.log('🏫 Organizace vytvořena:', organization.name);
  }

  // Helper pro tvorbu uživatele s membership
  async function createUserWithRole(
    email: string,
    name: string,
    password: string,
    role: OrganizationRole,
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.log(` ${role} už existuje: ${email}`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: organization!.id,
        role,
      },
    });

    console.log(`✅ ${role} vytvořen: ${email} / ${password}`);
  }

  // 3️⃣ Director
  await createUserWithRole(
    'director@example.com',
    'Test Director',
    'director123',
    OrganizationRole.DIRECTOR,
  );

  // 4️⃣ Teacher
  await createUserWithRole(
    'teacher@example.com',
    'Test Teacher',
    'teacher123',
    OrganizationRole.TEACHER,
  );

  // 5️⃣ Student
  await createUserWithRole(
    'student@example.com',
    'Test Student',
    'student123',
    OrganizationRole.STUDENT,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
