import { PrismaClient, OrganizationRole, OrganizationType, SchoolGrade, PublishStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding demo data (teacher + student + test)...');

  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.classSection.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  const org = await prisma.organization.create({
    data: {
      name: 'Demo School',
      type: OrganizationType.SCHOOL,
      city: 'Prague',
      country: 'CZ',
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: 'teacher@demo.local',
      username: 'teacher',
      name: 'Demo Teacher',
      passwordHash: await bcrypt.hash('Passw0rd!', 10),
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: 'student@demo.local',
      username: 'student',
      name: 'Demo Student',
      passwordHash: await bcrypt.hash('Passw0rd!', 10),
    },
  });

  const teacherMembership = await prisma.membership.create({
    data: {
      userId: teacherUser.id,
      organizationId: org.id,
      role: OrganizationRole.TEACHER,
    },
  });

  const studentMembership = await prisma.membership.create({
    data: {
      userId: studentUser.id,
      organizationId: org.id,
      role: OrganizationRole.STUDENT,
    },
  });

  const classSection = await prisma.classSection.create({
    data: {
      orgId: org.id,
      yearId: (await prisma.academicYear.create({
        data: {
          orgId: org.id,
          label: '2024/25',
          startsAt: new Date('2024-09-01'),
          endsAt: new Date('2025-06-30'),
          isCurrent: true,
        },
      })).id,
      grade: SchoolGrade.GRADE_7,
      section: 'A',
      label: '7.A',
    },
  });

  await prisma.enrollment.create({
    data: {
      studentId: studentMembership.id,
      classSectionId: classSection.id,
      yearId: classSection.yearId,
      status: 'ACTIVE',
    },
  });

  const test = await prisma.test.create({
    data: {
      organizationId: org.id,
      title: 'Demo test – Matematika',
      description: 'Jednoduchý aritmetický test',
      status: PublishStatus.PUBLISHED,
      creatorId: teacherMembership.id,
      questions: {
        create: [
          {
            text: 'Kolik je 2 + 2?',
            type: 'MULTIPLE_CHOICE',
            order: 1,
            score: 1,
            options: { create: [{ text: '4' }, { text: '5' }] },
            correctAnswer: '4',
          },
          {
            text: 'Kolik je 5 - 3?',
            type: 'MULTIPLE_CHOICE',
            order: 2,
            score: 1,
            options: { create: [{ text: '2' }, { text: '1' }] },
            correctAnswer: '2',
          },
        ],
      },
    },
  });

  await prisma.assignment.create({
    data: {
      organizationId: org.id,
      testId: test.id,
      targetType: 'CLASS',
      classSectionId: classSection.id,
      topicLevelId: null,
      openAt: new Date(Date.now() - 60 * 60 * 1000),
      closeAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxAttempts: 2,
      shuffle: true,
      showExplain: 'after_close',
      createdById: teacherMembership.id,
    },
  });

  console.log('✅ Seed complete. Accounts:');
  console.log('Teacher: teacher@demo.local / Passw0rd!');
  console.log('Student: student@demo.local / Passw0rd!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
