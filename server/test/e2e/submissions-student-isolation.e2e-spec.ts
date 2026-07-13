import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import {
  EnrollmentStatus,
  OrganizationType,
  OrganizationRole,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { authAs, useOrg } from 'test/helpers';

describe('Submissions student isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId = '';
  let yearId = '';
  let testId = '';
  let directorMembershipId = '';
  let directorToken = '';
  let studentAToken = '';
  let studentBToken = '';
  let studentAMembershipId = '';
  let studentBMembershipId = '';
  let studentAId = '';
  let studentBId = '';
  let classSectionId = '';
  let assignmentId = '';
  let submissionBId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const director = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'submission_isolation_director',
      name: 'Isolation Director',
    });
    const studentA = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'submission_isolation_student_a',
      name: 'Isolation Student A',
    });
    const studentB = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'submission_isolation_student_b',
      name: 'Isolation Student B',
    });

    orgId = director.organization.id;
    directorToken = director.accessToken;
    directorMembershipId = director.membership.id;

    const [membershipA, membershipB] = await Promise.all([
      prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId: studentA.user.id,
            organizationId: orgId,
          },
        },
        update: { role: OrganizationRole.STUDENT, deletedAt: null },
        create: {
          userId: studentA.user.id,
          organizationId: orgId,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      }),
      prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId: studentB.user.id,
            organizationId: orgId,
          },
        },
        update: { role: OrganizationRole.STUDENT, deletedAt: null },
        create: {
          userId: studentB.user.id,
          organizationId: orgId,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      }),
    ]);
    studentAMembershipId = membershipA.id;
    studentBMembershipId = membershipB.id;

    studentAToken = await useOrg(app, studentA.accessToken, orgId);
    studentBToken = await useOrg(app, studentB.accessToken, orgId);

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) {
      throw new Error('Missing current academic year');
    }
    yearId = year.id;

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId: year.id,
        grade: SchoolGrade.GRADE_8,
        section: `I-${Date.now()}`,
        label: 'Isolation Class',
      },
      select: { id: true },
    });
    classSectionId = classSection.id;

    const [studentRowA, studentRowB] = await Promise.all([
      prisma.student.upsert({
        where: { membershipId: membershipA.id },
        update: { orgId, deletedAt: null },
        create: { membershipId: membershipA.id, orgId },
        select: { id: true },
      }),
      prisma.student.upsert({
        where: { membershipId: membershipB.id },
        update: { orgId, deletedAt: null },
        create: { membershipId: membershipB.id, orgId },
        select: { id: true },
      }),
    ]);
    studentAId = studentRowA.id;
    studentBId = studentRowB.id;

    await prisma.enrollment.createMany({
      data: [
        {
          studentId: studentAId,
          classSectionId: classSection.id,
          yearId: year.id,
          orgId,
          status: EnrollmentStatus.ACTIVE,
        },
        {
          studentId: studentBId,
          classSectionId: classSection.id,
          yearId: year.id,
          orgId,
          status: EnrollmentStatus.ACTIVE,
        },
      ],
      skipDuplicates: true,
    });

    const createdTest = await prisma.test.create({
      data: {
        title: 'Submission isolation test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.PUBLISHED,
        questions: {
          create: [
            {
              text: '2 + 2 = ?',
              type: QuestionType.FILL_IN_THE_BLANK,
              score: 1,
              order: 1,
              correctAnswer: '4',
            },
          ],
        },
      },
      select: { id: true },
    });
    testId = createdTest.id;

    const now = new Date();
    const assignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId: createdTest.id,
        targetType: 'STUDENTS',
        openAt: new Date(now.getTime() - 5 * 60 * 1000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 2,
        shuffle: false,
        showExplain: 'after_close',
        createdById: directorMembershipId,
        students: {
          create: [{ studentId: membershipA.id }, { studentId: membershipB.id }],
        },
      },
      select: { id: true },
    });
    assignmentId = assignment.id;

    const createdSubmission = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({ assignmentId })
      .expect(201);
    submissionBId = createdSubmission.body.id;
  });

  afterAll(async () => {
    await prisma.submission.deleteMany({ where: { assignmentId } }).catch(() => {});
    await prisma.assignment.deleteMany({ where: { id: assignmentId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: { in: [studentAId, studentBId] } } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('student A cannot read student B submission detail or list it via filter', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/submissions/${submissionBId}`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(403);

    const list = await request(app.getHttpServer())
      .get('/submissions')
      .query({ studentId: studentBMembershipId })
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);

    const payload = list.body?.data ?? list.body;
    const rows = payload?.data ?? [];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.some((row: { id: string }) => row.id === submissionBId)).toBe(
      false,
    );
  });

  it('student A cannot create submission for assignment of a different class in same org', async () => {
    const classB = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: SchoolGrade.GRADE_8,
        section: `IB-${Date.now()}`,
        label: 'Isolation Class B',
      },
      select: { id: true },
    });

    const assignmentForeignClass = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId,
        targetType: 'CLASS',
        classSectionId: classB.id,
        openAt: new Date(Date.now() - 5 * 60 * 1000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'after_close',
        createdById: directorMembershipId,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ assignmentId: assignmentForeignClass.id })
      .expect(403);

    await prisma.assignment
      .deleteMany({ where: { id: assignmentForeignClass.id } })
      .catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classB.id } }).catch(() => {});
  });

  it('student from ORG A cannot create submission for assignment in ORG B', async () => {
    const orgB = await prisma.organization.create({
      data: {
        name: `Iso Org B ${Date.now()}`,
        type: OrganizationType.SCHOOL,
        status: OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });
    const yearB = await prisma.academicYear.create({
      data: {
        orgId: orgB.id,
        label: `Y-${Date.now()}`,
        startsAt: new Date('2025-09-01T00:00:00.000Z'),
        endsAt: new Date('2026-06-30T23:59:59.000Z'),
        isCurrent: true,
      },
      select: { id: true },
    });

    const teacherB = await authAs(app, OrganizationRole.TEACHER, {
      seed: 'submission_isolation_teacher_b',
      name: 'Isolation Teacher B',
    });
    const membershipB = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: teacherB.user.id,
          organizationId: orgB.id,
        },
      },
      update: { role: OrganizationRole.TEACHER, deletedAt: null },
      create: {
        userId: teacherB.user.id,
        organizationId: orgB.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const testB = await prisma.test.create({
      data: {
        title: 'Org B test',
        organizationId: orgB.id,
        creatorId: membershipB.id,
        status: PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    const classSectionB = await prisma.classSection.create({
      data: {
        orgId: orgB.id,
        yearId: yearB.id,
        grade: SchoolGrade.GRADE_8,
        section: `OB-${Date.now()}`,
        label: 'Org B Class',
      },
      select: { id: true },
    });
    const assignmentB = await prisma.assignment.create({
      data: {
        organizationId: orgB.id,
        yearId: yearB.id,
        testId: testB.id,
        targetType: 'CLASS',
        classSectionId: classSectionB.id,
        openAt: new Date(Date.now() - 5 * 60 * 1000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'after_close',
        createdById: membershipB.id,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ assignmentId: assignmentB.id })
      // cross-tenant assignment is masked as 404 (no existence oracle)
      .expect(404);

    await prisma.assignment.deleteMany({ where: { id: assignmentB.id } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionB.id } }).catch(() => {});
    await prisma.test.deleteMany({ where: { id: testB.id } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { id: membershipB.id } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: yearB.id } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgB.id } }).catch(() => {});
  });

  it('deleted assignment cannot be used to create submission', async () => {
    const temporary = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId,
        testId,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 5 * 60 * 1000),
        closeAt: new Date(Date.now() + 60 * 60 * 1000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'after_close',
        createdById: directorMembershipId,
        students: { create: [{ studentId: studentAMembershipId }] },
      },
      select: { id: true },
    });
    await prisma.assignment.delete({ where: { id: temporary.id } });

    await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ assignmentId: temporary.id })
      .expect(404);
  });
});
