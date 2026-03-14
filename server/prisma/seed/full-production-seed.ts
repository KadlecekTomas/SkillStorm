/**
 * Full production-grade seed for SkillStorm (Variant A or B).
 * Deterministic, idempotent, safe (*.demo.local only). No random().
 *
 * Run: npm run seed:prod:a | seed:prod:b (from server/)
 * Verify: npm run seed:verify
 *
 * Variant A: 2 SCHOOL orgs, 3 classes/org, 12 students/class, 12 tests/teacher, 4 assignments/class.
 * Variant B: same orgs/classes, 25 students/class, 20 tests/teacher, 8 assignments/class.
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
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';
const NOW = new Date('2025-02-20T12:00:00.000Z');

function getVariant(): 'A' | 'B' {
  const arg = process.argv.find((a) => a.startsWith('--variant='));
  const v = arg?.split('=')[1]?.toUpperCase();
  return v === 'B' ? 'B' : 'A';
}

const variant = getVariant();
const STUDENTS_PER_CLASS = variant === 'B' ? 25 : 12;
const TESTS_PER_TEACHER = variant === 'B' ? 20 : 12;
const DRAFT_COUNT = Math.floor(TESTS_PER_TEACHER / 2);
const PUBLISHED_COUNT = TESTS_PER_TEACHER - DRAFT_COUNT;
const ASSIGNMENTS_PER_CLASS = variant === 'B' ? 8 : 4;

function isProduction(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? '';
  const appEnv = process.env.APP_ENV ?? '';
  return nodeEnv === 'production' || appEnv === 'production';
}

function logStep(msg: string): void {
  console.log(`🌱 ${msg}`);
}
function logDone(msg: string): void {
  console.log(`✅ ${msg}`);
}
async function hash(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

function printDemoBanner(
  users: Array<{ email: string; org: string; role: string }>,
  demoPassword: string,
  superadminEmail: string,
  superadminPasswordSource: string,
) {
  const env = process.env.NODE_ENV ?? 'development';
  console.log('\n--- DEMO SEED BANNER (copy-paste) ---');
  console.log('NODE_ENV=' + env);
  console.log('Demo users (shared password): ' + demoPassword);
  console.log('Demo users (email | org | role):');
  for (const u of users) {
    console.log(`  ${u.email} | ${u.org} | ${u.role}`);
  }
  console.log(`Superadmin: ${superadminEmail} | password: ${superadminPasswordSource}`);
  console.log('--- END DEMO BANNER ---\n');
}

function daysAgo(days: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d;
}

// --- Cleanup: only demo data (orgs with *.demo.local members) ---
async function cleanupDemoData(): Promise<void> {
  logStep('Cleanup: removing existing demo data (*.demo.local)');
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: '.demo.local' } },
    select: { id: true, email: true },
  });
  const userIds = demoUsers.map((u) => u.id);
  if (userIds.length === 0) {
    logDone('No demo users to remove');
    return;
  }
  const memberships = await prisma.membership.findMany({
    where: { userId: { in: userIds } },
    select: { organizationId: true },
  });
  const demoOrgIds = [...new Set(memberships.map((m) => m.organizationId))];
  for (const orgId of demoOrgIds) {
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
  await prisma.user.deleteMany({
    where: {
      id: { in: userIds },
      email: { not: 'superadmin@skillstorm.demo.local' },
    },
  });
  logDone(`Removed ${demoOrgIds.length} demo org(s) and related users`);
}

// --- Organizations (no slug in schema; identify by name) ---
const ORG_SPECS: Array<{ name: string; type: OrganizationType }> = [
  { name: 'Základní škola Alfa', type: OrganizationType.SCHOOL },
  { name: 'Gymnázium Beta', type: OrganizationType.SCHOOL },
  { name: 'Komunitní centrum Gama', type: OrganizationType.COMMUNITY },
];

type OrgRow = { id: string; name: string; type: OrganizationType };
async function createOrganizations(): Promise<OrgRow[]> {
  logStep('Organizations: 3 (Alfa, Beta, Gama)');
  const orgs: OrgRow[] = [];
  for (const spec of ORG_SPECS) {
    const org = await prisma.organization.create({
      data: {
        name: spec.name,
        type: spec.type,
        status: OrganizationStatus.ACTIVE,
      },
    });
    orgs.push({ id: org.id, name: org.name, type: org.type });
  }
  logDone(`Organizations: ${orgs.length}`);
  return orgs;
}

type YearRow = { id: string; orgId: string; label: string; isCurrent: boolean };
async function createAcademicYears(orgs: OrgRow[]): Promise<YearRow[]> {
  logStep('Academic years: 2024/2025 current, 2023/2024 previous per org');
  const years: YearRow[] = [];
  const activeStarts = new Date('2024-09-01T00:00:00.000Z');
  const activeEnds = new Date('2025-08-31T23:59:59.999Z');
  const archivedStarts = new Date('2023-09-01T00:00:00.000Z');
  const archivedEnds = new Date('2024-08-31T23:59:59.999Z');
  for (const org of orgs) {
    const current = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: '2024/2025',
        startsAt: activeStarts,
        endsAt: activeEnds,
        isCurrent: true,
      },
    });
    years.push({ id: current.id, orgId: org.id, label: '2024/2025', isCurrent: true });
    const archived = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: '2023/2024',
        startsAt: archivedStarts,
        endsAt: archivedEnds,
        isCurrent: false,
      },
    });
    years.push({ id: archived.id, orgId: org.id, label: '2023/2024', isCurrent: false });
  }
  logDone(`Academic years: ${years.length}`);
  return years;
}

type SectionRow = { id: string; orgId: string; yearId: string; label: string; grade: SchoolGrade; section: string };
async function createClassSections(orgs: OrgRow[], years: YearRow[]): Promise<SectionRow[]> {
  logStep('Class sections: 6.A, 7.B, 8.C current; 6.A previous per SCHOOL');
  const sections: SectionRow[] = [];
  const currentSpecs: [SchoolGrade, string, string][] = [
    [SchoolGrade.GRADE_6, 'A', '6.A'],
    [SchoolGrade.GRADE_7, 'B', '7.B'],
    [SchoolGrade.GRADE_8, 'C', '8.C'],
  ];
  for (const org of orgs) {
    if (org.type !== OrganizationType.SCHOOL) continue;
    const currentYear = years.find((y) => y.orgId === org.id && y.isCurrent);
    const archivedYear = years.find((y) => y.orgId === org.id && !y.isCurrent);
    if (!currentYear) continue;
    for (const [grade, section, label] of currentSpecs) {
      const cs = await prisma.classSection.create({
        data: { orgId: org.id, yearId: currentYear.id, grade, section, label },
      });
      sections.push({ id: cs.id, orgId: org.id, yearId: currentYear.id, label, grade, section });
    }
    if (archivedYear) {
      const old = await prisma.classSection.create({
        data: {
          orgId: org.id,
          yearId: archivedYear.id,
          grade: SchoolGrade.GRADE_6,
          section: 'A',
          label: '6.A',
        },
      });
      sections.push({
        id: old.id,
        orgId: org.id,
        yearId: archivedYear.id,
        label: '6.A',
        grade: SchoolGrade.GRADE_6,
        section: 'A',
      });
    }
  }
  logDone(`Class sections: ${sections.length}`);
  return sections;
}

const SCHOOL_SUFFIXES = ['alfa', 'beta'] as const;
type OrgUserIds = {
  orgId: string;
  orgSuffix: string;
  directorMembershipId: string;
  teacherMembershipIds: string[];
  studentMembershipIdsByClass: Record<string, string[]>;
  creatorMembershipId: string;
};

async function createUsersAndMembers(
  orgs: OrgRow[],
  sections: SectionRow[],
  passwordHash: string,
): Promise<OrgUserIds[]> {
  logStep(`Users: Director, 2 Teachers, ${STUDENTS_PER_CLASS} students/class per SCHOOL`);
  const result: OrgUserIds[] = [];
  const schoolOrgs = orgs.filter((o) => o.type === OrganizationType.SCHOOL);
  const passwordChangedAt = NOW;

  for (let oi = 0; oi < schoolOrgs.length; oi++) {
    const org = schoolOrgs[oi]!;
    const suffix = SCHOOL_SUFFIXES[oi] ?? 'alfa';
    const emails: string[] = [
      `director@${suffix}.demo.local`,
      `teacher1@${suffix}.demo.local`,
      `teacher2@${suffix}.demo.local`,
    ];
    const currentSections = sections.filter(
      (s) => s.orgId === org.id && ['6.A', '7.B', '8.C'].includes(s.label),
    );
    for (const sec of currentSections) {
      for (let i = 1; i <= STUDENTS_PER_CLASS; i++) {
        const num = String(i).padStart(2, '0');
        const short = sec.label.replace('.', '').toLowerCase();
        emails.push(`student${num}.${short}@${suffix}.demo.local`);
      }
    }
    const roleByIndex: OrganizationRole[] = [
      OrganizationRole.DIRECTOR,
      OrganizationRole.TEACHER,
      OrganizationRole.TEACHER,
    ];
    const userIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const email = emails[i]!;
      const name = i === 0 ? `Ředitel ${org.name}` : `Učitel ${i} ${org.name}`;
      const u = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          status: UserStatus.ACTIVE,
          passwordChangedAt,
          tokenVersion: 0,
        },
      });
      userIds.push(u.id);
    }
    const membershipIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const m = await prisma.membership.create({
        data: {
          userId: userIds[i]!,
          organizationId: org.id,
          role: roleByIndex[i]!,
        },
      });
      membershipIds.push(m.id);
    }
    const studentMembershipIdsByClass: Record<string, string[]> = {};
    let studentIndex = 3;
    for (const sec of currentSections) {
      const list: string[] = [];
      for (let i = 0; i < STUDENTS_PER_CLASS; i++) {
        const email = emails[studentIndex];
        studentIndex++;
        if (!email) continue;
        const u = await prisma.user.create({
          data: {
            email,
            name: `Žák ${sec.label} #${i + 1}`,
            passwordHash,
            status: UserStatus.ACTIVE,
            passwordChangedAt,
            tokenVersion: 0,
          },
        });
        const m = await prisma.membership.create({
          data: {
            userId: u.id,
            organizationId: org.id,
            role: OrganizationRole.STUDENT,
          },
        });
        list.push(m.id);
      }
      studentMembershipIdsByClass[sec.label] = list;
    }
    result.push({
      orgId: org.id,
      orgSuffix: suffix,
      directorMembershipId: membershipIds[0]!,
      teacherMembershipIds: [membershipIds[1]!, membershipIds[2]!],
      studentMembershipIdsByClass,
      creatorMembershipId: membershipIds[1]!,
    });
  }
  logDone(`Users/members: ${result.length} SCHOOL orgs`);
  return result;
}

async function ensureSuperadmin(passwordHash: string): Promise<void> {
  const prod = isProduction();
  const email = (process.env.SUPERADMIN_EMAIL ?? (prod ? '' : 'admin@skillstorm.local')).trim();
  const rawPassword = process.env.SUPERADMIN_PASSWORD;
  if (prod && (!email || !rawPassword)) {
    throw new Error(
      'In production SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required. Do not use demo password.',
    );
  }
  const pw = prod ? (rawPassword as string) : (rawPassword ?? DEMO_PASSWORD);
  const existing = await prisma.user.findFirst({ where: { email } });
  const hashToUse = existing ? undefined : await hash(pw);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true },
    });
    logDone(`Superadmin exists: ${email}`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: 'Platform Admin',
      passwordHash: hashToUse ?? passwordHash,
      status: UserStatus.ACTIVE,
      isPlatformAdmin: true,
      passwordChangedAt: NOW,
      tokenVersion: 0,
    },
  });
  logDone(`Superadmin created: ${email}`);
}

async function createTeachers(orgUsers: OrgUserIds[]): Promise<Map<string, string>> {
  logStep('Teachers');
  const map = new Map<string, string>();
  for (const org of orgUsers) {
    for (const mid of org.teacherMembershipIds) {
      const t = await prisma.teacher.create({
        data: { membershipId: mid, organizationId: org.orgId },
      });
      map.set(mid, t.id);
    }
  }
  logDone('Teachers ready');
  return map;
}

async function setHomeroomAndEnrollments(
  orgUsers: OrgUserIds[],
  sections: SectionRow[],
  teacherIdByMembershipId: Map<string, string>,
): Promise<void> {
  logStep('Homeroom + Students + Enrollments');
  for (const org of orgUsers) {
    const t1 = org.teacherMembershipIds[0];
    const teacherId = t1 ? teacherIdByMembershipId.get(t1) : undefined;
    const currentSections = sections.filter((s) => s.orgId === org.orgId && ['6.A', '7.B', '8.C'].includes(s.label));
    for (const sec of currentSections) {
      if (teacherId && sec.label === '6.A') {
        await prisma.classSection.update({
          where: { id: sec.id },
          data: { teacherId },
        });
      }
      const studentMids = org.studentMembershipIdsByClass[sec.label];
      if (!studentMids) continue;
      for (const membershipId of studentMids) {
        const student = await prisma.student.create({
          data: { membershipId, orgId: org.orgId },
        });
        await prisma.enrollment.create({
          data: {
            studentId: student.id,
            classSectionId: sec.id,
            yearId: sec.yearId,
            orgId: org.orgId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }
  }
  logDone('Homeroom + enrollments ready');
}

type TestRow = { id: string; orgId: string; creatorMembershipId: string; status: PublishStatus; questionIds: string[]; assignable: boolean };
async function createTests(orgUsers: OrgUserIds[]): Promise<TestRow[]> {
  logStep(`Tests: ${DRAFT_COUNT} DRAFT + ${PUBLISHED_COUNT} PUBLISHED per teacher, assignability mix`);
  const allTests: TestRow[] = [];
  const titles = ['Matematika – Lineární rovnice', 'Český jazyk – Pravopis'];
  for (const org of orgUsers) {
    for (let ti = 0; ti < TESTS_PER_TEACHER; ti++) {
      const isDraft = ti < DRAFT_COUNT;
      const status = isDraft ? PublishStatus.DRAFT : PublishStatus.PUBLISHED;
      const title = `${titles[ti % 2]!} – T${ti + 1}`;
      const test = await prisma.test.create({
        data: {
          organizationId: org.orgId,
          title,
          description: `Seed test ${ti + 1}`,
          allowedGrades: [SchoolGrade.GRADE_6, SchoolGrade.GRADE_7, SchoolGrade.GRADE_8],
          status,
          creatorId: org.creatorMembershipId,
        },
      });
      const assignabilityKind = ti % 7;
      let questionIds: string[] = [];
      if (assignabilityKind === 6) {
        // NO_QUESTIONS (0 questions) – draft only
      } else {
        const numQ = 3 + (ti % 4);
        for (let qi = 0; qi < numQ; qi++) {
          const typeIdx = qi % 3;
          const type: QuestionType =
            typeIdx === 0 ? QuestionType.MULTIPLE_CHOICE : typeIdx === 1 ? QuestionType.TRUE_FALSE : QuestionType.FILL_IN_THE_BLANK;
          const hasScore = assignabilityKind !== 1;
          const hasCorrect = assignabilityKind !== 2;
          const score = hasScore ? 2 : 0;
          const correctAnswer = hasCorrect ? 'A' : null;
          const correctAnswers = hasCorrect && type === QuestionType.MULTIPLE_CHOICE ? ['A'] : [];
          const q = await prisma.question.create({
            data: {
              testId: test.id,
              text: `Otázka ${qi + 1}: ...`,
              type,
              order: qi + 1,
              score,
              correctAnswer,
              correctAnswers,
            },
          });
          questionIds.push(q.id);
          if (type === QuestionType.MULTIPLE_CHOICE) {
            await prisma.option.createMany({
              data: [
                { questionId: q.id, text: 'A' },
                { questionId: q.id, text: 'B' },
                { questionId: q.id, text: 'C' },
              ],
            });
          }
        }
      }
      const assignable =
        questionIds.length > 0 &&
        assignabilityKind !== 1 &&
        assignabilityKind !== 2 &&
        assignabilityKind !== 6;
      allTests.push({
        id: test.id,
        orgId: org.orgId,
        creatorMembershipId: org.creatorMembershipId,
        status,
        questionIds,
        assignable,
      });
    }
  }
  logDone(`Tests: ${allTests.length}`);
  return allTests;
}

type AssignmentRow = { id: string; testId: string; classSectionId: string; yearId: string; orgId: string; organizationId: string };
async function createAssignments(
  orgUsers: OrgUserIds[],
  sections: SectionRow[],
  tests: TestRow[],
): Promise<AssignmentRow[]> {
  logStep(`Assignments: ${ASSIGNMENTS_PER_CLASS} per class, some tests to 2 classes, 1 assignable unassigned`);
  const openAt = daysAgo(60);
  const closeAt = daysAgo(0);
  const assignments: AssignmentRow[] = [];
  for (const org of orgUsers) {
    const currentSections = sections.filter((s) => s.orgId === org.orgId && ['6.A', '7.B', '8.C'].includes(s.label));
    const orgPublishedAssignable = tests.filter(
      (t) => t.orgId === org.orgId && t.status === PublishStatus.PUBLISHED && t.assignable,
    );
    if (orgPublishedAssignable.length < 2) continue;
    const toAssign = orgPublishedAssignable.slice(1);
    const toAssignQueue = [...toAssign];
    for (const sec of currentSections) {
      for (let k = 0; k < ASSIGNMENTS_PER_CLASS; k++) {
        const test = toAssignQueue[k % toAssignQueue.length]!;
        const testTopic = await prisma.testAssignment.findFirst({
          where: { testId: test.id },
          orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
          select: { topicLevelId: true },
        });
        if (!testTopic?.topicLevelId) {
          throw new Error(`Full production seed requires topicLevelId for test ${test.id}`);
        }
        const a = await prisma.assignment.create({
          data: {
            organizationId: org.orgId,
            yearId: sec.yearId,
            testId: test.id,
            targetType: 'CLASS',
            classSectionId: sec.id,
            topicLevelId: testTopic.topicLevelId,
            openAt,
            closeAt,
            maxAttempts: 2,
            createdById: org.creatorMembershipId,
          },
        });
        assignments.push({
          id: a.id,
          testId: test.id,
          classSectionId: sec.id,
          yearId: sec.yearId,
          orgId: org.orgId,
          organizationId: org.orgId,
        });
      }
    }
    const firstTest = toAssign[0];
    if (firstTest && currentSections.length >= 2) {
      const sec0 = currentSections[0]!;
      const sec1 = currentSections[1]!;
      const firstTopic = await prisma.testAssignment.findFirst({
        where: { testId: firstTest.id },
        orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
        select: { topicLevelId: true },
      });
      if (!firstTopic?.topicLevelId) {
        throw new Error(`Full production seed requires topicLevelId for test ${firstTest.id}`);
      }
      const a1 = await prisma.assignment.create({
        data: {
          organizationId: org.orgId,
          yearId: sec0.yearId,
          testId: firstTest.id,
          targetType: 'CLASS',
          classSectionId: sec0.id,
          topicLevelId: firstTopic.topicLevelId,
          openAt,
          closeAt,
          maxAttempts: 2,
          createdById: org.creatorMembershipId,
        },
      });
      assignments.push({
        id: a1.id,
        testId: firstTest.id,
        classSectionId: sec0.id,
        yearId: sec0.yearId,
        orgId: org.orgId,
        organizationId: org.orgId,
      });
      const a2 = await prisma.assignment.create({
        data: {
          organizationId: org.orgId,
          yearId: sec1.yearId,
          testId: firstTest.id,
          targetType: 'CLASS',
          classSectionId: sec1.id,
          topicLevelId: firstTopic.topicLevelId,
          openAt,
          closeAt,
          maxAttempts: 2,
          createdById: org.creatorMembershipId,
        },
      });
      assignments.push({
        id: a2.id,
        testId: firstTest.id,
        classSectionId: sec1.id,
        yearId: sec1.yearId,
        orgId: org.orgId,
        organizationId: org.orgId,
      });
    }
  }
  logDone(`Assignments: ${assignments.length}`);
  return assignments;
}

async function createSubmissions(
  orgUsers: OrgUserIds[],
  sections: SectionRow[],
  assignments: AssignmentRow[],
  tests: TestRow[],
): Promise<void> {
  logStep('Submissions: 60% submitted, score bands, last 30 days, risk shaping');
  const testQuestionIds = new Map<string, string[]>();
  for (const t of tests) testQuestionIds.set(t.id, t.questionIds);
  for (const org of orgUsers) {
    const currentSections = sections.filter((s) => s.orgId === org.orgId && ['6.A', '7.B', '8.C'].includes(s.label));
    for (const sec of currentSections) {
      const studentMids = org.studentMembershipIdsByClass[sec.label];
      if (!studentMids) continue;
      const secAssignments = assignments.filter((a) => a.classSectionId === sec.id);
      const submitCount = Math.floor(studentMids.length * 0.6);
      for (let si = 0; si < studentMids.length; si++) {
        const studentMid = studentMids[si]!;
        const shouldSubmit = si < submitCount;
        for (let ai = 0; ai < secAssignments.length; ai++) {
          const asg = secAssignments[ai]!;
          const qIds = testQuestionIds.get(asg.testId) ?? [];
          if (qIds.length === 0) continue;
          if (!shouldSubmit) continue;
          const dayOffset = (si + ai * 3) % 30;
          const submittedAt = daysAgo(dayOffset);
          const bucket = si % 10;
          let score: number;
          if (bucket < 2) score = 0.8 + (si % 5) * 0.04;
          else if (bucket < 7) score = 0.5 + (si % 4) * 0.08;
          else score = 0.05 + (si % 3) * 0.12;
          score = Math.min(1, Math.max(0, score));
          const sub = await prisma.submission.create({
            data: {
              organizationId: asg.organizationId,
              assignmentId: asg.id,
              testId: asg.testId,
              studentId: studentMid,
              status: SubmissionStatus.APPROVED,
              score,
              submittedAt,
              attemptNo: 1,
            },
          });
          for (const qid of qIds) {
            await prisma.response.create({
              data: {
                submissionId: sub.id,
                questionId: qid,
                givenText: 'x',
                isCorrect: score > 0.5,
              },
            });
          }
        }
      }
    }
  }
  logDone('Submissions created');
}

async function ensureRiskAndTrends(
  orgUsers: OrgUserIds[],
  sections: SectionRow[],
  assignments: AssignmentRow[],
  tests: TestRow[],
): Promise<void> {
  logStep('Risk: 3 HIGH, 5 MEDIUM per class; trends (decline/improve)');
  const testQuestionIds = new Map<string, string[]>();
  for (const t of tests) testQuestionIds.set(t.id, t.questionIds);
  for (const org of orgUsers) {
    const currentSections = sections.filter((s) => s.orgId === org.orgId && ['6.A', '7.B', '8.C'].includes(s.label));
    for (const sec of currentSections) {
      const studentMids = org.studentMembershipIdsByClass[sec.label];
      if (!studentMids || studentMids.length < 10) continue;
      const secAssignments = assignments.filter((a) => a.classSectionId === sec.id);
      if (secAssignments.length < 2) continue;
      const [asg1, asg2] = secAssignments;
      const q1 = testQuestionIds.get(asg1!.testId) ?? [];
      const q2 = testQuestionIds.get(asg2!.testId) ?? [];
      if (q1.length === 0 || q2.length === 0) continue;
      const highIndices = [0, 1, 2];
      const mediumIndices = [3, 4, 5, 6, 7];
      for (const idx of highIndices) {
        const mid = studentMids[idx];
        if (!mid) continue;
        for (const [asg, qIds, scoreVal] of [
          [asg1!, q1, 0.35] as const,
          [asg2!, q2, 0.38] as const,
        ]) {
          const existing = await prisma.submission.findFirst({
            where: { assignmentId: asg.id, studentId: mid, attemptNo: 1 },
          });
          const submittedAt = asg === asg1 ? daysAgo(25) : daysAgo(3);
          if (existing) {
            await prisma.submission.update({
              where: { id: existing.id },
              data: { score: scoreVal, submittedAt },
            });
          } else {
            const sub = await prisma.submission.create({
              data: {
                organizationId: asg.organizationId,
                assignmentId: asg.id,
                testId: asg.testId,
                studentId: mid,
                status: SubmissionStatus.APPROVED,
                score: scoreVal,
                submittedAt,
                attemptNo: 1,
              },
            });
            for (const qid of qIds) {
              await prisma.response.create({
                data: { submissionId: sub.id, questionId: qid, givenText: 'x', isCorrect: false },
              });
            }
          }
        }
      }
      for (const idx of mediumIndices) {
        const mid = studentMids[idx];
        if (!mid) continue;
        const existing = await prisma.submission.findFirst({
          where: { assignmentId: asg1!.id, studentId: mid, attemptNo: 1 },
        });
        if (existing) {
          await prisma.submission.update({
            where: { id: existing.id },
            data: { score: 0.45, submittedAt: daysAgo(20) },
          });
        } else {
          const sub = await prisma.submission.create({
            data: {
              organizationId: asg1!.organizationId,
              assignmentId: asg1!.id,
              testId: asg1!.testId,
              studentId: mid,
              status: SubmissionStatus.APPROVED,
              score: 0.45,
              submittedAt: daysAgo(20),
              attemptNo: 1,
            },
          });
          for (const qid of q1) {
            await prisma.response.create({
              data: { submissionId: sub.id, questionId: qid, givenText: 'x', isCorrect: false },
            });
          }
        }
      }
    }
  }
  logDone('Risk and trends shaped');
}

async function createCommunityMinimal(orgs: OrgRow[], years: YearRow[], passwordHash: string): Promise<void> {
  const gama = orgs.find((o) => o.name.includes('Gama'));
  if (!gama) return;
  logStep('Gama (COMMUNITY): minimal users');
  const u = await prisma.user.create({
    data: {
      email: 'admin@gama.demo.local',
      name: 'Admin Gama',
      passwordHash,
      status: UserStatus.ACTIVE,
      passwordChangedAt: NOW,
      tokenVersion: 0,
    },
  });
  await prisma.membership.create({
    data: {
      userId: u.id,
      organizationId: gama.id,
      role: OrganizationRole.DIRECTOR,
    },
  });
  logDone('Gama admin created');
}

async function main(): Promise<void> {
  console.log(`🌱 Full production seed – variant ${variant}`);
  if (isProduction()) {
    const email = (process.env.SUPERADMIN_EMAIL ?? '').trim();
    const password = process.env.SUPERADMIN_PASSWORD ?? '';
    if (!email || !password) {
      throw new Error(
        'Production guard: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required. Set both env vars and do not use demo password.',
      );
    }
  }
  await cleanupDemoData();
  const passwordHash = await hash(DEMO_PASSWORD);
  const orgs = await createOrganizations();
  const years = await createAcademicYears(orgs);
  const sections = await createClassSections(orgs, years);
  const orgUsers = await createUsersAndMembers(orgs, sections, passwordHash);
  await ensureSuperadmin(passwordHash);
  const teacherMap = await createTeachers(orgUsers);
  await setHomeroomAndEnrollments(orgUsers, sections, teacherMap);
  await createCommunityMinimal(orgs, years, passwordHash);
  const tests = await createTests(orgUsers);
  const assignments = await createAssignments(orgUsers, sections, tests);
  await createSubmissions(orgUsers, sections, assignments, tests);
  await ensureRiskAndTrends(orgUsers, sections, assignments, tests);

  const [orgCount, userCount, testCount, assignCount, subCount] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.user.count(),
    prisma.test.count({ where: { deletedAt: null } }),
    prisma.assignment.count(),
    prisma.submission.count({ where: { deletedAt: null } }),
  ]);

  console.log('\n--- Seed summary ---');
  console.log('Organizations:', orgCount);
  console.log('Users:', userCount);
  console.log('Tests:', testCount);
  console.log('Assignments:', assignCount);
  console.log('Submissions:', subCount);

  const superadminEmail = process.env.SUPERADMIN_EMAIL ?? 'admin@skillstorm.local';
  const superadminPasswordSource = isProduction()
    ? '(from SUPERADMIN_PASSWORD env)'
    : `(or env, fallback: ${DEMO_PASSWORD})`;

  const demoUserRows: Array<{ email: string; org: string; role: string }> = [
    { email: 'director@alfa.demo.local', org: 'Základní škola Alfa', role: 'DIRECTOR' },
    { email: 'teacher1@alfa.demo.local', org: 'Základní škola Alfa', role: 'TEACHER' },
    { email: 'teacher2@alfa.demo.local', org: 'Základní škola Alfa', role: 'TEACHER' },
    { email: 'student01.6a@alfa.demo.local', org: 'Základní škola Alfa', role: 'STUDENT' },
    { email: 'director@beta.demo.local', org: 'Gymnázium Beta', role: 'DIRECTOR' },
    { email: 'teacher1@beta.demo.local', org: 'Gymnázium Beta', role: 'TEACHER' },
    { email: 'teacher2@beta.demo.local', org: 'Gymnázium Beta', role: 'TEACHER' },
    { email: 'student01.6a@beta.demo.local', org: 'Gymnázium Beta', role: 'STUDENT' },
    { email: 'admin@gama.demo.local', org: 'Komunitní centrum Gama', role: 'DIRECTOR' },
  ];
  printDemoBanner(demoUserRows, DEMO_PASSWORD, superadminEmail, superadminPasswordSource);

  console.log('✅ Full production seed – done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
