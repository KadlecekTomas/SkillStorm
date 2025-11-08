import {
  OrganizationRole,
  PrismaClient,
  SystemRole,
} from '@prisma/client';
import {
  ORG_IDS,
  PASSWORDS,
  USER_EMAILS,
} from './seed-constants';
import {
  hashPassword,
  logStep,
} from './seed-helpers';

type MembershipSeed = {
  email: string;
  organizationId: string;
  role: OrganizationRole;
  asTeacher?: boolean;
  asStudent?: boolean;
};

const MEMBERSHIPS: MembershipSeed[] = [
  {
    email: USER_EMAILS.director,
    organizationId: ORG_IDS.chodovicka,
    role: OrganizationRole.DIRECTOR,
  },
  {
    email: USER_EMAILS.teacher,
    organizationId: ORG_IDS.chodovicka,
    role: OrganizationRole.TEACHER,
    asTeacher: true,
  },
  {
    email: USER_EMAILS.student1,
    organizationId: ORG_IDS.chodovicka,
    role: OrganizationRole.STUDENT,
    asStudent: true,
  },
  {
    email: USER_EMAILS.student2,
    organizationId: ORG_IDS.chodovicka,
    role: OrganizationRole.STUDENT,
    asStudent: true,
  },
];

export async function seed(prisma: PrismaClient) {
  logStep('Users > system & demo accounts');

  const passwordHash = await hashPassword(PASSWORDS.default);

  const baseUsers = [
    {
      email: USER_EMAILS.superadmin,
      name: 'SkillStorm Superadmin',
      systemRole: SystemRole.SUPERADMIN,
    },
    {
      email: USER_EMAILS.director,
      name: 'Dagmar Černá',
    },
    {
      email: USER_EMAILS.teacher,
      name: 'Jan Učitel',
    },
    {
      email: USER_EMAILS.student1,
      name: 'Anna Žáková',
    },
    {
      email: USER_EMAILS.student2,
      name: 'Petr Žák',
    },
  ];

  let createdUsers = 0;

  for (const userSeed of baseUsers) {
    const existing = await prisma.user.findFirst({
      where: { email: userSeed.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: userSeed.name,
          systemRole: userSeed.systemRole ?? existing.systemRole,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: userSeed.email,
          name: userSeed.name,
          passwordHash,
          systemRole: userSeed.systemRole,
        },
      });
      createdUsers += 1;
    }
  }

  for (const membershipSeed of MEMBERSHIPS) {
    const user = await prisma.user.findFirstOrThrow({
      where: { email: membershipSeed.email },
      select: { id: true },
    });

    const membership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: membershipSeed.organizationId,
        },
      },
      update: { role: membershipSeed.role },
      create: {
        userId: user.id,
        organizationId: membershipSeed.organizationId,
        role: membershipSeed.role,
      },
    });

    // --- Teacher role ---
    if (membershipSeed.asTeacher) {
      try {
        await prisma.teacher.create({
          data: {
            membershipId: membership.id,
            organizationId: membership.organizationId,
          },
        });
        console.log(`✅ Users > Created teacher for ${membership.id}`);
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`⚠️ Users > Teacher for membership ${membership.id} already exists, skipping.`);
        } else {
          throw err;
        }
      }
    }

    // --- Student role ---
    if (membershipSeed.asStudent) {
      try {
        await prisma.student.create({
          data: {
            membershipId: membership.id,
            orgId: membership.organizationId,
          },
        });
        console.log(`✅ Users > Created student for ${membership.id}`);
      } catch (err: any) {
        if (err.code === 'P2002') {
          console.log(`⚠️ Users > Student for membership ${membership.id} already exists, skipping.`);
        } else {
          throw err;
        }
      }
    }
  }

  const [membershipCount, teacherCount, studentCount] = await Promise.all([
    prisma.membership.count({
      where: { organizationId: ORG_IDS.chodovicka },
    }),
    prisma.teacher.count(),
    prisma.student.count(),
  ]);

  console.log(
    `✅ Users summary: ${createdUsers} created, ${membershipCount} memberships, ${teacherCount} teachers, ${studentCount} students`,
  );
}
