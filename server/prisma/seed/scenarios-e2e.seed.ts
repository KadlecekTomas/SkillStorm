/**
 * Deterministic seed for the client Playwright SCENARIO suite
 * (client/tests/scenarios). Builds exactly the world the scenarios need:
 *
 *   Org "ZŠ Scénář" (ACTIVE, current academic year)
 *     ├─ class 2.A (GRADE_2)  — 5 students   → young answering mode
 *     ├─ class 8.A (GRADE_8)  — 30 students  → old answering mode
 *     ├─ teacher  (of both classes)
 *     └─ director
 *   Org "ZŠ Druhá" (ACTIVE) — director + 1 student + 1 assignment (tenant tests)
 *
 * Ready-made assignments (blocks 2–5 need an open test to answer):
 *   - "Matematika 8.A"  → 8.A, 3 questions (TF, MC, FITB), 1 attempt, 10 min
 *   - "Poznávání 2.A"   → 2.A, 2 MC questions, tiles
 * Block 1 (backbone) does NOT use these — the teacher builds a fresh test
 * through the UI — so they can coexist without interfering.
 *
 * Runs ONLY against a *_test database (guard, no bypass). Idempotent:
 * wipes its own orgs by name first.
 */
import { PrismaClient, $Enums } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { assertTestDatabaseUrl } = require('../../scripts/db-safety');

const DATABASE_URL = assertTestDatabaseUrl(
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  'scenarios-e2e-seed',
);

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

export const SCENARIO_PASSWORD = 'Scenar123!';
export const SCENARIO_ACCOUNTS = {
  director: 'director@scenar.test',
  teacher: 'teacher@scenar.test',
  student2a: 'student-2a-01@scenar.test', // young
  student8a: 'student-8a-01@scenar.test', // old
  otherOrgDirector: 'director@druha.test',
  otherOrgStudent: 'student@druha.test',
};
// 8.A students used by the concurrency block (deterministic list)
export const STUDENTS_8A = Array.from(
  { length: 30 },
  (_, i) => `student-8a-${String(i + 1).padStart(2, '0')}@scenar.test`,
);
export const STUDENTS_2A = Array.from(
  { length: 5 },
  (_, i) => `student-2a-${String(i + 1).padStart(2, '0')}@scenar.test`,
);

