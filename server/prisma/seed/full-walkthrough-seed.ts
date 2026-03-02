/**
 * Full system walkthrough seed – produkčně realistická data pro celý web.
 * Spuštění: npm run seed:full (nebo ts-node prisma/seed/full-walkthrough-seed.ts)
 *
 * Idempotentní: používá findFirst + create nebo upsert podle kontextu.
 * Žádné změny schématu, pouze existující Prisma modely.
 *
 * Scénáře pokryté seedem:
 * - Student A: 1 pokus, ~45 % (jeden test odevzdaný)
 * - Student B: 2 pokusy, 40 % → 75 % (MiniProgressBlock ukáže + rozdíl)
 * - Student C: 3 pokusy, 30 % → 50 % → 65 % (postupný růst, timeline více položek)
 * - Student D: žádné odevzdání (prázdná timeline, empty state)
 * - Student E: 2 pokusy, 80 % → 60 % (MiniProgressBlock ukáže − rozdíl)
 * - Student F: pouze 1 test odevzdaný, ostatní ne (částečná aktivita)
 * - Třída 8.C: bez přiřazených testů (negativní scénář – třída bez testů)
 * - GET /analytics/student-timeline: více položek pro jedno assignmentId, správné pořadí
 */
import {
  EnrollmentStatus,
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
  PublishStatus,
  PrismaClient,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
  SystemRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123!';

// --- Konstanty pro identifikaci seed dat (idempotence) ---
const ORG_NAMES = {
  ZS: 'Základní škola Demo',
  GYM: 'Gymnázium Demo',
  KOMUNITA: 'Komunitní vzdělávací centrum',
} as const;

const YEAR_LABEL = '2024/2025';
const STARTS_AT = new Date('2024-09-01T00:00:00.000Z');
const ENDS_AT = new Date('2025-08-31T23:59:59.999Z');

function logStep(msg: string) {
  console.log(`🌱 ${msg}`);
}

function logDone(msg: string) {
  console.log(`✅ ${msg}`);
}

async function hash(plain: string) {
  return bcrypt.hash(plain, 10);
}

// --- 0) PLATFORM BOOTSTRAP USERS (systemRole only, no memberships) ---
async function ensurePlatformBootstrapUsers() {
  console.log('🌍 Platform bootstrap');
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development') {
    console.warn('⚠️ Running platform bootstrap outside development');
  }

  const passwordHash = await hash(DEMO_PASSWORD);
  const platformUsers: Array<{
    email: string;
    name: string;
    role: SystemRole;
    readyLabel: string;
  }> = [
    {
      email: 'superadmin@platform.local',
      name: 'Platform Superadmin',
      role: SystemRole.SUPERADMIN,
      readyLabel: 'SUPERADMIN',
    },
    {
      email: 'devops@platform.local',
      name: 'Platform DevOps',
      role: SystemRole.DEVOPS,
      readyLabel: 'DEVOPS',
    },
    {
      email: 'support@platform.local',
      name: 'Platform Support',
      role: SystemRole.SUPPORT,
      readyLabel: 'SUPPORT',
    },
  ];

  for (const entry of platformUsers) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      create: {
        email: entry.email,
        name: entry.name,
        passwordHash,
        systemRole: entry.role,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      update: {
        name: entry.name,
        systemRole: entry.role,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });

    const hasDemoPassword = await bcrypt.compare(
      DEMO_PASSWORD,
      user.passwordHash,
    );
    if (!hasDemoPassword) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    }

    // Platform users must never be tenant-bound.
    await prisma.membership.deleteMany({ where: { userId: user.id } });

    console.log(`✅ ${entry.readyLabel} ready`);
  }
}

function printDemoBanner(
  users: Array<{ email: string; org: string; role: string }>,
  password: string,
) {
  const env = process.env.NODE_ENV ?? 'development';
  console.log('\n--- DEMO SEED BANNER (copy-paste) ---');
  console.log('NODE_ENV=' + env);
  console.log('Shared password (all demo users): ' + password);
  console.log('Demo users (email | org | role):');
  for (const u of users) {
    console.log(`  ${u.email} | ${u.org} | ${u.role}`);
  }
  console.log('--- END DEMO BANNER ---\n');
}

