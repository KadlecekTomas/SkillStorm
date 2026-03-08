const { PrismaClient, SystemRole, UserStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { runDemoSeed } = require('./demo-seed');

const prisma = new PrismaClient();

function isProduction() {
  const nodeEnv = process.env.NODE_ENV ?? '';
  const appEnv = process.env.APP_ENV ?? '';
  return nodeEnv === 'production' || appEnv === 'production';
}

function printDemoBanner(env, email, passwordSource) {
  console.log('\n--- DEMO SEED BANNER (copy-paste) ---');
  console.log('NODE_ENV=' + env);
  console.log('Created user: ' + email + ' | (system) | SUPERADMIN');
  console.log('Password: ' + passwordSource);
  console.log('--- END DEMO BANNER ---\n');
}

async function seedSuperadmin() {
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

    if (isProduction()) {
      throw new Error(
        `${message} In production, these environment variables are required when no SUPERADMIN exists. Do not use demo password.`,
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

  printDemoBanner(nodeEnv, email, '(from SUPERADMIN_PASSWORD env)');
}

async function main() {
  await seedSuperadmin();

  if (process.env.DEMO_SEED === '1') {
    await runDemoSeed();
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
