import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Vytvoření organizace
  const org = await prisma.organization.create({
    data: {
      name: 'Test School',
      type: 'SCHOOL',
      city: 'Test City',
      country: 'CZ',
    },
  });

  // Učitel
  const teacherUser = await prisma.user.create({
    data: {
      email: 'teacher@test.cz',
      username: 'teacher',
      passwordHash: 'test',
      name: 'Test Teacher',
    },
  });
  const teacherMembership = await prisma.membership.create({
    data: {
      userId: teacherUser.id,
      organizationId: org.id,
      role: 'TEACHER',
    },
  });

  // Student
  const studentUser = await prisma.user.create({
    data: {
      email: 'student@test.cz',
      username: 'student',
      passwordHash: 'test',
      name: 'Test Student',
    },
  });
  const studentMembership = await prisma.membership.create({
    data: {
      userId: studentUser.id,
      organizationId: org.id,
      role: 'STUDENT',
    },
  });

  // Test
  const test = await prisma.test.create({
    data: {
      organizationId: org.id,
      title: 'Testovací test',
      creatorId: teacherMembership.id,
      questions: {
        create: [
          {
            text: '2+2?',
            type: 'MULTIPLE_CHOICE',
            score: 1,
            correctAnswer: '4',
          },
          {
            text: 'Pravda/Nepravda: 1=1',
            type: 'TRUE_FALSE',
            score: 1,
            correctAnswer: 'true',
          },
          {
            text: 'Doplň: hlavní město ČR',
            type: 'FILL_IN_THE_BLANK',
            score: 1,
            correctAnswer: 'Praha',
          },
        ],
      },
    },
    include: { questions: true },
  });

  // Assignment
  const assignment = await prisma.assignment.create({
    data: {
      organizationId: org.id,
      testId: test.id,
      targetType: 'STUDENTS',
      openAt: new Date(Date.now() - 1000 * 60),
      closeAt: new Date(Date.now() + 1000 * 60 * 60),
      maxAttempts: 2,
      shuffle: false,
      showExplain: 'after_close',
      createdById: teacherMembership.id,
      students: {
        create: [{ studentId: studentMembership.id }],
      },
    },
  });

  console.log('Seed complete:', {
    org,
    teacherUser,
    teacherMembership,
    studentUser,
    studentMembership,
    test,
    assignment,
  });
}

main().finally(() => prisma.$disconnect());
