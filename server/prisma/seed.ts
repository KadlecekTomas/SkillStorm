import { PrismaClient, SystemRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { runDemoSeed } from './demo-seed';

/**
 * Environment variables are used ONLY for initial bootstrap.
 * Authorization is ALWAYS driven by database state.
 *
 * Mental model:
 * - ENV = startovací sirka (jen pro první SUPERADMIN účet)
 * - DB  = jediná pravda o rolích a oprávněních
 *
 * Jakmile existuje aspoň jeden User se systemRole = SUPERADMIN,
 * tento seed skript už z .env nic nečte a pouze skončí.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1) Pokud už SUPERADMIN existuje, .env je "mrtvé" – nic nebootstrapujeme.
  const existingSuperadmin = await prisma.user.findFirst({
    where: { systemRole: SystemRole.SUPERADMIN },
  });
  if (existingSuperadmin) {
    console.log(
      `✅ SUPERADMIN already exists (id=${existingSuperadmin.id}, email=${existingSuperadmin.email}). ENV is ignored.`,
    );
    return;
  }

  // 2) SUPERADMIN neexistuje → ENV se použije POUZE pro první bootstrap.
  const email = process.env.SUPERADMIN_EMAIL?.trim() ?? '';
  const plainPassword = process.env.SUPERADMIN_PASSWORD ?? '';

  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (!email || !plainPassword) {
    const message =
      'Missing SUPERADMIN_EMAIL and/or SUPERADMIN_PASSWORD for initial SUPERADMIN bootstrap.';

    if (nodeEnv === 'production') {
      // Prod: bez těchto proměnných se bootstrap prvního superadmina nesmí provést.
      throw new Error(
        `${message} In production, these environment variables are REQUIRED when no SUPERADMIN exists.`,
      );
    }

    // Non-prod: pouze warning, aplikace / seed se nezastaví.
    // (typický scénář: lokální vývoj, kde si superadmina vytvoříš ručně.)
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️ ${message} NODE_ENV=${nodeEnv}. Skipping SUPERADMIN bootstrap in non-production environment.`,
    );
    return;
  }

  const name = 'SkillStorm Superadmin';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  // SUPERADMIN není navázán na žádnou organizaci, nemá membership,
  // není součást RBAC pro školy – je to čistě systémová role.
  const user = await prisma.user.create({
    data: {
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

/** E2E onboarding: user without org for Playwright onboarding-create-org.spec (only when E2E_SEED_ONBOARDING_USER=1). */
async function ensureE2EOnboardingUser(prisma: PrismaClient): Promise<void> {
  const env = process.env.E2E_SEED_ONBOARDING_USER;
  if (env !== '1' && env !== 'true') return;

  const email = process.env.E2E_ONBOARDING_EMAIL?.trim() || 'onboarding@skillstorm.local';
  const plainPassword = process.env.E2E_ONBOARDING_PASSWORD || 'Password123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✅ E2E onboarding user already exists (${email}).`);
    return;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  await prisma.user.create({
    data: {
      email,
      name: 'E2E Onboarding User',
      passwordHash,
      status: UserStatus.ACTIVE,
      // no systemRole, no memberships → INDIVIDUAL-like, can go through create-org flow
    },
  });
  console.log(`✅ E2E onboarding user created (${email}).`);
}

main()
  .then(async () => {
    if (process.env.DEMO_SEED === '1') {
      await runDemoSeed();
    }
    await ensureE2EOnboardingUser(prisma);
  })
  .catch((error) => {
    console.error('❌ Superadmin seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