// --- 1) ORGANIZACE (multi-tenant) ---
async function createOrganizations() {
  logStep('Organizations: creating 3 tenants');
  const orgs: { id: string; name: string; type: OrganizationType }[] = [];

  const configs: Array<{ name: string; type: OrganizationType }> = [
    { name: ORG_NAMES.ZS, type: OrganizationType.SCHOOL },
    { name: ORG_NAMES.GYM, type: OrganizationType.SCHOOL },
    { name: ORG_NAMES.KOMUNITA, type: OrganizationType.COMMUNITY },
  ];

  for (const { name, type } of configs) {
    const existing = await prisma.organization.findFirst({
      where: { name, deletedAt: null },
    });
    if (existing) {
      await prisma.organization.update({
        where: { id: existing.id },
        data: { status: OrganizationStatus.ACTIVE, type },
      });
      orgs.push({ id: existing.id, name, type });
    } else {
      const org = await prisma.organization.create({
        data: {
          name,
          type,
          status: OrganizationStatus.ACTIVE,
        },
      });
      orgs.push({ id: org.id, name, type });
    }
  }
  logDone(`Organizations: ${orgs.length}`);
  return orgs;
}

// --- 2) ŠKOLNÍ ROKY (1 aktivní na org) ---
async function createAcademicYears(orgs: { id: string }[]) {
  logStep('Academic years: 1 active per org (2024/2025)');
  const years: { id: string; orgId: string }[] = [];

  for (const org of orgs) {
    await prisma.academicYear.updateMany({
      where: { orgId: org.id, isCurrent: true },
      data: { isCurrent: false },
    });
    const existing = await prisma.academicYear.findFirst({
      where: { orgId: org.id, label: YEAR_LABEL },
    });
    if (existing) {
      await prisma.academicYear.update({
        where: { id: existing.id },
        data: { startsAt: STARTS_AT, endsAt: ENDS_AT, isCurrent: true },
      });
      years.push({ id: existing.id, orgId: org.id });
    } else {
      const y = await prisma.academicYear.create({
        data: {
          orgId: org.id,
          label: YEAR_LABEL,
          startsAt: STARTS_AT,
          endsAt: ENDS_AT,
          isCurrent: true,
        },
      });
      years.push({ id: y.id, orgId: org.id });
    }
  }
  logDone(`Academic years: ${years.length}`);
  return years;
}

// --- 3) TŘÍDY (min. 2 na org) ---
async function createClassSections(
  orgs: { id: string }[],
  years: { id: string; orgId: string }[],
) {
  logStep('Class sections: at least 2 per org');
  const sections: {
    id: string;
    orgId: string;
    yearId: string;
    label: string;
  }[] = [];
  const gradeSectionPairs: [SchoolGrade, string, string][] = [
    [SchoolGrade.GRADE_6, 'A', '6.A'],
    [SchoolGrade.GRADE_7, 'B', '7.B'],
    [SchoolGrade.GRADE_8, 'C', '8.C'],
  ];

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    if (!org) continue;
    const year = years.find((y) => y.orgId === org.id);
    if (!year) continue;
    for (let j = 0; j < 3; j++) {
      const pair = gradeSectionPairs[j];
      if (!pair) continue;
      const [grade, section, label] = pair;
      const existing = await prisma.classSection.findFirst({
        where: {
          orgId: org.id,
          yearId: year.id,
          grade,
          section,
        },
      });
      if (existing) {
        await prisma.classSection.update({
          where: { id: existing.id },
          data: { label },
        });
        sections.push({
          id: existing.id,
          orgId: org.id,
          yearId: year.id,
          label,
        });
      } else {
        const cs = await prisma.classSection.create({
          data: {
            orgId: org.id,
            yearId: year.id,
            grade,
            section,
            label,
          },
        });
        sections.push({
          id: cs.id,
          orgId: org.id,
          yearId: year.id,
          label,
        });
      }
    }
  }
  logDone(`Class sections: ${sections.length}`);
  return sections;
}

