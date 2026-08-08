import { PrismaClient, $Enums } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

const DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'scenarios-parent-extension',
);

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const PARENT_EMAIL = 'parent@scenar.test';
const PARENT_PASSWORD = 'Scenar123!';
const CHILD_EMAIL = 'student-8a-01@scenar.test';

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: 'ZŠ Scénář', deletedAt: null },
    select: { id: true },
  });
  if (!org) throw new Error('ZŠ Scénář not found after main scenario seed');

  const child = await prisma.student.findFirst({
    where: {
      orgId: org.id,
      deletedAt: null,
      membership: {
        deletedAt: null,
        user: { email: CHILD_EMAIL, deletedAt: null },
      },
    },
    select: { id: true },
  });
  if (!child) throw new Error(`Scenario child ${CHILD_EMAIL} not found`);

  const passwordHash = await bcrypt.hash(PARENT_PASSWORD, 10);
  const existingUser = await prisma.user.findUnique({
    where: { email: PARENT_EMAIL },
    select: { id: true },
  });

  let userId: string;
  let membershipId: string;
  if (existingUser) {
    userId = existingUser.id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Rodič Scénář',
        passwordHash,
        status: $Enums.UserStatus.ACTIVE,
        deletedAt: null,
      },
    });
    const membership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId: org.id,
        },
      },
      update: { role: $Enums.OrganizationRole.PARENT, deletedAt: null },
      create: {
        userId,
        organizationId: org.id,
        role: $Enums.OrganizationRole.PARENT,
      },
      select: { id: true },
    });
    membershipId = membership.id;
  } else {
    const user = await prisma.user.create({
      data: {
        email: PARENT_EMAIL,
        username: `parent_scenar_${Date.now().toString(36)}`,
        passwordHash,
        name: 'Rodič Scénář',
        status: $Enums.UserStatus.ACTIVE,
        memberships: {
          create: {
            organizationId: org.id,
            role: $Enums.OrganizationRole.PARENT,
          },
        },
      },
      select: { id: true, memberships: { select: { id: true } } },
    });
    userId = user.id;
    membershipId = user.memberships[0]!.id;
  }

  const existingRelation = await prisma.guardianStudentRelation.findFirst({
    where: {
      guardianMembershipId: membershipId,
      studentId: child.id,
      organizationId: org.id,
      status: { in: [$Enums.GuardianRelationStatus.PENDING, $Enums.GuardianRelationStatus.VERIFIED] },
    },
    select: { id: true },
  });

  const relation = existingRelation
    ? await prisma.guardianStudentRelation.update({
        where: { id: existingRelation.id },
        data: {
          status: $Enums.GuardianRelationStatus.VERIFIED,
          type: $Enums.GuardianRelationType.PARENT,
          permissions: [
            $Enums.GuardianPermissionKey.VIEW_RESULTS,
            $Enums.GuardianPermissionKey.VIEW_ASSIGNMENTS,
            $Enums.GuardianPermissionKey.START_PRACTICE,
            $Enums.GuardianPermissionKey.START_HOMEWORK,
            $Enums.GuardianPermissionKey.START_TEST,
          ],
          verifiedAt: new Date(),
          disputedAt: null,
          revokedAt: null,
        },
        select: { id: true },
      })
    : await prisma.guardianStudentRelation.create({
        data: {
          guardianMembershipId: membershipId,
          studentId: child.id,
          organizationId: org.id,
          type: $Enums.GuardianRelationType.PARENT,
          status: $Enums.GuardianRelationStatus.VERIFIED,
          permissions: [
            $Enums.GuardianPermissionKey.VIEW_RESULTS,
            $Enums.GuardianPermissionKey.VIEW_ASSIGNMENTS,
            $Enums.GuardianPermissionKey.START_PRACTICE,
            $Enums.GuardianPermissionKey.START_HOMEWORK,
            $Enums.GuardianPermissionKey.START_TEST,
          ],
          verifiedAt: new Date(),
        },
        select: { id: true },
      });

  // eslint-disable-next-line no-console
  console.log(
    'SCENARIO_PARENT_EXTENSION=' +
      JSON.stringify({
        parent: PARENT_EMAIL,
        parentMembershipId: membershipId,
        parentUserId: userId,
        parentRelationId: relation.id,
      }),
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
