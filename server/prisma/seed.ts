import {
  PrismaClient,
  OrganizationRole,
  SchoolGrade,
  SystemRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Spouštím seeding...\n');

  // Helper pro hash hesla
  async function createUser(
    email: string,
    name: string,
    password: string,
    systemRole?: SystemRole,
  ) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.user.create({
      data: { email, name, passwordHash, systemRole },
    });
  }

  // 1️⃣ SUPERADMIN
  const superadmin = await createUser(
    'admin@example.com',
    'Super Admin',
    'admin123',
    SystemRole.SUPERADMIN,
  );
  console.log(`🛡️ SUPERADMIN: ${superadmin.email} / admin123`);

  // 2️⃣ ORGANIZACE
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

  // 3️⃣ ŠKOLNÍ ROK
  const academicYear = await prisma.academicYear.upsert({
    where: {
      orgId_label: { orgId: school.id, label: '2025/26' },
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
  console.log(`📅 Školní rok: ${academicYear.label}`);

  // 4️⃣ UŽIVATELÉ
  const directorUser = await createUser(
    'director@example.com',
    'Ředitel Školy',
    'director123',
  );
  const teacherUser = await createUser(
    'teacher@example.com',
    'Matikář',
    'teacher123',
  );
  const studentUser = await createUser(
    'student@example.com',
    'Žák Základka',
    'student123',
  );

  // 5️⃣ MEMBERSHIPY
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: directorUser.id,
        organizationId: school.id,
      },
    },
    update: {},
    create: {
      userId: directorUser.id,
      organizationId: school.id,
      role: OrganizationRole.DIRECTOR,
    },
  });

  const teacherMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: teacherUser.id,
        organizationId: school.id,
      },
    },
    update: {},
    create: {
      userId: teacherUser.id,
      organizationId: school.id,
      role: OrganizationRole.TEACHER,
    },
  });

  const studentMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: studentUser.id,
        organizationId: school.id,
      },
    },
    update: {},
    create: {
      userId: studentUser.id,
      organizationId: school.id,
      role: OrganizationRole.STUDENT,
    },
  });

  // 6️⃣ TEACHER / STUDENT ENTITY
  const teacherEntity = await prisma.teacher.upsert({
    where: { membershipId: teacherMembership.id },
    update: {},
    create: {
      membershipId: teacherMembership.id,
      organizationId: school.id,
    },
  });

  const studentEntity = await prisma.student.upsert({
    where: { membershipId: studentMembership.id },
    update: {},
    create: {
      membershipId: studentMembership.id,
      orgId: school.id,
    },
  });

  // 7️⃣ TŘÍDA (ClassSection)
  const classSection = await prisma.classSection.upsert({
    where: {
      orgId_yearId_grade_section: {
        orgId: school.id,
        yearId: academicYear.id,
        grade: SchoolGrade.GRADE_9,
        section: 'A',
      },
    },
    update: {},
    create: {
      orgId: school.id,
      yearId: academicYear.id,
      grade: SchoolGrade.GRADE_9,
      section: 'A',
      label: '9.A',
      teacherId: teacherEntity.id,
    },
  });
  console.log(`🏫 Třída: ${classSection.label}`);

  // 8️⃣ ENROLLMENT STUDENTA DO TŘÍDY
  await prisma.enrollment.upsert({
    where: {
      studentId_yearId: {
        studentId: studentEntity.id,
        yearId: academicYear.id,
      },
    },
    update: {},
    create: {
      studentId: studentEntity.id,
      classSectionId: classSection.id,
      yearId: academicYear.id,
      status: 'ACTIVE',
    },
  });

  await prisma.studentClassroom.upsert({
    where: {
      studentId_schoolYear: {
        studentId: studentEntity.id,
        schoolYear: academicYear.label,
      },
    },
    update: {},
    create: {
      studentId: studentEntity.id,
      classSectionId: classSection.id,
      schoolYear: academicYear.label,
    },
  });

  // 9️⃣ CATALOG SUBJECT + TOPIC + SUBJECT INSTANCE
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

  // 1️⃣0️⃣ SUBJECT LEVEL + TOPIC LEVEL
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

  await prisma.topicLevel.upsert({
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

  console.log('\n✅ Seeding dokončen!');
}

main()
  .catch((e) => {
    console.error('❌ Chyba při seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