// --- 4) UŽIVATELÉ + ROLE (director, 2 učitelé, 6 studentů na org) ---
type OrgUserIds = {
  orgId: string;
  directorMembershipId: string;
  teacherMembershipIds: string[];
  studentMembershipIds: string[];
  creatorMembershipId: string;
};

async function createUsersAndMembers(
  orgs: { id: string; name: string }[],
): Promise<OrgUserIds[]> {
  logStep('Users + memberships: director, 2 teachers, 6 students per org');
  const passwordHash = await hash(DEMO_PASSWORD);
  const result: OrgUserIds[] = [];

  for (let o = 0; o < orgs.length; o++) {
    const org = orgs[o];
    if (!org) continue;
    const suffix = o === 0 ? 'zs' : o === 1 ? 'gym' : 'kom';
    const emails = {
      director: `director@${suffix}.demo.local`,
      teacher1: `teacher1@${suffix}.demo.local`,
      teacher2: `teacher2@${suffix}.demo.local`,
      studentA: `student-a@${suffix}.demo.local`,
      studentB: `student-b@${suffix}.demo.local`,
      studentC: `student-c@${suffix}.demo.local`,
      studentD: `student-d@${suffix}.demo.local`,
      studentE: `student-e@${suffix}.demo.local`,
      studentF: `student-f@${suffix}.demo.local`,
    };

    const userIds: Record<string, string> = {};
    for (const [key, email] of Object.entries(emails)) {
      const existing = await prisma.user.findUnique({ where: { email } });
      const name =
        key === 'director'
          ? `Ředitel ${org.name}`
          : key.startsWith('teacher')
            ? `Učitel ${key.slice(-1)} ${org.name}`
            : `Žák ${key.replace('student', '')} ${org.name}`;
      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name },
        });
        userIds[key] = existing.id;
      } else {
        const u = await prisma.user.create({
          data: { email, name, passwordHash },
        });
        userIds[key] = u.id;
      }
    }

    const membershipIds: Record<string, string> = {};
    const roles: Array<{ key: string; role: OrganizationRole }> = [
      { key: 'director', role: OrganizationRole.DIRECTOR },
      { key: 'teacher1', role: OrganizationRole.TEACHER },
      { key: 'teacher2', role: OrganizationRole.TEACHER },
      { key: 'studentA', role: OrganizationRole.STUDENT },
      { key: 'studentB', role: OrganizationRole.STUDENT },
      { key: 'studentC', role: OrganizationRole.STUDENT },
      { key: 'studentD', role: OrganizationRole.STUDENT },
      { key: 'studentE', role: OrganizationRole.STUDENT },
      { key: 'studentF', role: OrganizationRole.STUDENT },
    ];

    for (const { key, role } of roles) {
      const userId = userIds[key];
      if (!userId) throw new Error(`Seed: missing userId for ${key}`);
      const existing = await prisma.membership.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: org.id },
        },
      });
      if (existing) {
        await prisma.membership.update({
          where: { id: existing.id },
          data: { role, deletedAt: null },
        });
        membershipIds[key] = existing.id;
      } else {
        const m = await prisma.membership.create({
          data: { userId, organizationId: org.id, role },
        });
        membershipIds[key] = m.id;
      }
    }

    const dirId = membershipIds.director!;
    const t1Id = membershipIds.teacher1!;
    const t2Id = membershipIds.teacher2!;
    result.push({
      orgId: org.id,
      directorMembershipId: dirId,
      teacherMembershipIds: [t1Id, t2Id],
      studentMembershipIds: [
        membershipIds.studentA!,
        membershipIds.studentB!,
        membershipIds.studentC!,
        membershipIds.studentD!,
        membershipIds.studentE!,
        membershipIds.studentF!,
      ],
      creatorMembershipId: t1Id,
    });
  }
  logDone(`Users/members: ${result.length} orgs`);
  return result;
}

// --- Učitelé (Teacher record) ---
async function createTeachers(orgUsers: OrgUserIds[]) {
  logStep('Teachers: Teacher record per teacher membership');
  for (const org of orgUsers) {
    for (const membershipId of org.teacherMembershipIds) {
      if (!membershipId) continue;
      const existing = await prisma.teacher.findUnique({
        where: { membershipId },
      });
      if (!existing) {
        await prisma.teacher.create({
          data: { membershipId, organizationId: org.orgId },
        });
      }
    }
  }
  logDone('Teachers ready');
}

