import {
  PrismaClient,
  OrganizationRole,
  OrganizationType,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  EnrollmentStatus,
  SystemRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

function requireItem<T>(items: T[], index: number, label: string): T {
  const item = items[index];
  if (!item) {
    throw new Error(`Seed invariant failed: missing ${label}`);
  }
  return item;
}

type EnsureUserInput = {
  email: string;
  username: string;
  name: string;
  systemRole?: SystemRole | null;
};

type EnsureMembershipInput = {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  deletedAt?: Date | null;
};

type EnsureClassSectionInput = {
  orgId: string;
  yearId: string;
  grade: SchoolGrade;
  section: string;
  label: string;
  teacherId?: string | null;
};

async function ensureOrganization(name: string, type: OrganizationType) {
  const existing = await prisma.organization.findFirst({
    where: { name, type, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.organization.create({
    data: { name, type },
  });
}

async function ensureAcademicYear(orgId: string, label = 'DEFAULT') {
  const existing = await prisma.academicYear.findFirst({
    where: { orgId, label },
  });
  if (existing) return existing;
  const startsAt = new Date('2025-09-01T00:00:00.000Z');
  const endsAt = new Date('2026-06-30T23:59:59.000Z');
  return prisma.academicYear.create({
    data: {
      orgId,
      label,
      startsAt,
      endsAt,
      isCurrent: true,
    },
  });
}

async function ensureUser(input: EnsureUserInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    if (input.systemRole && existing.systemRole !== input.systemRole) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          username: input.username,
          name: input.name,
          systemRole: input.systemRole,
        },
      });
    }
    if (existing.username !== input.username || existing.name !== input.name) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { username: input.username, name: input.name },
      });
    }
    return existing;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      name: input.name,
      passwordHash,
      systemRole: input.systemRole ?? null,
    },
  });
}

async function ensureMembership(input: EnsureMembershipInput) {
  const existing = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: input.userId,
        organizationId: input.organizationId,
      },
    },
  });

  if (existing) {
    return prisma.membership.update({
      where: { id: existing.id },
      data: {
        role: input.role,
        deletedAt: input.deletedAt ?? null,
      },
    });
  }

  return prisma.membership.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
      deletedAt: input.deletedAt ?? null,
    },
  });
}

async function ensureTeacher(membershipId: string, organizationId: string) {
  const existing = await prisma.teacher.findUnique({
    where: { membershipId },
  });
  if (existing) {
    if (existing.deletedAt) {
      return prisma.teacher.update({
        where: { id: existing.id },
        data: { deletedAt: null, organizationId },
      });
    }
    return existing;
  }
  return prisma.teacher.create({
    data: { membershipId, organizationId },
  });
}

async function ensureStudent(membershipId: string, orgId: string) {
  const existing = await prisma.student.findUnique({
    where: { membershipId },
  });
  if (existing) {
    if (existing.deletedAt) {
      return prisma.student.update({
        where: { id: existing.id },
        data: { deletedAt: null, orgId },
      });
    }
    return existing;
  }
  return prisma.student.create({
    data: { membershipId, orgId },
  });
}

async function ensureClassSection(input: EnsureClassSectionInput) {
  const existing = await prisma.classSection.findUnique({
    where: {
      orgId_yearId_grade_section: {
        orgId: input.orgId,
        yearId: input.yearId,
        grade: input.grade,
        section: input.section,
      },
    },
  });

  if (existing) {
    return prisma.classSection.update({
      where: { id: existing.id },
      data: { label: input.label, teacherId: input.teacherId ?? null },
    });
  }

  return prisma.classSection.create({
    data: {
      orgId: input.orgId,
      yearId: input.yearId,
      grade: input.grade,
      section: input.section,
      label: input.label,
      teacherId: input.teacherId ?? null,
    },
  });
}

