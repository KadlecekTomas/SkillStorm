import { PrismaClient, SystemRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingSuperadmin = await prisma.user.findFirst({
    where: { systemRole: SystemRole.SUPERADMIN },
  });
  if (existingSuperadmin) {
    console.log(
      `SUPERADMIN already exists (id=${existingSuperadmin.id}, email=${existingSuperadmin.email}).`,
    );
    return;
  }

  const email = (process.env.SUPERADMIN_EMAIL ?? '').trim();
  const plainPassword = process.env.SUPERADMIN_PASSWORD ?? '';
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!email || !plainPassword) {
    const message =
      'Missing SUPERADMIN_EMAIL and/or SUPERADMIN_PASSWORD for initial SUPERADMIN bootstrap.';

    if (nodeEnv === 'production') {
      throw new Error(
        `${message} In production, these environment variables are required when no SUPERADMIN exists.`,
      );
    }

    console.warn(`${message} NODE_ENV=${nodeEnv}. Skipping SUPERADMIN bootstrap.`);
    return;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: 'SkillStorm Superadmin',
      passwordHash,
      systemRole: SystemRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(
    `Superadmin user ready (id=${user.id}, email=${email}, systemRole=${user.systemRole}).`,
  );
}

main()
  .catch((error) => {
    console.error('Superadmin seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
