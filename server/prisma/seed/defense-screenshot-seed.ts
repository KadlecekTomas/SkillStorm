import 'dotenv/config';
import {
  AuditEntityType,
  EnrollmentStatus,
  OrganizationRole,
  Prisma,
  PrismaClient,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
  TopicPhase,
} from '@prisma/client';

const prisma = new PrismaClient();

const ORG_NAME = 'Základní škola Demo';
const TEACHER_EMAIL = 'teacher1@zs.demo.local';
const STUDENT_D_EMAIL = 'student-d@zs.demo.local';
const STUDENT_A_EMAIL = 'student-a@zs.demo.local';

const TEST_TITLE = 'Český jazyk – pravopis';
const DRAFT_TITLE = 'Český jazyk – pravopis – koncept';
const SUBJECT_NAME = 'Český jazyk';
const TOPIC_NAME = 'Vyjmenovaná slova';

const DIRTY_TITLE_PATTERNS = [
  'Defense Screenshot Draft',
  'DiagTest-',
  'Golden Flow',
  '4efeff',
  'vergrergr',
  'vergregr',
  'test123',
  'qwerty',
];

const QUESTIONS = [
  {
    text: 'Slovo vyjmenované po B je?',
    type: QuestionType.MULTIPLE_CHOICE,
    correctAnswer: 'být',
    options: ['být', 'bít', 'pít'],
  },
  {
    text: 'Doplň i/y: Děti se smál_.',
    type: QuestionType.FILL_IN_THE_BLANK,
    correctAnswer: 'y',
    options: [],
  },
  {
    text: 'Tvrzení: Slovo slyšet patří mezi vyjmenovaná slova po S.',
    type: QuestionType.TRUE_FALSE,
    correctAnswer: 'true',
    options: [],
  },
];

function requireEntity<T>(value: T | null | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

async function findMembership(email: string, organizationId: string, role: OrganizationRole) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true },
  });
  const membership = user?.memberships.find(
    (item) =>
      item.organizationId === organizationId &&
      item.role === role &&
      item.deletedAt === null,
  );
  return requireEntity(
    membership,
    `Nenalezen demo účet ${email} s rolí ${role}. Nejdřív spusť npm run seed:full v server/.`,
  );
}

async function archiveDirtyTests(organizationId: string) {
  const now = new Date();
  for (const pattern of DIRTY_TITLE_PATTERNS) {
    await prisma.test.updateMany({
      where: {
        organizationId,
        deletedAt: null,
        title: { contains: pattern, mode: 'insensitive' },
      },
      data: {
        status: PublishStatus.ARCHIVED,
        deletedAt: now,
      },
    });
  }
}

async function deleteTestsByTitle(organizationId: string, titles: string[]) {
  const tests = await prisma.test.findMany({
    where: { organizationId, title: { in: titles } },
    select: { id: true },
  });
  const testIds = tests.map((test) => test.id);
  if (testIds.length === 0) return;

  const assignments = await prisma.assignment.findMany({
    where: { testId: { in: testIds } },
    select: { id: true },
  });
  const assignmentIds = assignments.map((assignment) => assignment.id);

  const submissions = await prisma.submission.findMany({
    where: { OR: [{ testId: { in: testIds } }, { assignmentId: { in: assignmentIds } }] },
    select: { id: true },
  });
  const submissionIds = submissions.map((submission) => submission.id);

  const questions = await prisma.question.findMany({
    where: { testId: { in: testIds } },
    select: { id: true },
  });
  const questionIds = questions.map((question) => question.id);

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  if (submissionIds.length) {
    operations.push(
      prisma.submission.updateMany({
        where: { id: { in: submissionIds } },
        data: {
          submittedAt: null,
          status: SubmissionStatus.PENDING,
          score: null,
          earnedPoints: null,
          maxPoints: null,
        },
      }),
    );
  }
  if (submissionIds.length || questionIds.length) {
    operations.push(
      prisma.response.deleteMany({
        where: {
          OR: [
            ...(submissionIds.length ? [{ submissionId: { in: submissionIds } }] : []),
            ...(questionIds.length ? [{ questionId: { in: questionIds } }] : []),
          ],
        },
      }),
    );
  }
  operations.push(
    prisma.submission.deleteMany({ where: { id: { in: submissionIds } } }),
    prisma.assignmentStudent.deleteMany({ where: { assignmentId: { in: assignmentIds } } }),
    prisma.assignment.deleteMany({ where: { id: { in: assignmentIds } } }),
    prisma.testAssignment.deleteMany({ where: { testId: { in: testIds } } }),
    prisma.option.deleteMany({ where: { questionId: { in: questionIds } } }),
    prisma.answer.deleteMany({ where: { questionId: { in: questionIds } } }),
    prisma.question.deleteMany({ where: { id: { in: questionIds } } }),
    prisma.test.deleteMany({ where: { id: { in: testIds } } }),
  );

  await prisma.$transaction(operations);
}

