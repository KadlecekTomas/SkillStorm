import { PrismaClient, SubmissionStatus } from '@prisma/client';
import {
  ACADEMIC_YEAR_ID,
  ASSIGNMENT_IDS,
  CLASS_SECTION_IDS,
  ORG_IDS,
  TEST_IDS,
} from './seed-constants';
import { getMembershipId, logDone, logStep, SEED_USERS } from './seed-helpers';

type SeedQuestion = {
  id: string;
  text: string;
  correctAnswer: string | null;
  correctAnswers: string[];
  score: number;
};

type StudentScenario = {
  studentMembershipId: string;
  pattern: boolean[];
};

const DIAGNOSTIC_PATTERNS: Record<
  string,
  { title: string; students: StudentScenario[] }
> = {
  [ASSIGNMENT_IDS.mathFractions]: {
    title: 'Zlomky',
    students: [
      { studentMembershipId: '', pattern: [false, false, true] }, // Petr -> WEAK
      { studentMembershipId: '', pattern: [true, true, true] }, // Anna -> GOOD
    ],
  },
  [ASSIGNMENT_IDS.mathEquations]: {
    title: 'Rovnice',
    students: [
      { studentMembershipId: '', pattern: [true, true, true] }, // Petr -> GOOD
      { studentMembershipId: '', pattern: [true, false, true] }, // Anna -> WARNING
    ],
  },
  [ASSIGNMENT_IDS.mathPercentages]: {
    title: 'Procenta',
    students: [
      { studentMembershipId: '', pattern: [true, false, true] }, // Petr -> WARNING
      { studentMembershipId: '', pattern: [false, false, true] }, // Anna -> WEAK
    ],
  },
};

function wrongAnswerFor(question: SeedQuestion): string {
  const firstCorrect =
    question.correctAnswer ?? question.correctAnswers[0] ?? '';
  switch (firstCorrect.toLowerCase()) {
    case 'true':
      return 'false';
    case 'false':
      return 'true';
    case '5/6':
      return '2/5';
    case '20':
      return '25';
    case '4':
      return '5';
    case '5':
      return '4';
    case '3/4':
      return '1/4';
    default:
      return `WRONG_${question.id.slice(0, 4)}`;
  }
}

function correctAnswerFor(question: SeedQuestion): string {
  if (question.correctAnswer) return question.correctAnswer;
  if (question.correctAnswers.length > 1) {
    return JSON.stringify(question.correctAnswers);
  }
  return question.correctAnswers[0] ?? '';
}

async function ensureAssignmentWithTopic(
  prisma: PrismaClient,
  params: {
    id: string;
    testId: string;
    classSectionId: string;
    teacherMembershipId: string;
  },
) {
  const topicAssignment = await prisma.testAssignment.findFirst({
    where: { testId: params.testId },
    orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }, { id: 'asc' }],
    select: { topicLevelId: true },
  });

  if (!topicAssignment?.topicLevelId) {
    throw new Error(`Seed invariant failed: test ${params.testId} has no topicLevel link`);
  }

  return prisma.assignment.upsert({
    where: { id: params.id },
    update: {
      organizationId: ORG_IDS.chodovicka,
      yearId: ACADEMIC_YEAR_ID,
      testId: params.testId,
      targetType: 'CLASS',
      classSectionId: params.classSectionId,
      topicLevelId: topicAssignment.topicLevelId,
      openAt: new Date('2025-10-01T08:00:00.000Z'),
      closeAt: new Date('2026-06-30T18:00:00.000Z'),
      maxAttempts: 1,
      timeLimitSec: 1800,
      shuffle: false,
      showExplain: 'after_close',
      createdById: params.teacherMembershipId,
    },
    create: {
      id: params.id,
      organizationId: ORG_IDS.chodovicka,
      yearId: ACADEMIC_YEAR_ID,
      testId: params.testId,
      targetType: 'CLASS',
      classSectionId: params.classSectionId,
      topicLevelId: topicAssignment.topicLevelId,
      openAt: new Date('2025-10-01T08:00:00.000Z'),
      closeAt: new Date('2026-06-30T18:00:00.000Z'),
      maxAttempts: 1,
      timeLimitSec: 1800,
      shuffle: false,
      showExplain: 'after_close',
      createdById: params.teacherMembershipId,
    },
  });
}

