import {
  AcademicYear,
  Assignment,
  ContentScope,
  ContentType,
  EducationLevel,
  Membership,
  Organization,
  OrganizationRole,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
  SystemRole,
  Teacher,
  Test,
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const classKey = (grade: SchoolGrade, section: string) => `${grade}-${section}`;

type TeacherSeed = {
  email: string;
  name: string;
  password?: string;
  homeroom?: { grade: SchoolGrade; section: string; label: string };
};

type StudentSeed = {
  email: string;
  name: string;
  password?: string;
  grade: SchoolGrade;
  section: string;
};

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function ensureUser(email: string, name: string, password: string, role?: SystemRole) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      systemRole: role,
    },
  });
}

async function ensureMembership(
  userId: string,
  organizationId: string,
  role: OrganizationRole,
) {
  return prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    update: { role },
    create: { userId, organizationId, role },
  });
}

async function ensureTeacher(record: {
  membershipId: string;
  organizationId: string;
}) {
  return prisma.teacher.upsert({
    where: { membershipId: record.membershipId },
    update: {},
    create: {
      membershipId: record.membershipId,
      organizationId: record.organizationId,
    },
  });
}

async function ensureStudent(record: {
  membershipId: string;
  organizationId: string;
}) {
  return prisma.student.upsert({
    where: { membershipId: record.membershipId },
    update: {},
    create: {
      membershipId: record.membershipId,
      orgId: record.organizationId,
    },
  });
}

async function ensureTeacherSubject(teacher: Teacher, subjectId: string) {
  return prisma.teacherSubject.upsert({
    where: {
      teacherId_subjectId: { teacherId: teacher.id, subjectId },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      subjectId,
    },
  });
}

async function ensureStudentPlacement(
  studentId: string,
  classSectionId: string,
  academicYear: AcademicYear,
) {
  await prisma.enrollment.upsert({
    where: {
      studentId_yearId: {
        studentId,
        yearId: academicYear.id,
      },
    },
    update: {
      classSectionId,
      status: 'ACTIVE',
    },
    create: {
      studentId,
      classSectionId,
      yearId: academicYear.id,
      status: 'ACTIVE',
    },
  });

  await prisma.studentClassroom.upsert({
    where: {
      studentId_schoolYear: {
        studentId,
        schoolYear: academicYear.label,
      },
    },
    update: { classSectionId },
    create: {
      studentId,
      classSectionId,
      schoolYear: academicYear.label,
    },
  });
}

async function ensureTestWithQuestions(
  organization: Organization,
  creator: Membership,
  payload: {
    title: string;
    description: string;
    questions: {
      text: string;
      type: QuestionType;
      order: number;
      score: number;
      correctAnswer?: string;
      correctAnswers?: string[];
      options?: string[];
    }[];
  },
) {
  const existing = await prisma.test.findFirst({
    where: { organizationId: organization.id, title: payload.title },
  });
  if (existing) {
    return existing;
  }

  return prisma.test.create({
    data: {
      organizationId: organization.id,
      title: payload.title,
      description: payload.description,
      status: PublishStatus.PUBLISHED,
      creatorId: creator.id,
      questions: {
        create: payload.questions.map((q) => ({
          text: q.text,
          type: q.type,
          order: q.order,
          score: q.score,
          correctAnswer: q.correctAnswer,
          correctAnswers: q.correctAnswers,
          options: q.options
            ? {
                create: q.options.map((option) => ({ text: option })),
              }
            : undefined,
        })),
      },
    },
  });
}