async function ensureCurrentYear(organizationId: string) {
  const current = await prisma.academicYear.findFirst({
    where: { orgId: organizationId, isCurrent: true, deletedAt: null },
    orderBy: { startsAt: 'desc' },
  });
  if (current) return current;

  return prisma.academicYear.upsert({
    where: { orgId_label: { orgId: organizationId, label: '2025/2026' } },
    update: {
      startsAt: new Date('2025-09-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-31T23:59:59.000Z'),
      isCurrent: true,
      deletedAt: null,
    },
    create: {
      orgId: organizationId,
      label: '2025/2026',
      startsAt: new Date('2025-09-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-31T23:59:59.000Z'),
      isCurrent: true,
    },
  });
}

async function ensureSubjectModel(organizationId: string) {
  const catalogSubject = await prisma.catalogSubject.upsert({
    where: { code: 'DEFENSE_CJ' },
    update: { name: SUBJECT_NAME, isActive: true, deletedAt: null },
    create: { code: 'DEFENSE_CJ', name: SUBJECT_NAME, isActive: true },
  });

  const subject =
    (await prisma.subject.findFirst({
      where: { OR: [{ catalogSubjectId: catalogSubject.id }, { name: SUBJECT_NAME }] },
    })) ??
    (await prisma.subject.create({
      data: {
        catalogSubjectId: catalogSubject.id,
        name: SUBJECT_NAME,
        gradeFrom: 1,
        gradeTo: 9,
      },
    }));

  if (subject.deletedAt) {
    await prisma.subject.update({
      where: { id: subject.id },
      data: { deletedAt: null, name: SUBJECT_NAME },
    });
  }

  const subjectLevel = await prisma.subjectLevel.upsert({
    where: { subjectId_grade: { subjectId: subject.id, grade: SchoolGrade.GRADE_7 } },
    update: { isEnabled: true, label: '7. ročník' },
    create: {
      subjectId: subject.id,
      grade: SchoolGrade.GRADE_7,
      order: 7,
      label: '7. ročník',
      isEnabled: true,
    },
  });

  const catalogTopic = await prisma.catalogTopic.upsert({
    where: { subjectId_name: { subjectId: catalogSubject.id, name: TOPIC_NAME } },
    update: { isActive: true, deletedAt: null, order: 1 },
    create: {
      subjectId: catalogSubject.id,
      name: TOPIC_NAME,
      order: 1,
      isActive: true,
    },
  });

  const topicLevel = await prisma.topicLevel.upsert({
    where: {
      subjectLevelId_catalogTopicId_phase: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
        phase: TopicPhase.INTRO,
      },
    },
    update: { name: TOPIC_NAME, order: 1 },
    create: {
      subjectLevelId: subjectLevel.id,
      catalogTopicId: catalogTopic.id,
      name: TOPIC_NAME,
      phase: TopicPhase.INTRO,
      order: 1,
    },
  });

  const orgSubject = await prisma.orgSubject.upsert({
    where: { organizationId_subjectId: { organizationId, subjectId: subject.id } },
    update: { isEnabled: true },
    create: { organizationId, subjectId: subject.id, isEnabled: true, isCustom: false },
  });

  return { subject, topicLevel, orgSubject };
}

