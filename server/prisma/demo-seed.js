const {
  PrismaClient,
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  EnrollmentStatus,
  UserStatus,
} = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';
const DEMO = {
  organizationName: 'SkillStorm Demo School',
  classSection: { grade: SchoolGrade.GRADE_8, section: 'A', label: '8.A Demo' },
  director: {
    email: 'director.demo@skillstorm.local',
    username: 'director.demo',
    name: 'Demo Director',
    role: OrganizationRole.DIRECTOR,
  },
  teacher: {
    email: 'teacher.demo@skillstorm.local',
    username: 'teacher.demo',
    name: 'Demo Teacher',
    role: OrganizationRole.TEACHER,
  },
  student: {
    email: 'student.demo@skillstorm.local',
    username: 'student.demo',
    name: 'Demo Student',
    role: OrganizationRole.STUDENT,
  },
  test: {
    title: 'Demo test: Zlomky a logika',
    description: 'Krátký demo test pro živou ukázku o 3 otázkách.',
  },
  invites: {
    studentOrgOnly: {
      token: 'demo-student-org-invite',
      code: 'DEMO-STUDENT',
      role: OrganizationRole.STUDENT,
      type: 'ORG_ONLY',
    },
    teacherOrgOnly: {
      token: 'demo-teacher-org-invite',
      code: 'DEMO-TEACHER',
      role: OrganizationRole.TEACHER,
      type: 'ORG_ONLY',
    },
    studentClass: {
      token: 'demo-class-student-invite',
      code: 'DEMO-8A',
      role: OrganizationRole.STUDENT,
      type: 'STUDENT_CLASS',
    },
  },
};

const DEFAULT_SUBJECTS = [
  { name: 'Matematika', gradeFrom: 1, gradeTo: 9 },
  { name: 'Český jazyk', gradeFrom: 1, gradeTo: 9 },
  { name: 'Anglický jazyk', gradeFrom: 1, gradeTo: 9 },
  { name: 'Prvouka', gradeFrom: 1, gradeTo: 3 },
  { name: 'Přírodověda', gradeFrom: 4, gradeTo: 5 },
  { name: 'Vlastivěda', gradeFrom: 4, gradeTo: 5 },
  { name: 'Přírodopis', gradeFrom: 6, gradeTo: 9 },
  { name: 'Fyzika', gradeFrom: 6, gradeTo: 9 },
  { name: 'Chemie', gradeFrom: 8, gradeTo: 9 },
  { name: 'Dějepis', gradeFrom: 6, gradeTo: 9 },
  { name: 'Zeměpis', gradeFrom: 6, gradeTo: 9 },
  { name: 'Informatika', gradeFrom: 1, gradeTo: 9 },
];

function getCurrentAcademicYear() {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startYear = month >= 8 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  return {
    label: `${startYear}/${endYear}`,
    startsAt: new Date(Date.UTC(startYear, 8, 1, 0, 0, 0)),
    endsAt: new Date(Date.UTC(endYear, 7, 31, 23, 59, 59)),
  };
}

async function ensureOrganization() {
  const existing = await prisma.organization.findFirst({
    where: { name: DEMO.organizationName, deletedAt: null },
  });

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        type: OrganizationType.SCHOOL,
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }

  return prisma.organization.create({
    data: {
      name: DEMO.organizationName,
      type: OrganizationType.SCHOOL,
      status: OrganizationStatus.ACTIVE,
    },
  });
}

async function ensureAcademicYear(orgId) {
  const current = getCurrentAcademicYear();

  await prisma.academicYear.updateMany({
    where: { orgId, isCurrent: true, label: { not: current.label } },
    data: { isCurrent: false },
  });

  const existing = await prisma.academicYear.findFirst({
    where: { orgId, label: current.label },
  });

  if (existing) {
    return prisma.academicYear.update({
      where: { id: existing.id },
      data: {
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        isCurrent: true,
        deletedAt: null,
      },
    });
  }

  return prisma.academicYear.create({
    data: {
      orgId,
      label: current.label,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      isCurrent: true,
    },
  });
}

async function ensureDefaultSubjects(organizationId) {
  await prisma.subject.createMany({
    data: DEFAULT_SUBJECTS.map((subject) => ({
      name: subject.name,
      gradeFrom: subject.gradeFrom,
      gradeTo: subject.gradeTo,
    })),
    skipDuplicates: true,
  });
}

async function ensureDefaultOrgSubjects(organizationId) {
  const subjects = await prisma.subject.findMany({
    where: {
      deletedAt: null,
    },
    select: { id: true },
  });

  await prisma.orgSubject.createMany({
    data: subjects.map((subject) => ({
      organizationId,
      subjectId: subject.id,
      isEnabled: true,
      isCustom: false,
    })),
    skipDuplicates: true,
  });
}

async function ensureUser(input) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        username: input.username,
        name: input.name,
        passwordHash,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }

  return prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      name: input.name,
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
}