async function seedSubmission(
  prisma: PrismaClient,
  params: {
    assignmentId: string;
    testId: string;
    organizationId: string;
    studentMembershipId: string;
    pattern: boolean[];
  },
) {
  const questions = await prisma.question.findMany({
    where: { testId: params.testId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      text: true,
      score: true,
      correctAnswer: true,
      correctAnswers: true,
    },
  });

  if (questions.length === 0) {
    throw new Error(`Seed invariant failed: test ${params.testId} has no questions`);
  }

  if (questions.length !== params.pattern.length) {
    throw new Error(
      `Seed invariant failed: response pattern length mismatch for test ${params.testId}`,
    );
  }

  const correctCount = params.pattern.filter(Boolean).length;
  const score = correctCount / questions.length;
  const submittedAt = new Date('2025-10-02T09:00:00.000Z');

  const submission = await prisma.submission.upsert({
    where: {
      organizationId_studentId_assignmentId_attemptNo: {
        organizationId: params.organizationId,
        studentId: params.studentMembershipId,
        assignmentId: params.assignmentId,
        attemptNo: 1,
      },
    },
    update: {
      testId: params.testId,
      status: SubmissionStatus.PENDING,
      score: null,
      submittedAt: null,
    },
    create: {
      organizationId: params.organizationId,
      assignmentId: params.assignmentId,
      testId: params.testId,
      studentId: params.studentMembershipId,
      attemptNo: 1,
      status: SubmissionStatus.PENDING,
      score: null,
      submittedAt: null,
    },
  });

  await prisma.response.deleteMany({ where: { submissionId: submission.id } });
  await prisma.response.createMany({
    data: questions.map((question, index) => {
      const isCorrect = params.pattern[index] === true;
      const givenText = isCorrect
        ? correctAnswerFor(question)
        : wrongAnswerFor(question);
      return {
        submissionId: submission.id,
        questionId: question.id,
        givenText,
        isCorrect,
        awardedPoints: isCorrect ? question.score : 0,
        maxPoints: question.score,
        correctAnswerSnapshot: correctAnswerFor(question),
        questionTextSnapshot: question.text,
        attemptNumber: 1,
        corrected: false,
      };
    }),
  });

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: SubmissionStatus.APPROVED,
      score,
      submittedAt,
    },
  });
}

export async function seed(prisma: PrismaClient) {
  logStep('Assignments > creating diagnostic assignments with topic coverage');

  const [teacherMembershipId, studentAnnaId, studentPetrId] = await Promise.all([
    getMembershipId(prisma, SEED_USERS.teacher, ORG_IDS.chodovicka),
    getMembershipId(prisma, SEED_USERS.student1, ORG_IDS.chodovicka),
    getMembershipId(prisma, SEED_USERS.student2, ORG_IDS.chodovicka),
  ]);

  DIAGNOSTIC_PATTERNS[ASSIGNMENT_IDS.mathFractions]!.students[0]!.studentMembershipId =
    studentPetrId;
  DIAGNOSTIC_PATTERNS[ASSIGNMENT_IDS.mathFractions]!.students[1]!.studentMembershipId =
    studentAnnaId;
  DIAGNOSTIC_PATTERNS[ASSIGNMENT_IDS.mathEquations]!.students[0]!.studentMembershipId =
    studentPetrId;
  DIAGNOSTIC_PATTERNS[ASSIGNMENT_IDS.mathEquations]!.students[1]!.studentMembershipId =
    studentAnnaId;
  DIAGNOSTIC_PATTERNS[ASSIGNMENT_IDS.mathPercentages]!.students[0]!.studentMembershipId =
    studentPetrId;
  DIAGNOSTIC_PATTERNS[ASSIGNMENT_IDS.mathPercentages]!.students[1]!.studentMembershipId =
    studentAnnaId;

  const assignmentSpecs = [
    {
      id: ASSIGNMENT_IDS.mathFractions,
      testId: TEST_IDS.mathFractions,
    },
    {
      id: ASSIGNMENT_IDS.mathEquations,
      testId: TEST_IDS.mathEquations,
    },
    {
      id: ASSIGNMENT_IDS.mathPercentages,
      testId: TEST_IDS.mathPercentages,
    },
  ] as const;

  for (const spec of assignmentSpecs) {
    const assignment = await ensureAssignmentWithTopic(prisma, {
      id: spec.id,
      testId: spec.testId,
      classSectionId: CLASS_SECTION_IDS.chodovickaA,
      teacherMembershipId,
    });

    for (const student of DIAGNOSTIC_PATTERNS[spec.id]!.students) {
      await prisma.assignmentStudent.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId: assignment.id,
            studentId: student.studentMembershipId,
          },
        },
        update: {},
        create: {
          assignmentId: assignment.id,
          studentId: student.studentMembershipId,
        },
      });

      await seedSubmission(prisma, {
        assignmentId: assignment.id,
        testId: spec.testId,
        organizationId: assignment.organizationId,
        studentMembershipId: student.studentMembershipId,
        pattern: student.pattern,
      });
    }
  }

  const nullTopicAssignments = await prisma.assignment.count({
    where: {
      testId: { in: Object.values(TEST_IDS) },
      topicLevelId: null,
    },
  });
  if (nullTopicAssignments > 0) {
    throw new Error(
      `Seed invariant failed: ${nullTopicAssignments} diagnostic assignments still have null topicLevelId`,
    );
  }

  logDone('Diagnostic assignments & submissions ready');
}