async function ensureStudentClass(
  organizationId: string,
  yearId: string,
  studentMembershipId: string,
) {
  const student = await prisma.student.findFirst({
    where: { membershipId: studentMembershipId, orgId: organizationId, deletedAt: null },
  });
  requireEntity(student, `Nenalezen studentský profil pro membership ${studentMembershipId}.`);

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: student!.id,
      orgId: organizationId,
      yearId,
      status: EnrollmentStatus.ACTIVE,
    },
    include: { classSection: true },
  });
  if (existingEnrollment) return existingEnrollment.classSection;

  const classSection = await prisma.classSection.upsert({
    where: {
      orgId_yearId_grade_section: {
        orgId: organizationId,
        yearId,
        grade: SchoolGrade.GRADE_7,
        section: 'B',
      },
    },
    update: { label: '7.B' },
    create: {
      orgId: organizationId,
      yearId,
      grade: SchoolGrade.GRADE_7,
      section: 'B',
      label: '7.B',
    },
  });

  await prisma.enrollment.create({
    data: {
      studentId: student!.id,
      orgId: organizationId,
      yearId,
      classSectionId: classSection.id,
      status: EnrollmentStatus.ACTIVE,
    },
  });

  return classSection;
}

async function createDefenseTest(params: {
  organizationId: string;
  yearId: string;
  subjectId: string;
  topicLevelId: string;
  creatorId: string;
  title: string;
  status: PublishStatus;
}) {
  const test = await prisma.test.create({
    data: {
      organizationId: params.organizationId,
      academicYearId: params.yearId,
      subjectId: params.subjectId,
      creatorId: params.creatorId,
      title: params.title,
      description: 'Ukázkový test pro obhajobu bakalářské práce.',
      allowedGrades: [SchoolGrade.GRADE_7],
      status: params.status,
      publishedAt: params.status === PublishStatus.PUBLISHED ? new Date() : null,
      assignments: {
        create: {
          topicLevelId: params.topicLevelId,
          isPrimary: true,
          order: 1,
        },
      },
    },
  });

  for (const [index, question] of QUESTIONS.entries()) {
    await prisma.question.create({
      data: {
        testId: test.id,
        text: question.text,
        type: question.type,
        order: index + 1,
        score: 1,
        correctAnswer: question.correctAnswer,
        correctAnswers: [],
        options: {
          create: question.options.map((text) => ({ text })),
        },
      },
    });
  }

  return test;
}

async function createSubmittedResult(params: {
  organizationId: string;
  studentId: string;
  assignmentId: string;
  testId: string;
}) {
  const questions = await prisma.question.findMany({
    where: { testId: params.testId },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });
  if (questions.length !== 3) throw new Error('Seedovaný test nemá přesně 3 otázky.');
  const [firstQuestion, secondQuestion, thirdQuestion] = questions as [
    typeof questions[number],
    typeof questions[number],
    typeof questions[number],
  ];

  const submittedAt = new Date();
  const submission = await prisma.submission.create({
    data: {
      organizationId: params.organizationId,
      studentId: params.studentId,
      assignmentId: params.assignmentId,
      testId: params.testId,
      attemptNo: 1,
      status: SubmissionStatus.PENDING,
      responses: {
        create: [
          {
            questionId: firstQuestion.id,
            givenText: 'být',
            isCorrect: true,
            awardedPoints: 1,
            maxPoints: 1,
            correctAnswerSnapshot: 'být',
            questionTextSnapshot: firstQuestion.text,
            corrected: true,
          },
          {
            questionId: secondQuestion.id,
            givenText: 'i',
            isCorrect: false,
            awardedPoints: 0,
            maxPoints: 1,
            correctAnswerSnapshot: 'y',
            questionTextSnapshot: secondQuestion.text,
            corrected: true,
          },
          {
            questionId: thirdQuestion.id,
            givenText: 'true',
            isCorrect: true,
            awardedPoints: 1,
            maxPoints: 1,
            correctAnswerSnapshot: 'true',
            questionTextSnapshot: thirdQuestion.text,
            corrected: true,
          },
        ],
      },
    },
  });

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      submittedAt,
      status: SubmissionStatus.APPROVED,
      score: 2 / 3,
      earnedPoints: 2,
      maxPoints: 3,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      entityType: AuditEntityType.TEST,
      entityId: submission.id,
      action: 'DEFENSE_SCREENSHOT_SEED_SUBMISSION',
      metadata: { score: '2/3', testTitle: TEST_TITLE } as Prisma.InputJsonValue,
    },
  });
}

