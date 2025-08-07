import { PrismaClient, OrganizationRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Spouštím seeding...\n');

  // 1️⃣ Superadmin
  const superadminEmail = 'admin@example.com';
  const existingAdmin = await prisma.user.findFirst({
    where: { email: superadminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: superadminEmail,
        name: 'Super Admin',
        passwordHash,
        systemRole: 'SUPERADMIN',
      },
    });
    console.log(`🛡️  SUPERADMIN vytvořen: ${superadminEmail} / admin123`);
  } else {
    console.log(`🛡️  SUPERADMIN už existuje: ${superadminEmail}`);
  }

  // 2️⃣ Organizace
  let organization = await prisma.organization.findFirst({
    where: { name: 'Test School' },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Test School',
        type: 'SCHOOL',
        city: 'Praha',
        address: 'Palackého 12',
        country: 'Česko',
      },
    });
    console.log(`🏫 Organizace vytvořena: ${organization.name}`);
  } else {
    console.log(`🏫 Organizace už existuje: ${organization.name}`);
  }

  // 3️⃣ Helper pro tvorbu uživatele s membership
  async function createUserWithMembership(
    email: string,
    name: string,
    password: string,
    role: OrganizationRole,
  ) {
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: { email, name, passwordHash },
      });
      console.log(`👤 Uživatel vytvořen: ${email} / ${password}`);
    } else {
      console.log(`👤 Uživatel už existuje: ${email}`);
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        organizationId: organization.id,
      },
    });

    if (!membership) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role,
        },
      });
      console.log(`✅ Membership přidán: ${email} → ${role}`);
    } else {
      console.log(`ℹ️  Membership už existuje: ${email}`);
    }
  }

  // 4️⃣ Vytvoř testovací uživatele
  await createUserWithMembership(
    'director@example.com',
    'Test Director',
    'director123',
    OrganizationRole.DIRECTOR,
  );
  await createUserWithMembership(
    'teacher@example.com',
    'Test Teacher',
    'teacher123',
    OrganizationRole.TEACHER,
  );
  await createUserWithMembership(
    'student@example.com',
    'Test Student',
    'student123',
    OrganizationRole.STUDENT,
  );

  console.log('\n✅ Seeding hotov!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