async function ensureMembership(userId, organizationId, role) {
  const existing = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (existing) {
    return prisma.membership.update({
      where: { id: existing.id },
      data: { role, deletedAt: null },
    });
  }

  return prisma.membership.create({
    data: {
      userId,
      organizationId,
      role,
    },
  });
}

async function ensureLastActiveMembership(userId, membershipId) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveMembershipId: membershipId },
  });
}

async function ensureTeacher(membershipId, organizationId) {
  const existing = await prisma.teacher.findUnique({
    where: { membershipId },
  });

  if (existing) {
    return prisma.teacher.update({
      where: { id: existing.id },
      data: {
        organizationId,
        deletedAt: null,
      },
    });
  }

  return prisma.teacher.create({
    data: {
      membershipId,
      organizationId,
    },
  });
}

async function ensureStudent(membershipId, orgId) {
  const existing = await prisma.student.findUnique({
    where: { membershipId },
  });

  if (existing) {
    return prisma.student.update({
      where: { id: existing.id },
      data: {
        orgId,
        deletedAt: null,
        studentNumber: 'DEMO-001',
      },
    });
  }

  return prisma.student.create({
    data: {
      membershipId,
      orgId,
      studentNumber: 'DEMO-001',
    },
  });
}

async function ensureClassSection(orgId, yearId, teacherId) {
  const existing = await prisma.classSection.findUnique({
    where: {
      orgId_yearId_grade_section: {
        orgId,
        yearId,
        grade: DEMO.classSection.grade,
        section: DEMO.classSection.section,
      },
    },
  });

  if (existing) {
    return prisma.classSection.update({
      where: { id: existing.id },
      data: {
        label: DEMO.classSection.label,
        teacherId,
      },
    });
  }

  return prisma.classSection.create({
    data: {
      orgId,
      yearId,
      grade: DEMO.classSection.grade,
      section: DEMO.classSection.section,
      label: DEMO.classSection.label,
      teacherId,
    },
  });
}

