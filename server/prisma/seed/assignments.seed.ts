import {
  PrismaClient,
  SubmissionStatus,
  SchoolGrade,
} from '@prisma/client';
import {
  ASSIGNMENT_IDS,
  CLASS_SECTION_IDS,
  ORG_IDS,
  SUBMISSION_IDS,
  TEST_IDS,
  ACADEMIC_YEAR_ID,
  RESPONSE_IDS,
} from './seed-constants';
import {
  getMembershipId,
  logDone,
  logStep,
  SEED_USERS,
} from './seed-helpers';

const ASSIGNMENT_CONFIGS = [
  {
    id: ASSIGNMENT_IDS.math,
    testKey: TEST_IDS.math,
    openOffsetMinutes: -120,
    closeOffsetMinutes: 7 * 24 * 60,
  },
  {
    id: ASSIGNMENT_IDS.english,
    testKey: TEST_IDS.english,
    openOffsetMinutes: -60,
    closeOffsetMinutes: 5 * 24 * 60,
  },
  {
    id: ASSIGNMENT_IDS.informatics,
    testKey: TEST_IDS.informatics,
    openOffsetMinutes: 0,
    closeOffsetMinutes: 10 * 24 * 60,
  },
];

export async function seed(prisma: PrismaClient) {
  logStep('Assignments > creating demo assignments & submissions');

  const teacherMembershipId = await getMembershipId(
    prisma,
    SEED_USERS.teacher,
    ORG_IDS.chodovicka,
  );
  const studentAId = await getMembershipId(
    prisma,
    SEED_USERS.student1,
    ORG_IDS.chodovicka,
  );
  const studentBId = await getMembershipId(
    prisma,
    SEED_USERS.student2,
    ORG_IDS.chodovicka,
  );

  // --- Academic year ---
  const academicYear = await prisma.academicYear.upsert({
    where: { id: ACADEMIC_YEAR_ID },
    update: {},
    create: {
      id: ACADEMIC_YEAR_ID,
      orgId: ORG_IDS.chodovicka,
      label: '2024/2025',
      startsAt: new Date('2024-09-01'),
      endsAt: new Date('2025-06-30'),
      isCurrent: true,
    },
  });

  // --- Class section ---
  const classSection = await prisma.classSection.upsert({
    where: { id: CLASS_SECTION_IDS.chodovickaA },
    update: { label: '6.A' },
    create: {
      id: CLASS_SECTION_IDS.chodovickaA,
      orgId: ORG_IDS.chodovicka,
      yearId: academicYear.id,
      grade: SchoolGrade.GRADE_6,
      section: 'A',
      label: '6.A',
    },
  });

  // --- Pull existing tests safely ---
  const tests = await prisma.test.findMany({
    where: { organizationId: ORG_IDS.chodovicka },
    include: { questions: true },
  });

  const testByKey = new Map(tests.map((t) => [t.id, t]));

  const assignments: any[] = [];

  for (const config of ASSIGNMENT_CONFIGS) {
    const test = testByKey.get(config.testKey);
    if (!test) {
      console.warn(`⚠️ Assignments > Test ${config.testKey} not found, skipping.`);
      continue;
    }

    const now = new Date();
    const openAt = new Date(now.getTime() + config.openOffsetMinutes * 60 * 1000);
    const closeAt = new Date(now.getTime() + config.closeOffsetMinutes * 60 * 1000);

    // --- Safe upsert (no FK errors) ---
    const assignment = await prisma.assignment.upsert({
      where: { id: config.id },
      update: { openAt, closeAt },
      create: {
        id: config.id,
        organizationId: ORG_IDS.chodovicka,
        testId: test.id, // ✅ reference real test
        targetType: 'CLASS',
        classSectionId: classSection.id,
        openAt,
        closeAt,
        maxAttempts: 2,
        timeLimitSec: 1800,
        shuffle: true,
        showExplain: 'after_close',
        createdById: teacherMembershipId,
      },
    });

    assignments.push(assignment);

    // --- Enroll both demo students ---
    for (const studentId of [studentAId, studentBId]) {
      await prisma.assignmentStudent.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId: assignment.id,
            studentId,
          },
        },
        update: {},
        create: {
          assignmentId: assignment.id,
          studentId,
        },
      });
    }
  }

  // --- Demo submission for Math assignment ---
  const mathAssignment = assignments.find((a) => a.id === ASSIGNMENT_IDS.math);
  const mathTest = tests.find((t) => t.id === TEST_IDS.math);

  if (mathAssignment && mathTest) {
    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentId_attemptNo: {
          assignmentId: mathAssignment.id,
          studentId: studentAId,
          attemptNo: 1,
        },
      },
      update: {
        status: SubmissionStatus.APPROVED,
        score: 4,
        submittedAt: new Date(),
      },
      create: {
        assignmentId: mathAssignment.id,
        studentId: studentAId,
        attemptNo: 1,
        status: SubmissionStatus.APPROVED,
        score: 4,
        submittedAt: new Date(),
        testId: mathAssignment.testId,
      },
    });


    // --- Add responses ---
    const [question1, question2] = mathTest.questions;

    if (question1) {
      await prisma.response.upsert({
        where: { id: RESPONSE_IDS.mathQ1 },
        update: { givenText: '1', isCorrect: true },
        create: {
          id: RESPONSE_IDS.mathQ1,
          submissionId: submission.id,
          questionId: question1.id,
          givenText: '1',
          isCorrect: true,
        },
      });
    }

    if (question2) {
      await prisma.response.upsert({
        where: { id: RESPONSE_IDS.mathQ2 },
        update: {
          givenText: 'Součet vnitřních úhlů je 180°',
          isCorrect: true,
        },
        create: {
          id: RESPONSE_IDS.mathQ2,
          submissionId: submission.id,
          questionId: question2.id,
          givenText: 'Součet vnitřních úhlů je 180°',
          isCorrect: true,
        },
      });
    }
  } else {
    console.warn('⚠️ Assignments > Math test or assignment missing – no submission created.');
  }

  logDone('Assignments & submissions ready');
}
