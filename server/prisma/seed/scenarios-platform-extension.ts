import { PrismaClient, $Enums } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

const DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'scenarios-platform-extension',
);

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const SUPERADMIN_EMAIL = 'superadmin@scenar.test';
const SUPERADMIN_PASSWORD = 'Scenar123!';

async function main() {
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  const existing = await prisma.user.findUnique({
    where: { email: SUPERADMIN_EMAIL },
    select: { id: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: 'superadmin_scenar',
          name: 'Superadmin Scénář',
          passwordHash,
          systemRole: $Enums.SystemRole.SUPERADMIN,
          isPlatformAdmin: true,
          status: $Enums.UserStatus.ACTIVE,
          deletedAt: null,
          lastActiveMembershipId: null,
        },
        select: { id: true, email: true },
      })
    : await prisma.user.create({
        data: {
          email: SUPERADMIN_EMAIL,
          username: 'superadmin_scenar',
          name: 'Superadmin Scénář',
          passwordHash,
          systemRole: $Enums.SystemRole.SUPERADMIN,
          isPlatformAdmin: true,
          status: $Enums.UserStatus.ACTIVE,
        },
        select: { id: true, email: true },
      });

  // A platform account intentionally has no organization membership. This
  // proves the platform workspace does not accidentally depend on school
  // tenant context and that password login supports system-role-only users.
  const membershipCount = await prisma.membership.count({
    where: { userId: user.id, deletedAt: null },
  });
  if (membershipCount !== 0) {
    throw new Error('Scenario SUPERADMIN must not have an organization membership');
  }

  // eslint-disable-next-line no-console
  console.log(
    'SCENARIO_PLATFORM_EXTENSION=' +
      JSON.stringify({ superadmin: user.email, superadminUserId: user.id }),
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