async function ensureEnrollment(
  studentId: string,
  classSectionId: string,
  yearId: string,
  status: EnrollmentStatus,
) {
  // Uniqueness is enforced in the service layer to allow enrollment history.
  const existing = await prisma.enrollment.findFirst({
    where: {
      studentId,
      yearId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.enrollment.update({
      where: { id: existing.id },
      data: { classSectionId, status },
    });
  }

  return prisma.enrollment.create({
    data: { studentId, classSectionId, yearId, status },
  });
}

async function ensureSubject(orgId: string, name: string) {
  const existing = await prisma.subject.findFirst({
    where: { organizationId: orgId, name, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.subject.create({
    data: { organizationId: orgId, name },
  });
}

async function ensureTeacherSubject(teacherId: string, subjectId: string) {
  const existing = await prisma.teacherSubject.findUnique({
    where: { teacherId_subjectId: { teacherId, subjectId } },
  });
  if (existing) return existing;
  return prisma.teacherSubject.create({
    data: { teacherId, subjectId },
  });
}

async function ensureTest(
  orgId: string,
  creatorId: string,
  title: string,
  status: PublishStatus,
  description?: string,
) {
  const existing = await prisma.test.findFirst({
    where: { organizationId: orgId, title, deletedAt: null },
  });
  if (existing) {
    return prisma.test.update({
      where: { id: existing.id },
      data: {
        description: description ?? null,
        status,
        creatorId,
      },
    });
  }
  return prisma.test.create({
    data: {
      organizationId: orgId,
      title,
      description: description ?? null,
      status,
      creatorId,
    },
  });
}

async function ensureQuestion(params: {
  testId: string;
  text: string;
  type: QuestionType;
  order: number;
  score: number;
  correctAnswer?: string | null;
  correctAnswers?: string[];
  options?: string[];
}) {
  const existing = await prisma.question.findFirst({
    where: { testId: params.testId, text: params.text },
  });

  const data = {
    text: params.text,
    type: params.type,
    order: params.order,
    score: params.score,
    correctAnswer: params.correctAnswer ?? null,
    correctAnswers: params.correctAnswers ?? [],
  };

  const question = existing
    ? await prisma.question.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.question.create({
        data: { ...data, testId: params.testId },
      });

  if (params.options) {
    await prisma.option.deleteMany({ where: { questionId: question.id } });
    await prisma.option.createMany({
      data: params.options.map((text) => ({ questionId: question.id, text })),
      skipDuplicates: true,
    });
  }

  return question;
}

async function ensureAssignment(params: {
  orgId: string;
  testId: string;
  classSectionId: string;
  createdById: string;
}) {
  const existing = await prisma.assignment.findFirst({
    where: {
      organizationId: params.orgId,
      testId: params.testId,
      classSectionId: params.classSectionId,
    },
  });

  const openAt = new Date('2025-01-15T08:00:00.000Z');
  const closeAt = new Date('2025-01-15T12:00:00.000Z');

  if (existing) {
    return prisma.assignment.update({
      where: { id: existing.id },
      data: {
        openAt,
        closeAt,
        maxAttempts: 2,
        shuffle: true,
        showExplain: 'after_close',
      },
    });
  }

  return prisma.assignment.create({
    data: {
      organizationId: params.orgId,
      testId: params.testId,
      targetType: 'CLASS',
      classSectionId: params.classSectionId,
      topicLevelId: null,
      openAt,
      closeAt,
      maxAttempts: 2,
      shuffle: true,
      showExplain: 'after_close',
      createdById: params.createdById,
    },
  });
}

async function ensureSubmission(params: {
  assignmentId: string | null;
  testId: string;
  studentMembershipId: string;
  status: 'APPROVED' | 'REJECTED';
  score: number | null;
  submittedAt?: Date;
  responses: Array<{ questionId: string; givenText: string; isCorrect: boolean }>;
}) {
  const existing = await prisma.submission.findFirst({
    where: {
      assignmentId: params.assignmentId,
      testId: params.testId,
      studentId: params.studentMembershipId,
      attemptNo: 1,
    },
  });

  const submittedAt = params.submittedAt ?? new Date('2025-01-15T09:00:00.000Z');
  const data = {
    assignmentId: params.assignmentId,
    testId: params.testId,
    studentId: params.studentMembershipId,
    status: params.status,
    score: params.score,
    submittedAt,
    attemptNo: 1,
  };

  const submission = existing
    ? await prisma.submission.update({ where: { id: existing.id }, data })
    : await prisma.submission.create({ data });

  await prisma.response.deleteMany({ where: { submissionId: submission.id } });
  if (params.responses.length > 0) {
    await prisma.response.createMany({
      data: params.responses.map((r) => ({
        submissionId: submission.id,
        questionId: r.questionId,
        givenText: r.givenText,
        isCorrect: r.isCorrect,
      })),
    });
  }

  return submission;
}

async function main() {
  if (process.env.SEED_MODE && process.env.SEED_MODE !== 'demo') {
    console.log(`SEED_MODE=${process.env.SEED_MODE} → skipping demo seed`);
    return;
  }

  console.log('🌱 Seeding demo data (deterministic, idempotent)...');

  // 1) Organizations
  const primaryOrg = await ensureOrganization(
    'Primary School',
    OrganizationType.SCHOOL,
  );
  const secondaryOrg = await ensureOrganization(
    'Secondary Org',
    OrganizationType.SCHOOL,
  );

  // 2) Users
  const directorUser = await ensureUser({
    email: 'director@skillstorm.local',
    username: 'director',
    name: 'Primary Director',
  });
  const teacherUserA = await ensureUser({
    email: 'teacher.a@skillstorm.local',
    username: 'teacher_a',
    name: 'Teacher A',
  });
  const teacherUserB = await ensureUser({
    email: 'teacher.b@skillstorm.local',
    username: 'teacher_b',
    name: 'Teacher B',
  });
  const studentUsers = await Promise.all(
    Array.from({ length: 6 }).map((_, idx) =>
      ensureUser({
        email: `student${idx + 1}@skillstorm.local`,
        username: `student_${idx + 1}`,
        name: `Student ${idx + 1}`,
      }),
    ),
  );
  const superadminUser = await ensureUser({
    email: 'superadmin@skillstorm.local',
    username: 'superadmin',
    name: 'Superadmin',
    systemRole: SystemRole.SUPERADMIN,
  });

  // 3) Memberships
  const directorMembership = await ensureMembership({
    userId: directorUser.id,
    organizationId: primaryOrg.id,
    role: OrganizationRole.DIRECTOR,
  });
  const teacherMembershipA = await ensureMembership({
    userId: teacherUserA.id,
    organizationId: primaryOrg.id,
    role: OrganizationRole.TEACHER,
  });
  const teacherMembershipB = await ensureMembership({
    userId: teacherUserB.id,
    organizationId: primaryOrg.id,
    role: OrganizationRole.TEACHER,
  });
  const studentMemberships = await Promise.all(
    studentUsers.map((u) =>
      ensureMembership({
        userId: u.id,
        organizationId: primaryOrg.id,
        role: OrganizationRole.STUDENT,
      }),
    ),
  );
  const studentMembership0 = requireItem(studentMemberships, 0, 'studentMemberships[0]');
  const studentMembership1 = requireItem(studentMemberships, 1, 'studentMemberships[1]');
  const studentMembership4 = requireItem(studentMemberships, 4, 'studentMemberships[4]');
  const superadminMembershipPrimary = await ensureMembership({
    userId: superadminUser.id,
    organizationId: primaryOrg.id,
    role: OrganizationRole.DIRECTOR,
  });
  const superadminMembershipSecondary = await ensureMembership({
    userId: superadminUser.id,
    organizationId: secondaryOrg.id,
    role: OrganizationRole.DIRECTOR,
  });

  // One soft-deleted membership (edge case)
  await ensureMembership({
    userId: teacherUserB.id,
    organizationId: secondaryOrg.id,
    role: OrganizationRole.TEACHER,
    deletedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  // 4) AcademicYear + ClassSections
  const yearPrimary = await ensureAcademicYear(primaryOrg.id);
  const teacherA = await ensureTeacher(teacherMembershipA.id, primaryOrg.id);
  const teacherB = await ensureTeacher(teacherMembershipB.id, primaryOrg.id);

  const class1A = await ensureClassSection({
    orgId: primaryOrg.id,
    yearId: yearPrimary.id,
    grade: SchoolGrade.GRADE_1,
    section: 'A',
    label: '1.A',
    teacherId: teacherA.id,
  });
  const class1B = await ensureClassSection({
    orgId: primaryOrg.id,
    yearId: yearPrimary.id,
    grade: SchoolGrade.GRADE_1,
    section: 'B',
    label: '1.B',
    teacherId: teacherB.id,
  });
  const class2A = await ensureClassSection({
    orgId: primaryOrg.id,
    yearId: yearPrimary.id,
    grade: SchoolGrade.GRADE_2,
    section: 'A',
    label: '2.A',
    teacherId: teacherA.id,
  });

  // 5) Students + Enrollments
  const studentEntities = await Promise.all(
    studentMemberships.map((m) => ensureStudent(m.id, primaryOrg.id)),
  );
  const studentEntity0 = requireItem(studentEntities, 0, 'studentEntities[0]');
  const studentEntity1 = requireItem(studentEntities, 1, 'studentEntities[1]');
  const studentEntity2 = requireItem(studentEntities, 2, 'studentEntities[2]');
  const studentEntity3 = requireItem(studentEntities, 3, 'studentEntities[3]');
  const studentEntity4 = requireItem(studentEntities, 4, 'studentEntities[4]');

  // Even distribution; student6 stays without enrollment
  await ensureEnrollment(
    studentEntity0.id,
    class1A.id,
    yearPrimary.id,
    EnrollmentStatus.ACTIVE,
  );
  await ensureEnrollment(
    studentEntity1.id,
    class1A.id,
    yearPrimary.id,
    EnrollmentStatus.ACTIVE,
  );
  await ensureEnrollment(
    studentEntity2.id,
    class1B.id,
    yearPrimary.id,
    EnrollmentStatus.ACTIVE,
  );
  await ensureEnrollment(
    studentEntity3.id,
    class1B.id,
    yearPrimary.id,
    EnrollmentStatus.ACTIVE,
  );
  await ensureEnrollment(
    studentEntity4.id,
    class2A.id,
    yearPrimary.id,
    EnrollmentStatus.LEFT,
  );

  // 6) Subjects
  const subjectMath = await ensureSubject(primaryOrg.id, 'Math');
  const subjectCzech = await ensureSubject(primaryOrg.id, 'Czech');
  const subjectEnglish = await ensureSubject(primaryOrg.id, 'English');
  await ensureTeacherSubject(teacherA.id, subjectMath.id);
  await ensureTeacherSubject(teacherB.id, subjectCzech.id);
  await ensureTeacherSubject(teacherA.id, subjectEnglish.id);

  // 7) Tests
  const testA = await ensureTest(
    primaryOrg.id,
    teacherMembershipA.id,
    'Test A – scoreable',
    PublishStatus.PUBLISHED,
    'Validní test pro core flow.',
  );

  const testB = await ensureTest(
    primaryOrg.id,
    teacherMembershipA.id,
    'Test B – draft',
    PublishStatus.DRAFT,
    'Draft s nevyplněnou odpovědí.',
  );

  const testC = await ensureTest(
    primaryOrg.id,
    teacherMembershipA.id,
    'Test C – unscorable',
    PublishStatus.PUBLISHED,
    'Publikovaný test bez správné odpovědi.',
  );

  const qA1 = await ensureQuestion({
    testId: testA.id,
    text: 'Is 1 < 2?',
    type: QuestionType.TRUE_FALSE,
    order: 1,
    score: 1,
    correctAnswer: 'true',
  });
  const qA2 = await ensureQuestion({
    testId: testA.id,
    text: 'Pick one',
    type: QuestionType.MULTIPLE_CHOICE,
    order: 2,
    score: 1,
    correctAnswer: 'A',
    options: ['A', 'B', 'C'],
  });
  const qA3 = await ensureQuestion({
    testId: testA.id,
    text: 'Pick two',
    type: QuestionType.MULTIPLE_CHOICE,
    order: 3,
    score: 1,
    correctAnswers: ['A', 'C'],
    options: ['A', 'B', 'C', 'D'],
  });

  await ensureQuestion({
    testId: testB.id,
    text: 'Missing answer',
    type: QuestionType.TRUE_FALSE,
    order: 1,
    score: 1,
  });

  await ensureQuestion({
    testId: testC.id,
    text: 'Unscorable question',
    type: QuestionType.FILL_IN_THE_BLANK,
    order: 1,
    score: 1,
  });

  // 8) Assignments (only Test A)
  const assignmentA = await ensureAssignment({
    orgId: primaryOrg.id,
    testId: testA.id,
    classSectionId: class1A.id,
    createdById: teacherMembershipA.id,
  });

  // 9) Submissions
  await ensureSubmission({
    assignmentId: assignmentA.id,
    testId: testA.id,
    studentMembershipId: studentMembership0.id,
    status: 'APPROVED',
    score: 1,
    submittedAt: new Date('2025-01-15T09:05:00.000Z'),
    responses: [
      { questionId: qA1.id, givenText: 'true', isCorrect: true },
      { questionId: qA2.id, givenText: 'A', isCorrect: true },
      { questionId: qA3.id, givenText: JSON.stringify(['A', 'C']), isCorrect: true },
    ],
  });

  await ensureSubmission({
    assignmentId: assignmentA.id,
    testId: testA.id,
    studentMembershipId: studentMembership1.id,
    status: 'APPROVED',
    score: 1 / 3,
    submittedAt: new Date('2025-01-15T09:10:00.000Z'),
    responses: [
      { questionId: qA1.id, givenText: 'false', isCorrect: false },
      { questionId: qA2.id, givenText: 'A', isCorrect: true },
      { questionId: qA3.id, givenText: JSON.stringify(['B', 'C']), isCorrect: false },
    ],
  });

  // Rejected submission for Test C (no assignment by design)
  await ensureSubmission({
    assignmentId: null,
    testId: testC.id,
    studentMembershipId: studentMembership4.id,
    status: 'REJECTED',
    score: null,
    submittedAt: new Date('2025-01-15T09:20:00.000Z'),
    responses: [],
  });

  const summary = {
    organizations: 2,
    users: 1 + 2 + 6 + 1,
    memberships: 1 + 2 + 6 + 2 + 1,
    classSections: 3,
    enrollments: 5,
    subjects: 3,
    tests: 3,
    assignments: 1,
    submissions: 3,
  };

  console.log('✅ Demo seed complete');
  console.table(summary);
  console.log('Login credentials (all):');
  console.log('Password:', DEMO_PASSWORD);
  console.log('director@skillstorm.local');
  console.log('teacher.a@skillstorm.local');
  console.log('teacher.b@skillstorm.local');
  console.log('student1@skillstorm.local ... student6@skillstorm.local');
  console.log('superadmin@skillstorm.local');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
