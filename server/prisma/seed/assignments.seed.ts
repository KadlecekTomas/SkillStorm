import { PrismaClient, SubmissionStatus, SchoolGrade } from '@prisma/client';
import {
  ASSIGNMENT_IDS,
  ORG_IDS,
  TEST_IDS,
  RESPONSE_IDS,
} from './seed-constants';
import { getMembershipId, logDone, logStep, SEED_USERS } from './seed-helpers';

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

  const ACADEMIC_YEAR_LABEL = '2024/2025';
  // --- Academic year ---
  let academicYear = await prisma.academicYear.findFirst({
    where: { orgId: ORG_IDS.chodovicka, label: ACADEMIC_YEAR_LABEL },
  });
  if (academicYear) {
    console.log(
      `⚠️ AcademicYear '${academicYear.label}' already exists, skipping create.`,
    );
  } else {
    try {
      academicYear = await prisma.academicYear.create({
        data: {
          orgId: ORG_IDS.chodovicka,
          label: ACADEMIC_YEAR_LABEL,
          startsAt: new Date('2024-09-01'),
          endsAt: new Date('2025-08-31'),
          isCurrent: true,
        },
      });
      console.log(`✅ AcademicYear '${ACADEMIC_YEAR_LABEL}' created.`);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        academicYear = await prisma.academicYear.findFirstOrThrow({
          where: { orgId: ORG_IDS.chodovicka, label: ACADEMIC_YEAR_LABEL },
        });
        console.log(
          `⚠️ AcademicYear '${ACADEMIC_YEAR_LABEL}' already exists (caught P2002), reusing.`,
        );
      } else {
        throw err;
      }
    }
  }

  // --- Class section ---
  let classSection = await prisma.classSection.findFirst({
    where: {
      orgId: ORG_IDS.chodovicka,
      yearId: academicYear.id,
      grade: SchoolGrade.GRADE_6,
      section: 'A',
    },
  });
  if (classSection) {
    console.log(
      `⚠️ ClassSection '${classSection.label}' already exists, skipping create.`,
    );
  } else {
    try {
      classSection = await prisma.classSection.create({
        data: {
          orgId: ORG_IDS.chodovicka,
          yearId: academicYear.id,
          grade: SchoolGrade.GRADE_6,
          section: 'A',
          label: '6.A',
        },
      });
      console.log(`✅ ClassSection '6.A' created.`);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        classSection = await prisma.classSection.findFirstOrThrow({
          where: {
            orgId: ORG_IDS.chodovicka,
            yearId: academicYear.id,
            grade: SchoolGrade.GRADE_6,
            section: 'A',
          },
        });
        console.log(
          `⚠️ ClassSection '6.A' already exists (caught P2002), reusing.`,
        );
      } else {
        throw err;
      }
    }
  }

  // --- Pull existing tests safely ---
  const tests = await prisma.test.findMany({
    where: { organizationId: ORG_IDS.chodovicka },
    include: { questions: true },
  });

  const testByKey = new Map(tests.map((t) => [t.id, t]));

  const assignmentsByKey = new Map<
    string,
    Awaited<ReturnType<typeof prisma.assignment.create>>
  >();

  for (const config of ASSIGNMENT_CONFIGS) {
    const test = testByKey.get(config.testKey);
    if (!test) {
      console.warn(
        `⚠️ Assignments > Test ${config.testKey} not found, skipping.`,
      );
      continue;
    }

    const now = new Date();
    const openAt = new Date(
      now.getTime() + config.openOffsetMinutes * 60 * 1000,
    );
    const closeAt = new Date(
      now.getTime() + config.closeOffsetMinutes * 60 * 1000,
    );

    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        organizationId: ORG_IDS.chodovicka,
        testId: test.id,
        classSectionId: classSection.id,
      },
    });

    let assignment;
    if (existingAssignment) {
      assignment = await prisma.assignment.update({
        where: { id: existingAssignment.id },
        data: { openAt, closeAt },
      });
      console.log(
        `⚠️ Assignments > Reusing assignment for test ${config.testKey}`,
      );
    } else {
      assignment = await prisma.assignment.create({
        data: {
          organizationId: ORG_IDS.chodovicka,
          yearId: academicYear.id,
          testId: test.id,
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
      console.log(
        `✅ Assignments > Created assignment for test ${config.testKey}`,
      );
    }

    assignmentsByKey.set(config.id, assignment);

    // --- Enroll both demo students ---
    for (const studentId of [studentAId, studentBId]) {
      try {
        await prisma.assignmentStudent.create({
          data: {
            assignmentId: assignment.id,
            studentId,
          },
        });
        console.log(
          `✅ Assignments > Linked student ${studentId} to assignment ${assignment.id}`,
        );
      } catch (err: any) {
        if (err?.code === 'P2002') {
          console.log(
            `⚠️ Assignments > Duplicate link (${assignment.id}, ${studentId}), skipping.`,
          );
          continue;
        }
        throw err;
      }
    }
  }

  // --- Demo submission for Math assignment ---
  const mathAssignment = assignmentsByKey.get(ASSIGNMENT_IDS.math);
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
    console.warn(
      '⚠️ Assignments > Math test or assignment missing – no submission created.',
    );
  }

  logDone('Assignments & submissions ready');
}