// --- Homeroom: přiřadit učitele k 6.A a 7.B (pro teacher workflow / analytics) ---
async function setHomeroomTeachers(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; label: string }[],
) {
  logStep('Homeroom: assigning teacher to 6.A and 7.B');
  for (const org of orgUsers) {
    const firstTeacherMembershipId = org.teacherMembershipIds[0];
    if (!firstTeacherMembershipId) continue;
    const teacher = await prisma.teacher.findFirst({
      where: {
        membershipId: firstTeacherMembershipId,
        organizationId: org.orgId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!teacher) continue;
    const orgSections = sections.filter(
      (s) => s.orgId === org.orgId && (s.label === '6.A' || s.label === '7.B'),
    );
    for (const sec of orgSections) {
      await prisma.classSection.update({
        where: { id: sec.id },
        data: { teacherId: teacher.id },
      });
    }
  }
  logDone('Homeroom set');
}

// --- Studenti + Enrollment (A,B,C v 6.A; D,E,F v 7.B; 8.C prázdná pro „třída bez testů“) ---
async function createStudentsAndEnrollments(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; yearId: string; label: string }[],
) {
  logStep('Students + enrollments: 6 students per org, distributed in classes');
  for (const org of orgUsers) {
    const orgSections = sections
      .filter((s) => s.orgId === org.orgId)
      .sort((a, b) => a.label.localeCompare(b.label));
    const class6A = orgSections.find((s) => s.label === '6.A');
    const class7B = orgSections.find((s) => s.label === '7.B');
    const class8C = orgSections.find((s) => s.label === '8.C');
    if (!class6A || !class7B) continue;

    const studentKeys = [
      'studentA',
      'studentB',
      'studentC',
      'studentD',
      'studentE',
      'studentF',
    ];
    const classByKey: Record<string, typeof class6A> = {
      studentA: class6A,
      studentB: class6A,
      studentC: class6A,
      studentD: class7B,
      studentE: class7B,
      studentF: class7B,
    };

    for (const key of studentKeys) {
      const membershipId = org.studentMembershipIds[studentKeys.indexOf(key)];
      const classSection = classByKey[key];
      if (!classSection || !membershipId) continue;

      let student = await prisma.student.findUnique({
        where: { membershipId },
      });
      const existingEnrollment = student
        ? await prisma.enrollment.findFirst({
            where: { studentId: student.id, yearId: classSection.yearId },
          })
        : null;

      if (existingEnrollment) {
        await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            classSectionId: classSection.id,
            orgId: org.orgId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      } else if (!student) {
        await prisma.$transaction(async (tx) => {
          student = await tx.student.create({
            data: { membershipId, orgId: org.orgId },
          });
          await tx.enrollment.create({
            data: {
              studentId: student!.id,
              classSectionId: classSection.id,
              yearId: classSection.yearId,
              orgId: org.orgId,
              status: EnrollmentStatus.ACTIVE,
            },
          });
        });
        student = await prisma.student.findUnique({
          where: { membershipId },
        });
      } else {
        await prisma.enrollment.create({
          data: {
            studentId: student.id,
            classSectionId: classSection.id,
            yearId: classSection.yearId,
            orgId: org.orgId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }
  }
  logDone('Students + enrollments ready');
}

// --- 4b) CATALOG SUBJECTS + ORG SUBJECTS (Subject model) ---
/**
 * Upserts all CatalogSubjects, then provisions one Subject per catalog entry per org
 * (mirrors OrganizationsService.provisionDefaultSubjects — idempotent upsert).
 * Returns a nested map: orgId → catalogCode → subjectId
 */
async function ensureCatalogAndSubjects(
  orgs: OrgWithName[],
): Promise<Map<string, Map<string, string>>> {
  logStep('CatalogSubjects + org Subjects');

  const catalogDefs = [
    { code: 'MAT', name: 'Matematika' },
    { code: 'CZJ', name: 'Český jazyk' },
    { code: 'FYZ', name: 'Fyzika' },
    { code: 'DEJ', name: 'Dějepis' },
    { code: 'INF', name: 'Informatika' },
    { code: 'ENG', name: 'Angličtina' },
    { code: 'ECO', name: 'Finanční gramotnost' },
  ];

  // Upsert all catalog entries
  const catalogMap = new Map<string, string>(); // code → id
  for (const def of catalogDefs) {
    const cat = await prisma.catalogSubject.upsert({
      where: { code: def.code },
      update: {},
      create: def,
    });
    catalogMap.set(def.code, cat.id);
  }

  // Provision all catalog subjects for every org (all codes, not a subset)
  const result = new Map<string, Map<string, string>>();

  for (const org of orgs) {
    const orgMap = new Map<string, string>();

    for (const def of catalogDefs) {
      const catalogId = catalogMap.get(def.code)!;

      const subject = await prisma.subject.upsert({
        where: {
          organizationId_catalogSubjectId: {
            organizationId: org.id,
            catalogSubjectId: catalogId,
          },
        },
        update: {},
        create: { organizationId: org.id, catalogSubjectId: catalogId, name: def.name },
      });

      // Ensure at least one SubjectLevel
      const hasLevel = await prisma.subjectLevel.findFirst({ where: { subjectId: subject.id } });
      if (!hasLevel) {
        await prisma.subjectLevel.create({
          data: { subjectId: subject.id, grade: SchoolGrade.GRADE_7, order: 1 },
        });
      }

      orgMap.set(def.code, subject.id);
    }
    result.set(org.id, orgMap);
  }

  logDone(`Catalog subjects + org subjects ready`);
  return result;
}

// Title → catalog code mapping
const TITLE_TO_CODE: Record<string, string> = {
  'Matematika – zlomky': 'MAT',
  'Český jazyk – pravopis': 'CZJ',
  'Fyzika – síly': 'FYZ',
  'Matematika – funkce': 'MAT',
  'Český jazyk – literatura': 'CZJ',
  'Dějepis – 20. století': 'DEJ',
  'Základy programování': 'INF',
  'Angličtina – B1': 'ENG',
  'Finanční gramotnost': 'ECO',
};

// --- 5) TESTY (min. 3 na org, PUBLISHED, scoreable) ---
type OrgWithName = { id: string; name: string };
async function createTests(
  orgs: OrgWithName[],
  orgUsers: OrgUserIds[],
  years: { id: string; orgId: string }[],
  subjectsByOrg: Map<string, Map<string, string>>,
) {
  logStep('Tests: min 3 per org, realistic titles, scoreable');
  const testTitlesByOrg: Record<string, string[]> = {
    [ORG_NAMES.ZS]: [
      'Matematika – zlomky',
      'Český jazyk – pravopis',
      'Fyzika – síly',
    ],
    [ORG_NAMES.GYM]: [
      'Matematika – funkce',
      'Český jazyk – literatura',
      'Dějepis – 20. století',
    ],
    [ORG_NAMES.KOMUNITA]: [
      'Základy programování',
      'Angličtina – B1',
      'Finanční gramotnost',
    ],
  };

  const allTests: {
    id: string;
    orgId: string;
    testId: string;
    questionIds: string[];
  }[] = [];

  for (const org of orgs) {
    const titles = testTitlesByOrg[org.name] ?? testTitlesByOrg[ORG_NAMES.ZS];
    if (!titles) continue;
    const creatorId = orgUsers.find(
      (u) => u.orgId === org.id,
    )?.creatorMembershipId;
    if (!creatorId) continue;

    const orgYearId = years.find((y) => y.orgId === org.id)?.id ?? null;
    const orgSubjects = subjectsByOrg.get(org.id) ?? new Map<string, string>();

    for (const title of titles) {
      const code = TITLE_TO_CODE[title];
      const subjectId = code ? (orgSubjects.get(code) ?? null) : null;

      let test = await prisma.test.findFirst({
        where: { organizationId: org.id, title, deletedAt: null },
      });
      if (!test) {
        test = await prisma.test.create({
          data: {
            organizationId: org.id,
            title,
            description: `Test: ${title}`,
            status: PublishStatus.PUBLISHED,
            creatorId,
            ...(subjectId && { subjectId }),
            ...(orgYearId && { academicYearId: orgYearId }),
          },
        });
      } else {
        await prisma.test.update({
          where: { id: test.id },
          data: {
            status: PublishStatus.PUBLISHED,
            creatorId,
            ...(subjectId && { subjectId }),
            ...(orgYearId && { academicYearId: orgYearId }),
          },
        });
      }

      let questions = await prisma.question.findMany({
        where: { testId: test.id },
        select: { id: true },
        orderBy: { order: 'asc' },
      });
      if (questions.length === 0) {
        const q1 = await prisma.question.create({
          data: {
            testId: test.id,
            text: 'Otázka 1 (pravda/nepravda)',
            type: QuestionType.TRUE_FALSE,
            order: 1,
            score: 1,
            correctAnswer: 'true',
          },
        });
        const q2 = await prisma.question.create({
          data: {
            testId: test.id,
            text: 'Otázka 2 (doplň)',
            type: QuestionType.FILL_IN_THE_BLANK,
            order: 2,
            score: 1,
            correctAnswer: 'správně',
          },
        });
        const q3 = await prisma.question.create({
          data: {
            testId: test.id,
            text: 'Otázka 3 (výběr)',
            type: QuestionType.MULTIPLE_CHOICE,
            order: 3,
            score: 1,
            correctAnswer: 'A',
            correctAnswers: ['A'],
          },
        });
        await prisma.option.createMany({
          data: [
            { questionId: q3.id, text: 'A' },
            { questionId: q3.id, text: 'B' },
            { questionId: q3.id, text: 'C' },
          ],
        });
        questions = [{ id: q1.id }, { id: q2.id }, { id: q3.id }];
      }
      allTests.push({
        id: test.id,
        orgId: org.id,
        testId: test.id,
        questionIds: questions.map((q) => q.id),
      });
    }
  }
  logDone(`Tests: ${allTests.length}`);
  return allTests;
}

// --- 6) ASSIGNMENTS (openAt/closeAt v minulosti, maxAttempts 1 nebo 2–3) ---
async function createAssignments(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; yearId: string; label: string }[],
  tests: { id: string; orgId: string; testId: string }[],
) {
  logStep('Assignments: per test, sensible open/close, maxAttempts 1 or 2–3');
  const openAt = new Date('2024-10-01T08:00:00.000Z');
  const closeAt = new Date('2025-06-30T18:00:00.000Z');
  const assignments: {
    id: string;
    testId: string;
    classSectionId: string;
    maxAttempts: number;
    organizationId: string;
  }[] = [];

  for (const test of tests) {
    const orgSections = sections.filter(
      (s) => s.orgId === test.orgId && (s.label === '6.A' || s.label === '7.B'),
    );
    const creatorId = orgUsers.find(
      (u) => u.orgId === test.orgId,
    )?.creatorMembershipId;
    if (!creatorId) continue;

    for (const sec of orgSections) {
      const existing = await prisma.assignment.findFirst({
        where: {
          organizationId: test.orgId,
          testId: test.testId,
          classSectionId: sec.id,
        },
      });
      const maxAttemptsFinal = sec.label === '6.A' ? 3 : 2;
      if (existing) {
        await prisma.assignment.update({
          where: { id: existing.id },
          data: { openAt, closeAt, maxAttempts: maxAttemptsFinal },
        });
        assignments.push({
          id: existing.id,
          testId: test.testId,
          classSectionId: sec.id,
          maxAttempts: maxAttemptsFinal,
          organizationId: test.orgId,
        });
      } else {
        const a = await prisma.assignment.create({
          data: {
            organizationId: test.orgId,
            yearId: sec.yearId,
            testId: test.testId,
            targetType: 'CLASS',
            classSectionId: sec.id,
            openAt,
            closeAt,
            maxAttempts: maxAttemptsFinal,
            createdById: creatorId,
          },
        });
        assignments.push({
          id: a.id,
          testId: test.testId,
          classSectionId: sec.id,
          maxAttempts: maxAttemptsFinal,
          organizationId: test.orgId,
        });
      }
    }
  }
  logDone(`Assignments: ${assignments.length}`);
  return assignments;
}

// --- 7) SUBMISSIONS (scénáře A–F) ---
async function createSubmissions(
  orgUsers: OrgUserIds[],
  sections: { id: string; orgId: string; label: string }[],
  tests: { testId: string; orgId: string; questionIds: string[] }[],
  assignments: {
    id: string;
    testId: string;
    classSectionId: string;
    maxAttempts: number;
    organizationId: string;
  }[],
) {
  logStep(
    'Submissions: Student A–F scenarios (1 attempt, 2 attempts, 3 attempts, none, decline, 1 test only)',
  );
  let created = 0;

  const createSubmissionAttempt = async ({
    assignment,
    test,
    studentId,
    attemptNo,
    score,
    submittedAt,
  }: {
    assignment: { id: string; testId: string; organizationId: string };
    test: { questionIds: string[] };
    studentId: string;
    attemptNo: number;
    score: number;
    submittedAt: Date;
  }) => {
    const existing = await prisma.submission.findFirst({
      where: {
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        studentId,
        attemptNo,
      },
    });
    if (existing) return false;

    const submission = await prisma.submission.create({
      data: {
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        testId: assignment.testId,
        studentId,
        status: SubmissionStatus.PENDING,
        attemptNo,
      },
    });

    await prisma.response.createMany({
      data: test.questionIds.map((qid) => ({
        submissionId: submission.id,
        questionId: qid,
        givenText: 'x',
        isCorrect: false,
      })),
    });

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.APPROVED,
        score,
        submittedAt,
      },
    });

    return true;
  };

  for (const org of orgUsers) {
    const orgSections = sections.filter((s) => s.orgId === org.orgId);
    const class6A = orgSections.find((s) => s.label === '6.A');
    const class7B = orgSections.find((s) => s.label === '7.B');
    if (!class6A || !class7B) continue;

    const assign6A = assignments.filter((a) => a.classSectionId === class6A.id);
    const assign7B = assignments.filter((a) => a.classSectionId === class7B.id);
    const orgTests = tests.filter((t) => t.orgId === org.orgId);
    const test1 = orgTests[0];
    const test2 = orgTests[1];
    const test3 = orgTests[2];

    const studentKeys = [
      'studentA',
      'studentB',
      'studentC',
      'studentD',
      'studentE',
      'studentF',
    ] as const;
    const membershipIds = org.studentMembershipIds;

    for (let idx = 0; idx < 6; idx++) {
      const key = studentKeys[idx];
      const studentMembershipId = membershipIds[idx];
      if (!studentMembershipId) continue;
      const is6A = idx < 3;

      const assignList = is6A ? assign6A : assign7B;
      const asg1 = assignList[0];
      const asg2 = assignList[1];
      const asg3 = assignList[2];
      const t1 = test1;
      const t2 = test2;
      const t3 = test3;
      if (!asg1 || !t1?.questionIds.length) continue;

      const baseDate = new Date('2024-11-01T10:00:00.000Z');

      if (key === 'studentA') {
        const didCreate = await createSubmissionAttempt({
          assignment: asg1,
          test: t1,
          studentId: studentMembershipId,
          attemptNo: 1,
          score: 0.45,
          submittedAt: new Date(baseDate.getTime() + 60000),
        });
        if (didCreate) {
          created++;
        }
      }

      if (key === 'studentB' && asg1.maxAttempts >= 2) {
        const scoresB: number[] = [0.4, 0.75];
        for (let attempt = 0; attempt < scoresB.length; attempt++) {
          const scoreVal = scoresB[attempt];
          if (scoreVal === undefined) continue;
          const didCreate = await createSubmissionAttempt({
            assignment: asg1,
            test: t1,
            studentId: studentMembershipId,
            attemptNo: attempt + 1,
            score: scoreVal,
            submittedAt: new Date(
              baseDate.getTime() + (attempt + 1) * 86400000,
            ),
          });
          if (didCreate) {
            created++;
          }
        }
      }

      if (key === 'studentC' && asg1.maxAttempts >= 3) {
        const scores: number[] = [0.3, 0.5, 0.65];
        for (let attempt = 0; attempt < 3; attempt++) {
          const scoreVal = scores[attempt];
          if (scoreVal === undefined) continue;
          const didCreate = await createSubmissionAttempt({
            assignment: asg1,
            test: t1,
            studentId: studentMembershipId,
            attemptNo: attempt + 1,
            score: scoreVal,
            submittedAt: new Date(
              baseDate.getTime() + (attempt + 1) * 86400000,
            ),
          });
          if (didCreate) {
            created++;
          }
        }
      }

      if (key === 'studentD') {
        continue;
      }

      if (key === 'studentE' && asg1.maxAttempts >= 2) {
        const scoresE: number[] = [0.8, 0.6];
        for (let attempt = 0; attempt < scoresE.length; attempt++) {
          const scoreVal = scoresE[attempt];
          if (scoreVal === undefined) continue;
          const didCreate = await createSubmissionAttempt({
            assignment: asg1,
            test: t1,
            studentId: studentMembershipId,
            attemptNo: attempt + 1,
            score: scoreVal,
            submittedAt: new Date(
              baseDate.getTime() + (attempt + 1) * 86400000,
            ),
          });
          if (didCreate) {
            created++;
          }
        }
      }

      if (key === 'studentF') {
        const didCreate = await createSubmissionAttempt({
          assignment: asg1,
          test: t1,
          studentId: studentMembershipId,
          attemptNo: 1,
          score: 0.7,
          submittedAt: new Date(baseDate.getTime() + 60000),
        });
        if (didCreate) {
          created++;
        }
      }
    }
  }

  logDone(`Submissions: ${created} created/updated`);
}

async function main() {
  console.log('🌱 Full walkthrough seed – start');
  await ensurePlatformBootstrapUsers();
  const orgs = await createOrganizations();
  const years = await createAcademicYears(orgs);
  const sections = await createClassSections(orgs, years);
  const orgUsers = await createUsersAndMembers(orgs);
  await createTeachers(orgUsers);
  await setHomeroomTeachers(orgUsers, sections);
  await createStudentsAndEnrollments(orgUsers, sections);
  const subjectsByOrg = await ensureCatalogAndSubjects(orgs);
  const tests = await createTests(orgs, orgUsers, years, subjectsByOrg);
  const assignments = await createAssignments(orgUsers, sections, tests);
  await createSubmissions(orgUsers, sections, tests, assignments);

  const [orgCount, studentCount, submissionCount] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.submission.count({ where: { deletedAt: null } }),
  ]);

  console.log('\n--- Seed summary ---');
  console.log('Organizations:', orgCount);
  console.log('Students:', studentCount);
  console.log('Submissions:', submissionCount);

  printDemoBanner(
    [
      { email: 'director@zs.demo.local', org: ORG_NAMES.ZS, role: 'DIRECTOR' },
      { email: 'teacher1@zs.demo.local', org: ORG_NAMES.ZS, role: 'TEACHER' },
      { email: 'teacher2@zs.demo.local', org: ORG_NAMES.ZS, role: 'TEACHER' },
      { email: 'student-a@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-b@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-c@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-d@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-e@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      { email: 'student-f@zs.demo.local', org: ORG_NAMES.ZS, role: 'STUDENT' },
      {
        email: 'director@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'DIRECTOR',
      },
      { email: 'teacher1@gym.demo.local', org: ORG_NAMES.GYM, role: 'TEACHER' },
      { email: 'teacher2@gym.demo.local', org: ORG_NAMES.GYM, role: 'TEACHER' },
      {
        email: 'student-a@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-b@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-c@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-d@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-e@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'student-f@gym.demo.local',
        org: ORG_NAMES.GYM,
        role: 'STUDENT',
      },
      {
        email: 'director@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'DIRECTOR',
      },
      {
        email: 'teacher1@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'TEACHER',
      },
      {
        email: 'teacher2@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'TEACHER',
      },
      {
        email: 'student-a@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-b@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-c@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-d@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-e@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
      {
        email: 'student-f@kom.demo.local',
        org: ORG_NAMES.KOMUNITA,
        role: 'STUDENT',
      },
    ],
    DEMO_PASSWORD,
  );

  console.log('✅ Full walkthrough seed – done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
