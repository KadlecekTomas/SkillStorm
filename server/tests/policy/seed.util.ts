import type {
  AcademicYear,
  Assignment,
  CatalogSubject,
  CatalogTopic,
  ClassSection,
  Enrollment,
  LearningMaterial,
  MaterialAssignment,
  Membership,
  Organization,
  Permission,
  PrismaClient,
  Question,
  Student,
  Subscription,
  SubscriptionPlan,
  Subject,
  SubjectLevel,
  Teacher,
  Test,
  TestAssignment,
  TopicLevel,
  User,
} from '@prisma/client';
import {
  ContentScope,
  ContentType,
  EducationLevel,
  MaterialAccessLevel,
  OrganizationRole,
  OrganizationType,
  PermissionKey,
  PlanTarget,
  Prisma,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  SubscriptionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { RBAC } from './rbac.matrix';

export interface SeededMember {
  user: User;
  membership: Membership;
  password: string;
}

export interface PolicySeedContext {
  organizations: {
    primary: Organization;
    secondary: Organization;
  };
  users: {
    owner: SeededMember;
    director: SeededMember;
    teacher: SeededMember & { teacher: Teacher };
    student: SeededMember & { student: Student };
    parent: SeededMember;
    orgBTeacher: SeededMember;
  };
  rbac: {
    permissions: Record<PermissionKey, Permission>;
  };
  academics: {
    year: AcademicYear;
    classSection: ClassSection;
    enrollment: Enrollment;
  };
  content: {
    catalogSubject: CatalogSubject;
    catalogTopic: CatalogTopic;
    subject: Subject;
    subjectLevel: SubjectLevel;
    topicLevel: TopicLevel;
    learningMaterial: LearningMaterial;
    orgBMaterial: LearningMaterial;
    materialAssignment: MaterialAssignment;
  };
  tests: {
    test: Test;
    questions: Question[];
    topicAssignment: TestAssignment;
    classAssignment: Assignment;
    orgBTest: Test;
  };
  plans: {
    schoolPlan: SubscriptionPlan;
    privatePlan: SubscriptionPlan;
    subscription: Subscription;
  };
}

const PASSWORD_BASE = 'PolicyUser#2024';

export async function resetPolicyData(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.assignmentStudent.deleteMany(),
    prisma.response.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.testAssignment.deleteMany(),
    prisma.option.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.question.deleteMany(),
    prisma.test.deleteMany(),
    prisma.materialAssignment.deleteMany(),
    prisma.learningMaterial.deleteMany(),
    prisma.topicLevel.deleteMany(),
    prisma.subjectLevel.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.catalogTopic.deleteMany(),
    prisma.catalogSubject.deleteMany(),
    prisma.studentClassroom.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.student.deleteMany(),
    prisma.teacher.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.subscriptionPlan.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.revokedToken.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function createMember(
  prisma: PrismaClient,
  org: Organization,
  role: OrganizationRole,
  ordinal: number,
): Promise<SeededMember> {
  const password = `${PASSWORD_BASE}!${ordinal}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const suffix = randomUUID().slice(0, 8);
  const email = `${role.toLowerCase()}+${suffix}@policy.local`;
  const username = `${role.toLowerCase()}_${suffix}`;
  const user = await prisma.user.create({
    data: {
      email,
      username,
      name: `${role} Policy ${ordinal}`,
      passwordHash,
    },
  });

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role,
    },
  });

  return { user, membership, password };
}

export async function seedPolicyData(
  prisma: PrismaClient,
): Promise<PolicySeedContext> {
  await resetPolicyData(prisma);

  const orgA = await prisma.organization.create({
    data: {
      name: 'Policy High School',
      type: OrganizationType.SCHOOL,
      city: 'Prague',
      country: 'CZ',
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: 'Policy Grammar School',
      type: OrganizationType.SCHOOL,
      city: 'Brno',
      country: 'CZ',
    },
  });

  const schoolPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Policy EDU',
      target: PlanTarget.SCHOOL,
      price: new Prisma.Decimal(0),
      currency: 'CZK',
      billingCycle: 'annual',
      maxUsers: 500,
      features: { tiers: ['tests', 'content', 'analytics'] },
    },
  });

  const privatePlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Policy Private',
      target: PlanTarget.PRIVATE,
      price: new Prisma.Decimal(0),
      currency: 'CZK',
      billingCycle: 'annual',
      maxUsers: 50,
      features: { tiers: ['solo'] },
    },
  });

  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);

  const subscription = await prisma.subscription.create({
    data: {
      organizationId: orgA.id,
      planId: schoolPlan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      endDate: nextYear,
    },
  });

  const permissionRecords = await Promise.all(
    Object.values(PermissionKey).map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: {
          key,
          description: `${key} policy baseline`,
          allowedTypes: [OrganizationType.SCHOOL, OrganizationType.PRIVATE],
          category: 'POLICY',
        },
      }),
    ),
  );

  const permissionMap = permissionRecords.reduce<
    Record<PermissionKey, Permission>
  >(
    (acc, permission) => {
      acc[permission.key] = permission;
      return acc;
    },
    {} as Record<PermissionKey, Permission>,
  );

  const owner = await createMember(prisma, orgA, OrganizationRole.OWNER, 1);
  const director = await createMember(
    prisma,
    orgA,
    OrganizationRole.DIRECTOR,
    2,
  );
  const teacherMember = await createMember(
    prisma,
    orgA,
    OrganizationRole.TEACHER,
    3,
  );
  const studentMember = await createMember(
    prisma,
    orgA,
    OrganizationRole.STUDENT,
    4,
  );
  const parent = await createMember(prisma, orgA, OrganizationRole.PARENT, 5);

  const teacher = await prisma.teacher.create({
    data: {
      membershipId: teacherMember.membership.id,
      organizationId: orgA.id,
    },
  });

  const student = await prisma.student.create({
    data: {
      membershipId: studentMember.membership.id,
      orgId: orgA.id,
      studentNumber: 'S-0001',
    },
  });

  const currentYear = await prisma.academicYear.create({
    data: {
      orgId: orgA.id,
      label: `${now.getFullYear()}/${now.getFullYear() + 1}`,
      startsAt: now,
      endsAt: nextYear,
      isCurrent: true,
    },
  });

  const classSection = await prisma.classSection.create({
    data: {
      orgId: orgA.id,
      yearId: currentYear.id,
      grade: SchoolGrade.GRADE_5,
      section: 'A',
      label: '5.A',
      teacherId: teacher.id,
    },
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId: student.id,
      classSectionId: classSection.id,
      yearId: currentYear.id,
      orgId: orgA.id,
      status: 'ACTIVE',
    },
  });

  const catalogSubject = await prisma.catalogSubject.create({
    data: {
      code: 'POLICY_MATH',
      name: 'Policy Mathematics',
    },
  });

  const catalogTopic = await prisma.catalogTopic.create({
    data: {
      subjectId: catalogSubject.id,
      name: 'Fractions',
    },
  });

  const subject = await prisma.subject.create({
    data: {
      organizationId: orgA.id,
      catalogSubjectId: catalogSubject.id,
      name: 'Mathematics',
    },
  });

  const subjectLevel = await prisma.subjectLevel.create({
    data: {
      subjectId: subject.id,
      grade: SchoolGrade.GRADE_5,
      order: 1,
      label: 'Grade 5',
    },
  });

  const topicLevel = await prisma.topicLevel.create({
    data: {
      subjectLevelId: subjectLevel.id,
      catalogTopicId: catalogTopic.id,
      name: 'Fractions basics',
    },
  });

  const orgBTeacher = await createMember(
    prisma,
    orgB,
    OrganizationRole.TEACHER,
    6,
  );

  const learningMaterial = await prisma.learningMaterial.create({
    data: {
      title: 'Fractions 101',
      description: 'Global material visible to everyone',
      contentType: ContentType.MATERIAL,
      educationLevel: EducationLevel.PRIMARY_1,
      schoolGrade: SchoolGrade.GRADE_5,
      subjectId: subject.id,
      topicLevelId: topicLevel.id,
      scope: ContentScope.GLOBAL,
      organizationId: orgA.id,
      createdById: teacherMember.membership.id,
      accessLevel: MaterialAccessLevel.FREE,
      isDownloadable: true,
    },
  });

  const orgBMaterial = await prisma.learningMaterial.create({
    data: {
      title: 'Org B internal handout',
      description: 'Restricted to org B',
      contentType: ContentType.MATERIAL,
      educationLevel: EducationLevel.PRIMARY_1,
      schoolGrade: SchoolGrade.GRADE_5,
      scope: ContentScope.ORGANIZATION,
      organizationId: orgB.id,
      createdById: orgBTeacher.membership.id,
      accessLevel: MaterialAccessLevel.SCHOOL_ONLY,
    },
  });

  const materialAssignment = await prisma.materialAssignment.create({
    data: {
      topicLevelId: topicLevel.id,
      materialId: learningMaterial.id,
      isPrimary: true,
      order: 1,
    },
  });

  const test = await prisma.test.create({
    data: {
      organizationId: orgA.id,
      title: 'Placement test',
      description: 'Covers fractions basics',
      status: PublishStatus.PUBLISHED,
      creatorId: teacherMember.membership.id,
      questions: {
        create: [
          {
            text: '2 + 2 = ?',
            type: QuestionType.MULTIPLE_CHOICE,
            order: 1,
            score: 1,
            correctAnswer: '4',
            correctAnswers: ['4'],
          },
          {
            text: 'Sun rises in the east.',
            type: QuestionType.TRUE_FALSE,
            order: 2,
            score: 1,
            correctAnswer: 'true',
          },
          {
            text: 'Fill the missing word: poli___.',
            type: QuestionType.FILL_IN_THE_BLANK,
            order: 3,
            score: 1,
            correctAnswer: 'cy',
          },
        ],
      },
    },
    include: { questions: true },
  });

  const orgBTest = await prisma.test.create({
    data: {
      organizationId: orgB.id,
      title: 'Org B control test',
      status: PublishStatus.DRAFT,
      creatorId: orgBTeacher.membership.id,
    },
  });

  const topicAssignment = await prisma.testAssignment.create({
    data: {
      topicLevelId: topicLevel.id,
      testId: test.id,
      isPrimary: true,
      order: 1,
    },
  });

  const assignment = await prisma.assignment.create({
    data: {
      organizationId: orgA.id,
      yearId: currentYear.id,
      testId: test.id,
      classSectionId: classSection.id,
      topicLevelId: topicLevel.id,
      openAt: new Date(now.getTime() - 60 * 60 * 1000),
      closeAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      maxAttempts: 2,
      createdById: teacherMember.membership.id,
      targetType: 'CLASS',
      showExplain: 'after_close',
      shuffle: true,
    },
  });

  // Role permissions derived from matrix
  await prisma.$transaction(
    Object.entries(RBAC).flatMap(([role, config]) => {
      const isWildcard =
        (config.permissions as (PermissionKey | '*')[])[0] === '*';
      const perms = isWildcard
        ? Object.values(PermissionKey)
        : (config.permissions as PermissionKey[]);
      return perms.map((key) =>
        prisma.rolePermission.create({
          data: {
            organizationId: orgA.id,
            role: role as OrganizationRole,
            permissionId: permissionMap[key].id,
            allowed: true,
          },
        }),
      );
    }),
  );

  return {
    organizations: { primary: orgA, secondary: orgB },
    users: {
      owner,
      director,
      teacher: { ...teacherMember, teacher },
      student: { ...studentMember, student },
      parent,
      orgBTeacher,
    },
    rbac: { permissions: permissionMap },
    academics: {
      year: currentYear,
      classSection,
      enrollment,
    },
    content: {
      catalogSubject,
      catalogTopic,
      subject,
      subjectLevel,
      topicLevel,
      learningMaterial,
      orgBMaterial,
      materialAssignment,
    },
    tests: {
      test,
      questions: test.questions,
      topicAssignment,
      classAssignment: assignment,
      orgBTest,
    },
    plans: {
      schoolPlan,
      privatePlan,
      subscription,
    },
  };
}