async function main() {
  const organization = requireEntity(
    await prisma.organization.findFirst({
      where: { name: ORG_NAME, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    `Nenalezena organizace ${ORG_NAME}. Nejdřív spusť npm run seed:full v server/.`,
  );

  const [teacher, studentD, studentA] = await Promise.all([
    findMembership(TEACHER_EMAIL, organization.id, OrganizationRole.TEACHER),
    findMembership(STUDENT_D_EMAIL, organization.id, OrganizationRole.STUDENT),
    findMembership(STUDENT_A_EMAIL, organization.id, OrganizationRole.STUDENT),
  ]);

  await archiveDirtyTests(organization.id);
  await deleteTestsByTitle(organization.id, [TEST_TITLE, DRAFT_TITLE]);

  const year = await ensureCurrentYear(organization.id);
  const { subject, topicLevel, orgSubject } = await ensureSubjectModel(organization.id);
  const studentDClass = await ensureStudentClass(organization.id, year.id, studentD.id);

  await prisma.classSectionOrgSubject.upsert({
    where: {
      classSectionId_orgSubjectId: {
        classSectionId: studentDClass.id,
        orgSubjectId: orgSubject.id,
      },
    },
    update: {},
    create: {
      classSectionId: studentDClass.id,
      orgSubjectId: orgSubject.id,
    },
  });

  const publishedTest = await createDefenseTest({
    organizationId: organization.id,
    yearId: year.id,
    subjectId: subject.id,
    topicLevelId: topicLevel.id,
    creatorId: teacher.id,
    title: TEST_TITLE,
    status: PublishStatus.PUBLISHED,
  });

  await createDefenseTest({
    organizationId: organization.id,
    yearId: year.id,
    subjectId: subject.id,
    topicLevelId: topicLevel.id,
    creatorId: teacher.id,
    title: DRAFT_TITLE,
    status: PublishStatus.DRAFT,
  });

  await prisma.assignment.create({
    data: {
      organizationId: organization.id,
      yearId: year.id,
      testId: publishedTest.id,
      targetType: 'CLASS',
      classSectionId: studentDClass.id,
      topicLevelId: topicLevel.id,
      openAt: new Date('2025-09-02T08:00:00.000Z'),
      closeAt: new Date('2026-08-30T18:00:00.000Z'),
      maxAttempts: 3,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher.id,
    },
  });

  const studentAAssignment = await prisma.assignment.create({
    data: {
      organizationId: organization.id,
      yearId: year.id,
      testId: publishedTest.id,
      targetType: 'STUDENTS',
      topicLevelId: topicLevel.id,
      openAt: new Date('2025-09-02T08:00:00.000Z'),
      closeAt: new Date('2026-08-30T18:00:00.000Z'),
      maxAttempts: 1,
      shuffle: false,
      showExplain: 'after_submit',
      createdById: teacher.id,
      students: {
        create: {
          studentId: studentA.id,
        },
      },
    },
  });

  await createSubmittedResult({
    organizationId: organization.id,
    studentId: studentA.id,
    assignmentId: studentAAssignment.id,
    testId: publishedTest.id,
  });

  console.log('Defense screenshot seed hotov.');
  console.log(`Organizace: ${organization.name}`);
  console.log(`Učitel: ${TEACHER_EMAIL}`);
  console.log(`Žák pro vyplnění: ${STUDENT_D_EMAIL}`);
  console.log(`Žák s hotovým výsledkem: ${STUDENT_A_EMAIL}`);
  console.log(`Test: ${TEST_TITLE}`);
  console.log(`Koncept pro editaci: ${DRAFT_TITLE}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