async function ensureAssignment(data: {
  organizationId: string;
  test: Test;
  classSectionId: string;
  createdById: string;
  topicLevelId?: string;
  openOffsetDays: number;
  closeOffsetDays: number;
}) {
  const existing = await prisma.assignment.findFirst({
    where: {
      organizationId: data.organizationId,
      testId: data.test.id,
      classSectionId: data.classSectionId,
    },
  });
  if (existing) return existing;

  const now = Date.now();
  return prisma.assignment.create({
    data: {
      organizationId: data.organizationId,
      testId: data.test.id,
      classSectionId: data.classSectionId,
      targetType: 'CLASS',
      topicLevelId: data.topicLevelId,
      openAt: new Date(now + data.openOffsetDays * 24 * 60 * 60 * 1000),
      closeAt: new Date(now + data.closeOffsetDays * 24 * 60 * 60 * 1000),
      createdById: data.createdById,
      showExplain: 'after_close',
      maxAttempts: 2,
      shuffle: true,
    },
  });
}

async function main() {
  console.log('\n🌱 Spouštím rozšířený seeding SkillStorm databáze...\n');

  // 1) Users & Roles
  const superadmin = await ensureUser(
    'admin@example.com',
    'Super Admin',
    'admin123',
    SystemRole.SUPERADMIN,
  );
  console.log(`🛡️ SUPERADMIN: ${superadmin.email} / admin123`);

  // 2) Base organization + school context
  let school = await prisma.organization.findFirst({
    where: { name: 'Test School' },
  });
  if (!school) {
    school = await prisma.organization.create({
      data: {
        name: 'Test School',
        type: 'SCHOOL',
        city: 'Praha',
        address: 'Palackého 12',
        country: 'Česko',
      },
    });
  }
  console.log(`🏫 Organizace: ${school.name}`);

  const academicYear = await prisma.academicYear.upsert({
    where: {
      orgId_label: {
        orgId: school.id,
        label: '2025/26',
      },
    },
    update: {},
    create: {
      orgId: school.id,
      label: '2025/26',
      startsAt: new Date('2025-09-01'),
      endsAt: new Date('2026-06-30'),
      isCurrent: true,
    },
  });

  // 3) Core staff and students
  const directorUser = await ensureUser(
    'director@example.com',
    'Ředitel Školy',
    'director123',
  );
  const directorMembership = await ensureMembership(
    directorUser.id,
    school.id,
    OrganizationRole.DIRECTOR,
  );

  const primaryTeacherUser = await ensureUser(
    'teacher@example.com',
    'Matikář',
    'teacher123',
  );
  const primaryTeacherMembership = await ensureMembership(
    primaryTeacherUser.id,
    school.id,
    OrganizationRole.TEACHER,
  );
  const primaryTeacher = await ensureTeacher({
    membershipId: primaryTeacherMembership.id,
    organizationId: school.id,
  });

  const initialStudentUser = await ensureUser(
    'student@example.com',
    'Žák Základka',
    'student123',
  );
  const initialStudentMembership = await ensureMembership(
    initialStudentUser.id,
    school.id,
    OrganizationRole.STUDENT,
  );
  const initialStudent = await ensureStudent({
    membershipId: initialStudentMembership.id,
    organizationId: school.id,
  });

  const baseClassSection = await prisma.classSection.upsert({
    where: {
      orgId_yearId_grade_section: {
        orgId: school.id,
        yearId: academicYear.id,
        grade: SchoolGrade.GRADE_9,
        section: 'A',
      },
    },
    update: {
      teacherId: primaryTeacher.id,
      label: '9.A',
    },
    create: {
      orgId: school.id,
      yearId: academicYear.id,
      grade: SchoolGrade.GRADE_9,
      section: 'A',
      label: '9.A',
      teacherId: primaryTeacher.id,
    },
  });

  await ensureStudentPlacement(initialStudent.id, baseClassSection.id, academicYear);

  const classSections = new Map<string, typeof baseClassSection>();
  classSections.set(classKey(SchoolGrade.GRADE_9, 'A'), baseClassSection);

  const teacherRecords: {
    membership: Membership;
    teacher: Teacher;
    seed: TeacherSeed | null;
  }[] = [
    {
      membership: primaryTeacherMembership,
      teacher: primaryTeacher,
      seed: {
        homeroom: {
          grade: SchoolGrade.GRADE_9,
          section: 'A',
          label: '9.A',
        },
        email: primaryTeacherUser.email ?? '',
        name: primaryTeacherUser.name,
      },
    },
  ];

  const teacherSeeds: TeacherSeed[] = [
    {
      email: 'eva.novakova@skillstorm.test',
      name: 'Eva Nováková',
      password: 'teacher123',
      homeroom: { grade: SchoolGrade.GRADE_7, section: 'B', label: '7.B' },
    },
    {
      email: 'science.mentor@skillstorm.test',
      name: 'Science Mentor',
      password: 'teacher123',
    },
  ];

  for (const seed of teacherSeeds) {
    const user = await ensureUser(seed.email, seed.name, seed.password ?? 'teacher123');
    const membership = await ensureMembership(
      user.id,
      school.id,
      OrganizationRole.TEACHER,
    );
    const teacher = await ensureTeacher({
      membershipId: membership.id,
      organizationId: school.id,
    });
    teacherRecords.push({ membership, teacher, seed });

    if (seed.homeroom) {
      const section = await prisma.classSection.upsert({
        where: {
          orgId_yearId_grade_section: {
            orgId: school.id,
            yearId: academicYear.id,
            grade: seed.homeroom.grade,
            section: seed.homeroom.section,
          },
        },
        update: {
          teacherId: teacher.id,
          label: seed.homeroom.label,
        },
        create: {
          orgId: school.id,
          yearId: academicYear.id,
          grade: seed.homeroom.grade,
          section: seed.homeroom.section,
          label: seed.homeroom.label,
          teacherId: teacher.id,
        },
      });
      classSections.set(classKey(seed.homeroom.grade, seed.homeroom.section), section);
    }
  }

  const studentRecords: {
    membership: Membership;
    student: { id: string };
    classKey: string;
  }[] = [
    {
      membership: initialStudentMembership,
      student: initialStudent,
      classKey: classKey(SchoolGrade.GRADE_9, 'A'),
    },
  ];

  const studentSeeds: StudentSeed[] = [
    {
      email: 'nela.studentova@skillstorm.test',
      name: 'Nela Studentová',
      grade: SchoolGrade.GRADE_9,
      section: 'A',
    },
    {
      email: 'matej.hravy@skillstorm.test',
      name: 'Matěj Hravý',
      grade: SchoolGrade.GRADE_9,
      section: 'A',
    },
    {
      email: 'sofia.matematika@skillstorm.test',
      name: 'Sofia Matematiková',
      grade: SchoolGrade.GRADE_7,
      section: 'B',
    },
    {
      email: 'tomas.prirodopis@skillstorm.test',
      name: 'Tomáš Přírodopisný',
      grade: SchoolGrade.GRADE_7,
      section: 'B',
    },
  ];

  for (const seed of studentSeeds) {
    const user = await ensureUser(seed.email, seed.name, seed.password ?? 'student123');
    const membership = await ensureMembership(
      user.id,
      school.id,
      OrganizationRole.STUDENT,
    );
    const student = await ensureStudent({
      membershipId: membership.id,
      organizationId: school.id,
    });
    const targetKey = classKey(seed.grade, seed.section);
    const section = classSections.get(targetKey);
    if (section) {
      await ensureStudentPlacement(student.id, section.id, academicYear);
    }
    studentRecords.push({ membership, student, classKey: targetKey });
  }

  // 4) Curriculum baseline
  const catalogSubject = await prisma.catalogSubject.upsert({
    where: { code: 'MATH' },
    update: {},
    create: {
      code: 'MATH',
      name: 'Matematika',
    },
  });

  const catalogTopic = await prisma.catalogTopic.upsert({
    where: {
      subjectId_name: { subjectId: catalogSubject.id, name: 'Zlomky' },
    },
    update: {},
    create: {
      subjectId: catalogSubject.id,
      name: 'Zlomky',
    },
  });

  const subject = await prisma.subject.upsert({
    where: {
      organizationId_catalogSubjectId: {
        organizationId: school.id,
        catalogSubjectId: catalogSubject.id,
      },
    },
    update: {},
    create: {
      organizationId: school.id,
      catalogSubjectId: catalogSubject.id,
      name: 'Matematika',
    },
  });

  const subjectLevel = await prisma.subjectLevel.upsert({
    where: {
      subjectId_grade: { subjectId: subject.id, grade: SchoolGrade.GRADE_9 },
    },
    update: {},
    create: {
      subjectId: subject.id,
      grade: SchoolGrade.GRADE_9,
      label: '9. ročník',
    },
  });

  const topicLevel = await prisma.topicLevel.upsert({
    where: {
      subjectLevelId_catalogTopicId_phase: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
        phase: 'INTRO',
      },
    },
    update: {},
    create: {
      subjectLevelId: subjectLevel.id,
      catalogTopicId: catalogTopic.id,
      name: 'Zlomky - Úvod',
      phase: 'INTRO',
      difficulty: 'BASIC',
    },
  });

  // Ensure teacher-subject relations
  await Promise.all(
    teacherRecords.map((record) => ensureTeacherSubject(record.teacher, subject.id)),
  );

  // 5) Learning materials
  const authors = teacherRecords.map((t) => t.membership);
  const materialSeeds = [
    {
      title: 'Fraction Station Deck',
      description: 'Interaktivní prezentace na zlomky včetně micro-úloh.',
      scope: ContentScope.ORGANIZATION,
      educationLevel: EducationLevel.PRIMARY_2,
      schoolGrade: SchoolGrade.GRADE_9,
    },
    {
      title: 'Geometry Sprint Cards',
      description: 'Sada kartiček pro rychlé procvičení obvodů a obsahů.',
      scope: ContentScope.ORGANIZATION,
      educationLevel: EducationLevel.PRIMARY_2,
      schoolGrade: SchoolGrade.GRADE_7,
    },
    {
      title: 'Percentages Mini Lab',
      description: 'Scénář pro skupinové aktivity na procenta.',
      scope: ContentScope.ORGANIZATION,
      educationLevel: EducationLevel.PRIMARY_2,
      schoolGrade: SchoolGrade.GRADE_9,
    },
  ];

  for (const [index, material] of materialSeeds.entries()) {
    const existing = await prisma.learningMaterial.findFirst({
      where: { title: material.title, organizationId: school.id },
    });
    if (existing) continue;
    const author = authors[index % authors.length];
    await prisma.learningMaterial.create({
      data: {
        title: material.title,
        description: material.description,
        contentType: ContentType.MATERIAL,
        educationLevel: material.educationLevel,
        schoolGrade: material.schoolGrade,
        subjectId: subject.id,
        topicLevelId: topicLevel.id,
        scope: material.scope,
        organizationId: school.id,
        createdById: author.id,
        richContent: {
          blocks: [
            { type: 'paragraph', data: { text: material.description } },
            { type: 'checklist', data: { items: ['Warm-up', 'Mini lesson', 'Assessment'] } },
          ],
        },
      },
    });
  }

  // 6) Tests + assignments + submissions
  const fractionsTest = await ensureTestWithQuestions(school, primaryTeacherMembership, {
    title: 'Fractions Mastery Check',
    description: 'Rychlý test na práci se zlomky a procenty.',
    questions: [
      {
        text: 'Kolik je 1/2 + 1/4?',
        type: QuestionType.MULTIPLE_CHOICE,
        order: 1,
        score: 2,
        correctAnswer: '3/4',
        options: ['3/4', '1/3', '1', '5/4'],
      },
      {
        text: 'Přepiš zlomek 12/48 na základní tvar.',
        type: QuestionType.FILL_IN_THE_BLANK,
        order: 2,
        score: 2,
        correctAnswer: '1/4',
      },
      {
        text: 'Kolik je 45 % ze 120?',
        type: QuestionType.FILL_IN_THE_BLANK,
        order: 3,
        score: 3,
        correctAnswer: '54',
      },
    ],
  });

  const geometryTest = await ensureTestWithQuestions(
    school,
    teacherRecords[1]?.membership ?? primaryTeacherMembership,
    {
      title: 'Geometry Basics Quiz',
      description: 'Obvody, obsahy a klasifikace trojúhelníků.',
      questions: [
        {
          text: 'Vypočítej obvod čtverce se stranou 6 cm.',
          type: QuestionType.FILL_IN_THE_BLANK,
          order: 1,
          score: 1,
          correctAnswer: '24',
        },
        {
          text: 'Pravoúhlý trojúhelník má odvěsny 3 cm a 4 cm. Jak dlouhá je přepona?',
          type: QuestionType.FILL_IN_THE_BLANK,
          order: 2,
          score: 3,
          correctAnswer: '5',
        },
      ],
    },
  );

  const fractionsAssignment = await ensureAssignment({
    organizationId: school.id,
    test: fractionsTest,
    classSectionId: baseClassSection.id,
    createdById: primaryTeacherMembership.id,
    topicLevelId: topicLevel.id,
    openOffsetDays: -2,
    closeOffsetDays: 7,
  });

  const grade7Section = classSections.get(classKey(SchoolGrade.GRADE_7, 'B'));
  let geometryAssignment: Assignment | null = null;
  if (grade7Section) {
    geometryAssignment = await ensureAssignment({
      organizationId: school.id,
      test: geometryTest,
      classSectionId: grade7Section.id,
      createdById: teacherRecords[1]?.membership.id ?? primaryTeacherMembership.id,
      topicLevelId: topicLevel.id,
      openOffsetDays: -1,
      closeOffsetDays: 5,
    });
  }

  async function assignStudentsToAssignment(
    assignment: Assignment,
    classIdentifier: string,
  ) {
    const relevantStudents = studentRecords.filter(
      (student) => student.classKey === classIdentifier,
    );
    for (const student of relevantStudents) {
      await prisma.assignmentStudent.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId: assignment.id,
            studentId: student.membership.id,
          },
        },
        update: {},
        create: {
          assignmentId: assignment.id,
          studentId: student.membership.id,
        },
      });
    }
  }

  await assignStudentsToAssignment(
    fractionsAssignment,
    classKey(SchoolGrade.GRADE_9, 'A'),
  );
  if (geometryAssignment && grade7Section) {
    await assignStudentsToAssignment(
      geometryAssignment,
      classKey(SchoolGrade.GRADE_7, 'B'),
    );
  }

  const questionsForFractions = await prisma.question.findMany({
    where: { testId: fractionsTest.id },
  });

  const sampleScores = [0.92, 0.81, 0.74];
  for (const [idx, student] of studentRecords.entries()) {
    if (student.classKey !== classKey(SchoolGrade.GRADE_9, 'A')) continue;
    await prisma.submission.upsert({
      where: {
        assignmentId_studentId_attemptNo: {
          assignmentId: fractionsAssignment.id,
          studentId: student.membership.id,
          attemptNo: 1,
        },
      },
      update: {
        status: SubmissionStatus.APPROVED,
        score: sampleScores[idx % sampleScores.length] * 100,
        submittedAt: new Date(Date.now() - idx * 36 * 60 * 60 * 1000),
      },
      create: {
        assignmentId: fractionsAssignment.id,
        studentId: student.membership.id,
        testId: fractionsTest.id,
        status: SubmissionStatus.APPROVED,
        score: sampleScores[idx % sampleScores.length] * 100,
        submittedAt: new Date(Date.now() - idx * 36 * 60 * 60 * 1000),
      },
    });
  }

  console.log('\n✅ Seed hotový. Přihlašovací údaje:');
  console.log('   • superadmin → admin@example.com / admin123');
  console.log('   • ředitel   → director@example.com / director123');
  console.log('   • učitelé   → teacher@example.com / teacher123');
  console.log('                 eva.novakova@skillstorm.test / teacher123');
  console.log('   • studenti  → student@example.com / student123');
  console.log('                 nela.studentova@skillstorm.test / student123');
}

main()
  .catch((e) => {
    console.error('❌ Chyba při seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
