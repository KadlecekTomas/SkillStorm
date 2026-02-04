import { PrismaClient, SystemRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email =
    process.env.SUPERADMIN_EMAIL?.trim() || 'superadmin@example.com';
  const name =
    process.env.SUPERADMIN_NAME?.trim() || 'SkillStorm Superadmin';
  const plainPassword =
    process.env.SUPERADMIN_PASSWORD || 'change-me-123';

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      systemRole: SystemRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email,
      name,
      passwordHash,
      systemRole: SystemRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // Log pouze informuje, že SUPERADMIN existuje – žádná další doménová logika.
  console.log(
    `✅ Superadmin user ready (id=${user.id}, email=${email}, systemRole=${user.systemRole})`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Superadmin seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

