import { PrismaClient, $Enums } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

const DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'scenarios-progress-extension',
);

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const UNRELATED_EMAIL = 'student-progress-scope@scenar.test';
const PASSWORD = 'Scenar123!';

async function main(): Promise<void> {
  const org = await prisma.organization.findFirst({
    where: { name: 'ZŠ Scénář', deletedAt: null },
    select: { id: true },
  });
  if (!org) throw new Error('ZŠ Scénář not found after main scenario seed');

  const year = await prisma.academicYear.findFirst({
    where: { orgId: org.id, isCurrent: true, deletedAt: null },
    select: { id: true },
  });
  if (!year) throw new Error('Current scenario academic year not found');

  const teacher = await prisma.teacher.findFirst({
    where: {
      organizationId: org.id,
      deletedAt: null,
      membership: { user: { email: 'teacher@scenar.test' } },
    },
    select: { id: true },
  });
  if (!teacher) throw new Error('Scenario teacher not found');

  const subject = await prisma.subject.findFirst({
    where: {
      name: 'Matematika',
      deletedAt: null,
      orgSubjects: { some: { organizationId: org.id, isEnabled: true } },
    },
    select: { id: true },
  });
  if (!subject) throw new Error('Scenario Matematika subject not found');

  await prisma.teacherSubject.upsert({
    where: {
      teacherId_subjectId: {
        teacherId: teacher.id,
        subjectId: subject.id,
      },
    },
    update: {},
    create: { teacherId: teacher.id, subjectId: subject.id },
  });

  // This is an intentionally untaught class used as the progress/RBAC scope
  // oracle. Keep the technical purpose in ids/manifest, not in user-facing
  // labels that appear in whole-product screenshots.
  const untaughtClass =
    (await prisma.classSection.findFirst({
      where: {
        orgId: org.id,
        yearId: year.id,
        label: '9.C',
      },
      select: { id: true },
    })) ??
    (await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: year.id,
        grade: $Enums.SchoolGrade.GRADE_9,
        section: 'C',
        label: '9.C',
      },
      select: { id: true },
    }));

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let user = await prisma.user.findUnique({
    where: { email: UNRELATED_EMAIL },
    select: { id: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: UNRELATED_EMAIL,
        username: `progress_scope_${Date.now().toString(36)}`,
        name: 'Klára Veselá',
        passwordHash,
        status: $Enums.UserStatus.ACTIVE,
      },
      select: { id: true },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: 'Klára Veselá' },
    });
  }

  const membership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: { role: $Enums.OrganizationRole.STUDENT, deletedAt: null },
    create: {
      userId: user.id,
      organizationId: org.id,
      role: $Enums.OrganizationRole.STUDENT,
    },
    select: { id: true },
  });

  let student = await prisma.student.findFirst({
    where: { membershipId: membership.id, orgId: org.id },
    select: { id: true },
  });
  if (!student) {
    student = await prisma.student.create({
      data: { orgId: org.id, membershipId: membership.id },
      select: { id: true },
    });
  }

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, yearId: year.id },
    select: { id: true },
  });
  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: {
        classSectionId: untaughtClass.id,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        orgId: org.id,
        yearId: year.id,
        classSectionId: untaughtClass.id,
        studentId: student.id,
        status: $Enums.EnrollmentStatus.ACTIVE,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    'SCENARIO_PROGRESS_EXTENSION=' +
      JSON.stringify({
        teacherSubjectId: subject.id,
        untaughtClassId: untaughtClass.id,
        unrelatedStudentId: student.id,
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