async function ensureEnrollment(studentId, classSectionId, yearId, orgId) {
  const existing = await prisma.enrollment.findFirst({
    where: { studentId, yearId },
  });

  if (existing) {
    return prisma.enrollment.update({
      where: { id: existing.id },
      data: {
        classSectionId,
        orgId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
  }

  return prisma.enrollment.create({
    data: {
      studentId,
      classSectionId,
      yearId,
      orgId,
      status: EnrollmentStatus.ACTIVE,
    },
  });
}

async function ensureTest(orgId, creatorId) {
  const existing = await prisma.test.findFirst({
    where: {
      organizationId: orgId,
      title: DEMO.test.title,
      deletedAt: null,
    },
  });

  if (existing) {
    return prisma.test.update({
      where: { id: existing.id },
      data: {
        description: DEMO.test.description,
        creatorId,
        status: PublishStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  return prisma.test.create({
    data: {
      organizationId: orgId,
      title: DEMO.test.title,
      description: DEMO.test.description,
      creatorId,
      status: PublishStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
}

async function ensureQuestion(params) {
  const existing = await prisma.question.findFirst({
    where: {
      testId: params.testId,
      text: params.text,
    },
  });

  const question = existing
    ? await prisma.question.update({
        where: { id: existing.id },
        data: {
          text: params.text,
          type: params.type,
          order: params.order,
          score: params.score,
          correctAnswer: params.correctAnswer ?? null,
          correctAnswers: params.correctAnswers ?? [],
        },
      })
    : await prisma.question.create({
        data: {
          testId: params.testId,
          text: params.text,
          type: params.type,
          order: params.order,
          score: params.score,
          correctAnswer: params.correctAnswer ?? null,
          correctAnswers: params.correctAnswers ?? [],
        },
      });

  if (params.options) {
    await prisma.option.deleteMany({ where: { questionId: question.id } });
    await prisma.option.createMany({
      data: params.options.map((text) => ({ questionId: question.id, text })),
    });
  }

  return question;
}

async function ensureDemoQuestions(testId) {
  await ensureQuestion({
    testId,
    text: 'Je 1/2 větší než 1/3?',
    type: QuestionType.TRUE_FALSE,
    order: 1,
    score: 1,
    correctAnswer: 'true',
  });

  await ensureQuestion({
    testId,
    text: 'Kolik je 2 + 2?',
    type: QuestionType.MULTIPLE_CHOICE,
    order: 2,
    score: 1,
    correctAnswer: '4',
    options: ['3', '4', '5'],
  });

  await ensureQuestion({
    testId,
    text: 'Doplň výsledek: 10 / 2 = __',
    type: QuestionType.FILL_IN_THE_BLANK,
    order: 3,
    score: 1,
    correctAnswer: '5',
  });
}

async function ensureAssignment(organizationId, yearId, testId, classSectionId, createdById) {
  const existing = await prisma.assignment.findFirst({
    where: {
      organizationId,
      testId,
      classSectionId,
    },
  });

  const openAt = new Date();
  const closeAt = new Date(openAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (existing) {
    return prisma.assignment.update({
      where: { id: existing.id },
      data: {
        yearId,
        openAt,
        closeAt,
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'after_finish',
        createdById,
      },
    });
  }

  return prisma.assignment.create({
    data: {
      organizationId,
      yearId,
      testId,
      targetType: 'CLASS',
      classSectionId,
      openAt,
      closeAt,
      maxAttempts: 1,
      shuffle: false,
      showExplain: 'after_finish',
      createdById,
    },
  });
}

async function ensureInvite({
  organizationId,
  role,
  type,
  token,
  code,
  classSectionId = null,
  yearId = null,
}) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const existing = await prisma.invite.findFirst({
    where: {
      OR: [{ token }, { code }],
    },
    select: { id: true },
  });

  const data = {
    organizationId,
    role,
    type,
    token,
    code,
    classSectionId,
    yearId,
    expiresAt,
    maxUses: 25,
    usedCount: 0,
    revokedAt: null,
  };

  if (existing) {
    return prisma.invite.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.invite.create({ data });
}

async function resetDemoSubmission(assignmentId, studentMembershipId) {
  const submissions = await prisma.submission.findMany({
    where: {
      assignmentId,
      studentId: studentMembershipId,
    },
    select: { id: true },
  });

  if (submissions.length === 0) return;

  const submissionIds = submissions.map((submission) => submission.id);
  await prisma.response.deleteMany({
    where: { submissionId: { in: submissionIds } },
  });
  await prisma.submission.deleteMany({
    where: { id: { in: submissionIds } },
  });
}

async function runDemoSeed() {
  const organization = await ensureOrganization();
  await ensureDefaultSubjects(organization.id);
  await ensureDefaultOrgSubjects(organization.id);
  const academicYear = await ensureAcademicYear(organization.id);

  const directorUser = await ensureUser(DEMO.director);
  const directorMembership = await ensureMembership(
    directorUser.id,
    organization.id,
    DEMO.director.role,
  );
  await ensureLastActiveMembership(directorUser.id, directorMembership.id);

  const teacherUser = await ensureUser(DEMO.teacher);
  const teacherMembership = await ensureMembership(
    teacherUser.id,
    organization.id,
    DEMO.teacher.role,
  );
  await ensureLastActiveMembership(teacherUser.id, teacherMembership.id);
  const teacher = await ensureTeacher(teacherMembership.id, organization.id);

  const classSection = await ensureClassSection(
    organization.id,
    academicYear.id,
    teacher.id,
  );

  const studentUser = await ensureUser(DEMO.student);
  const studentMembership = await ensureMembership(
    studentUser.id,
    organization.id,
    DEMO.student.role,
  );
  await ensureLastActiveMembership(studentUser.id, studentMembership.id);
  const student = await ensureStudent(studentMembership.id, organization.id);
  await ensureEnrollment(student.id, classSection.id, academicYear.id, organization.id);

  const test = await ensureTest(organization.id, teacherMembership.id);
  await ensureDemoQuestions(test.id);

  const assignment = await ensureAssignment(
    organization.id,
    academicYear.id,
    test.id,
    classSection.id,
    teacherMembership.id,
  );

  await resetDemoSubmission(assignment.id, studentMembership.id);

  const studentInvite = await ensureInvite({
    organizationId: organization.id,
    role: DEMO.invites.studentOrgOnly.role,
    type: DEMO.invites.studentOrgOnly.type,
    token: DEMO.invites.studentOrgOnly.token,
    code: DEMO.invites.studentOrgOnly.code,
  });
  const teacherInvite = await ensureInvite({
    organizationId: organization.id,
    role: DEMO.invites.teacherOrgOnly.role,
    type: DEMO.invites.teacherOrgOnly.type,
    token: DEMO.invites.teacherOrgOnly.token,
    code: DEMO.invites.teacherOrgOnly.code,
  });
  const classInvite = await ensureInvite({
    organizationId: organization.id,
    role: DEMO.invites.studentClass.role,
    type: DEMO.invites.studentClass.type,
    token: DEMO.invites.studentClass.token,
    code: DEMO.invites.studentClass.code,
    classSectionId: classSection.id,
    yearId: academicYear.id,
  });

  console.log('\n--- DEMO PROFILE READY ---');
  console.log(`Organization: ${organization.name}`);
  console.log(`Academic year: ${academicYear.label}`);
  console.log(`Director: ${DEMO.director.email} / ${DEMO_PASSWORD}`);
  console.log(`Teacher: ${DEMO.teacher.email} / ${DEMO_PASSWORD}`);
  console.log(`Student: ${DEMO.student.email} / ${DEMO_PASSWORD}`);
  console.log(`Test: ${test.title}`);
  console.log(`Student invite code: ${studentInvite.code}`);
  console.log(`Teacher invite code: ${teacherInvite.code}`);
  console.log(`Class invite code: ${classInvite.code}`);
  console.log('Assignment window: open now, closes in 7 days, maxAttempts=1');
  console.log('--- END DEMO PROFILE ---\n');
}

module.exports = {
  runDemoSeed,
};