async function wipe() {
  const orgs = await prisma.organization.findMany({
    where: { name: { in: ['ZŠ Scénář', 'ZŠ Druhá'] } },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);
  const users = await prisma.user.findMany({
    where: { email: { endsWith: '@scenar.test' } },
    select: { id: true },
  });
  const users2 = await prisma.user.findMany({
    where: { email: { endsWith: '@druha.test' } },
    select: { id: true },
  });
  const userIds = [...users, ...users2].map((u) => u.id);
  // FK order: responses/submissions/assignments → tests → enrollments →
  // students/teachers → class sections → memberships → years → orgs → users
  if (orgIds.length > 0) {
  await prisma.response.deleteMany({
    where: { submission: { organizationId: { in: orgIds } } },
  });
  await prisma.submission.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.assignment.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.question.deleteMany({ where: { test: { organizationId: { in: orgIds } } } });
  await prisma.test.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.enrollment.deleteMany({ where: { orgId: { in: orgIds } } });
  await prisma.student.deleteMany({ where: { orgId: { in: orgIds } } });
  await prisma.teacher.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.classSection.deleteMany({ where: { orgId: { in: orgIds } } });
  await prisma.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.academicYear.deleteMany({ where: { orgId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  if (userIds.length) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function createUserWithMembership(
  email: string,
  name: string,
  role: $Enums.OrganizationRole,
  organizationId: string,
  passwordHash: string,
) {
  const user = await prisma.user.create({
    data: {
      email,
      name,
      username: `${email.split('@')[0]}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
      passwordHash,
      memberships: { create: { organizationId, role } },
    },
    select: { id: true, memberships: { select: { id: true } } },
  });
  return { userId: user.id, membershipId: user.memberships[0]!.id };
}

async function main() {
  await wipe();
  const passwordHash = await bcrypt.hash(SCENARIO_PASSWORD, 10);

  // ── Main org ────────────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: { name: 'ZŠ Scénář', type: 'SCHOOL', status: 'ACTIVE' },
    select: { id: true },
  });
  const year = await prisma.academicYear.create({
    data: {
      orgId: org.id,
      label: 'Scénář 2025/2026',
      startsAt: new Date('2025-09-01'),
      endsAt: new Date('2027-08-31'),
      isCurrent: true,
    },
    select: { id: true },
  });

  await createUserWithMembership(
    SCENARIO_ACCOUNTS.director,
    'Ředitel Scénář',
    'DIRECTOR',
    org.id,
    passwordHash,
  );
  const teacherMember = await createUserWithMembership(
    SCENARIO_ACCOUNTS.teacher,
    'Učitel Scénář',
    'TEACHER',
    org.id,
    passwordHash,
  );
  const teacher = await prisma.teacher.create({
    data: { organizationId: org.id, membershipId: teacherMember.membershipId },
    select: { id: true },
  });

  const class2A = await prisma.classSection.create({
    data: {
      orgId: org.id,
      yearId: year.id,
      grade: $Enums.SchoolGrade.GRADE_2,
      section: 'A',
      label: '2.A',
      teacherId: teacher.id,
    },
    select: { id: true },
  });
  const class2AId = class2A.id;
  const class8A = await prisma.classSection.create({
    data: {
      orgId: org.id,
      yearId: year.id,
      grade: $Enums.SchoolGrade.GRADE_8,
      section: 'A',
      label: '8.A',
      teacherId: teacher.id,
    },
    select: { id: true },
  });
  const class8AId = class8A.id;

  const enrollStudent = async (
    email: string,
    name: string,
    classSectionId: string,
  ) => {
    const m = await createUserWithMembership(
      email,
      name,
      'STUDENT',
      org.id,
      passwordHash,
    );
    const student = await prisma.student.create({
      data: { orgId: org.id, membershipId: m.membershipId },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        orgId: org.id,
        yearId: year.id,
        classSectionId,
        studentId: student.id,
        status: 'ACTIVE',
      },
    });
    return m.membershipId;
  };

  const members8A: string[] = [];
  for (let i = 0; i < STUDENTS_8A.length; i++) {
    members8A.push(await enrollStudent(STUDENTS_8A[i]!, `Žák 8.A #${i + 1}`, class8AId));
  }
  for (let i = 0; i < STUDENTS_2A.length; i++) {
    await enrollStudent(STUDENTS_2A[i]!, `Žák 2.A #${i + 1}`, class2AId);
  }

  // ── Ready-made assignment for 8.A (old mode): TF + MC + FITB ─────────────
  const test8 = await prisma.test.create({
    data: {
      organizationId: org.id,
      title: 'Matematika 8.A',
      creatorId: teacherMember.membershipId,
      status: 'PUBLISHED',
      academicYearId: year.id,
      allowedGrades: [$Enums.SchoolGrade.GRADE_8],
    },
    select: { id: true },
  });
  await prisma.question.create({
    data: {
      testId: test8.id,
      text: 'Je 7 prvočíslo?',
      type: 'TRUE_FALSE',
      correctAnswer: 'true',
      order: 1,
    },
  });
  await prisma.question.create({
    data: {
      testId: test8.id,
      text: 'Kolik je 6 × 7?',
      type: 'MULTIPLE_CHOICE',
      correctAnswer: '42',
      order: 2,
      options: { create: [{ text: '42' }, { text: '36' }, { text: '48' }, { text: '13' }] },
    },
  });
  await prisma.question.create({
    data: {
      testId: test8.id,
      text: 'Odmocnina z 81 je ___',
      type: 'FILL_IN_THE_BLANK',
      correctAnswer: '9',
      order: 3,
    },
  });
  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: test8.id,
      targetType: 'CLASS',
      classSectionId: class8AId,
      openAt: new Date(Date.now() - 3_600_000),
      closeAt: new Date(Date.now() + 7 * 86_400_000),
      maxAttempts: 1,
      timeLimitSec: 600,
      shuffle: false,
      showExplain: 'NEVER',
      createdById: teacherMember.membershipId,
    },
  });

  // ── Ready-made assignment for 2.A (young mode): 2 MC (tiles) ─────────────
  const test2 = await prisma.test.create({
    data: {
      organizationId: org.id,
      title: 'Poznávání 2.A',
      creatorId: teacherMember.membershipId,
      status: 'PUBLISHED',
      academicYearId: year.id,
      allowedGrades: [$Enums.SchoolGrade.GRADE_2],
    },
    select: { id: true },
  });
  await prisma.question.create({
    data: {
      testId: test2.id,
      text: 'Které zvíře dělá „haf"?',
      type: 'MULTIPLE_CHOICE',
      correctAnswer: 'Pes',
      order: 1,
      options: { create: [{ text: 'Pes' }, { text: 'Kočka' }, { text: 'Kráva' }, { text: 'Ryba' }] },
    },
  });
  await prisma.question.create({
    data: {
      testId: test2.id,
      text: 'Kolik je 2 + 3?',
      type: 'MULTIPLE_CHOICE',
      correctAnswer: '5',
      order: 2,
      options: { create: [{ text: '5' }, { text: '4' }, { text: '6' }, { text: '23' }] },
    },
  });
  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      yearId: year.id,
      testId: test2.id,
      targetType: 'CLASS',
      classSectionId: class2AId,
      openAt: new Date(Date.now() - 3_600_000),
      closeAt: new Date(Date.now() + 7 * 86_400_000),
      maxAttempts: 1,
      timeLimitSec: 600,
      shuffle: false,
      showExplain: 'NEVER',
      createdById: teacherMember.membershipId,
    },
  });

  // ── Second org (tenant isolation) ───────────────────────────────────────
  const org2 = await prisma.organization.create({
    data: { name: 'ZŠ Druhá', type: 'SCHOOL', status: 'ACTIVE' },
    select: { id: true },
  });
  const year2 = await prisma.academicYear.create({
    data: {
      orgId: org2.id,
      label: 'Druhá 2025/2026',
      startsAt: new Date('2025-09-01'),
      endsAt: new Date('2027-08-31'),
      isCurrent: true,
    },
    select: { id: true },
  });
  const dir2 = await createUserWithMembership(
    SCENARIO_ACCOUNTS.otherOrgDirector,
    'Ředitel Druhá',
    'DIRECTOR',
    org2.id,
    passwordHash,
  );
  const class2 = await prisma.classSection.create({
    data: {
      orgId: org2.id,
      yearId: year2.id,
      grade: $Enums.SchoolGrade.GRADE_8,
      section: 'A',
      label: '8.A',
    },
    select: { id: true },
  });
  const s2 = await createUserWithMembership(
    SCENARIO_ACCOUNTS.otherOrgStudent,
    'Žák Druhá',
    'STUDENT',
    org2.id,
    passwordHash,
  );
  const student2 = await prisma.student.create({
    data: { orgId: org2.id, membershipId: s2.membershipId },
    select: { id: true },
  });
  await prisma.enrollment.create({
    data: {
      orgId: org2.id,
      yearId: year2.id,
      classSectionId: class2.id,
      studentId: student2.id,
      status: 'ACTIVE',
    },
  });
  const foreignTest = await prisma.test.create({
    data: {
      organizationId: org2.id,
      title: 'Cizí test (org Druhá)',
      creatorId: dir2.membershipId,
      status: 'PUBLISHED',
      academicYearId: year2.id,
      allowedGrades: [$Enums.SchoolGrade.GRADE_8],
    },
    select: { id: true },
  });
  await prisma.question.create({
    data: {
      testId: foreignTest.id,
      text: 'Tajná otázka org Druhá',
      type: 'TRUE_FALSE',
      correctAnswer: 'true',
      order: 1,
    },
  });
  const foreignAssignment = await prisma.assignment.create({
    data: {
      organizationId: org2.id,
      yearId: year2.id,
      testId: foreignTest.id,
      targetType: 'CLASS',
      classSectionId: class2.id,
      openAt: new Date(Date.now() - 3_600_000),
      closeAt: new Date(Date.now() + 7 * 86_400_000),
      maxAttempts: 1,
      shuffle: false,
      showExplain: 'NEVER',
      createdById: dir2.membershipId,
    },
    select: { id: true },
  });

  // Manifest consumed by the Playwright global-setup → written to disk.
  const manifest = {
    password: SCENARIO_PASSWORD,
    accounts: SCENARIO_ACCOUNTS,
    students8A: STUDENTS_8A,
    students2A: STUDENTS_2A,
    orgId: org.id,
    class8AId: class8AId,
    class2AId: class2AId,
    foreignOrgId: org2.id,
    foreignTestId: foreignTest.id,
    foreignAssignmentId: foreignAssignment.id,
  };
  // eslint-disable-next-line no-console
  console.log('SCENARIO_MANIFEST=' + JSON.stringify(manifest));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
