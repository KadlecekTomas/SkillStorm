import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import {
  EnrollmentStatus,
  OrganizationRole,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
  SubmissionStatus,
} from '@prisma/client';
import { authAs, useOrg } from 'test/helpers';

describe('Tests results security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgId = '';
  let directorToken = '';
  let studentAToken = '';
  let studentBToken = '';
  let studentAMembershipId = '';
  let studentBMembershipId = '';
  let classSectionId = '';
  let testId = '';
  let assignmentId = '';
  let submissionBId = '';
  let bulkTestId = '';
  let bulkAssignmentId = '';

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
      seed: 'results_security_director',
      name: 'Results Director',
    });
    const studentA = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'results_security_student_a',
      name: 'Results Student A',
    });
    const studentB = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'results_security_student_b',
      name: 'Results Student B',
    });

    orgId = director.organization.id;
    directorToken = director.accessToken;

    await prisma.organization.update({
      where: { id: orgId },
      data: { status: OrganizationStatus.ACTIVE },
    });

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

    const year = await prisma.academicYear.findFirst({
      where: { orgId, isCurrent: true },
      select: { id: true },
    });
    if (!year) throw new Error('Missing current year');

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId: year.id,
        grade: SchoolGrade.GRADE_8,
        section: `R-${Date.now()}`,
        label: 'Results Class',
      },
      select: { id: true },
    });
    classSectionId = classSection.id;

    const [studentARecord, studentBRecord] = await Promise.all([
      prisma.student.upsert({
        where: { membershipId: studentAMembershipId },
        update: { orgId, deletedAt: null },
        create: { membershipId: studentAMembershipId, orgId },
        select: { id: true },
      }),
      prisma.student.upsert({
        where: { membershipId: studentBMembershipId },
        update: { orgId, deletedAt: null },
        create: { membershipId: studentBMembershipId, orgId },
        select: { id: true },
      }),
    ]);
    await prisma.enrollment.createMany({
      data: [
        {
          studentId: studentARecord.id,
          classSectionId,
          yearId: year.id,
          orgId,
          status: EnrollmentStatus.ACTIVE,
        },
        {
          studentId: studentBRecord.id,
          classSectionId,
          yearId: year.id,
          orgId,
          status: EnrollmentStatus.ACTIVE,
        },
      ],
      skipDuplicates: true,
    });

    const createdTest = await prisma.test.create({
      data: {
        title: 'Results security test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.PUBLISHED,
        questions: {
          create: [
            {
              text: 'Result question',
              type: QuestionType.TRUE_FALSE,
              order: 1,
              score: 1,
              correctAnswer: 'true',
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
        yearId: year.id,
        testId,
        targetType: 'STUDENTS',
        openAt: new Date(now.getTime() - 60 * 1000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 3,
        shuffle: false,
        showExplain: 'after_close',
        createdById: director.membership.id,
        students: {
          create: [
            { studentId: studentAMembershipId },
            { studentId: studentBMembershipId },
          ],
        },
      },
      select: { id: true },
    });
    assignmentId = assignment.id;

    await prisma.submission.create({
      data: {
        organizationId: orgId,
        assignmentId,
        testId,
        studentId: studentAMembershipId,
        attemptNo: 1,
        status: SubmissionStatus.APPROVED,
        score: 1,
        submittedAt: new Date(),
      },
    });
    const sb = await prisma.submission.create({
      data: {
        organizationId: orgId,
        assignmentId,
        testId,
        studentId: studentBMembershipId,
        attemptNo: 1,
        status: SubmissionStatus.APPROVED,
        score: 0,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
    submissionBId = sb.id;

    const bulkTest = await prisma.test.create({
      data: {
        title: 'Results bulk test',
        organizationId: orgId,
        creatorId: director.membership.id,
        status: PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    bulkTestId = bulkTest.id;
    const bulkAssignment = await prisma.assignment.create({
      data: {
        organizationId: orgId,
        yearId: year.id,
        testId: bulkTestId,
        targetType: 'STUDENTS',
        openAt: new Date(now.getTime() - 60 * 1000),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000),
        maxAttempts: 5000,
        shuffle: false,
        showExplain: 'after_close',
        createdById: director.membership.id,
        students: { create: [{ studentId: studentAMembershipId }] },
      },
      select: { id: true },
    });
    bulkAssignmentId = bulkAssignment.id;

    await prisma.submission.createMany({
      data: Array.from({ length: 1000 }).map((_, idx) => ({
        organizationId: orgId,
        assignmentId: bulkAssignmentId,
        testId: bulkTestId,
        studentId: studentAMembershipId,
        attemptNo: idx + 1,
        status: SubmissionStatus.APPROVED,
        score: 1,
        submittedAt: new Date(Date.now() - idx * 1000),
      })),
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.submission
      .deleteMany({ where: { assignmentId: { in: [assignmentId, bulkAssignmentId] } } })
      .catch(() => {});
    await prisma.assignment
      .deleteMany({ where: { id: { in: [assignmentId, bulkAssignmentId] } } })
      .catch(() => {});
    await prisma.test
      .deleteMany({ where: { id: { in: [testId, bulkTestId] } } })
      .catch(() => {});
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.student
      .deleteMany({ where: { membershipId: { in: [studentAMembershipId, studentBMembershipId] } } })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('student /tests/:id/results returns only own submissions and no class aggregates', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/${testId}/results`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);

    const payload = res.body?.data ?? res.body;
    const items = payload?.items ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((x: { id: string }) => x.id === submissionBId)).toBe(false);
    expect(items.every((x: { student: unknown }) => x.student == null)).toBe(true);
    expect(payload).not.toHaveProperty('average');
    expect(payload).not.toHaveProperty('median');
    expect(payload).not.toHaveProperty('max');
    expect(payload).not.toHaveProperty('min');
    expect(payload).not.toHaveProperty('classAverage');
  });

  it('results endpoint enforces max limit 100 and returns pagination meta', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tests/${bulkTestId}/results`)
      .query({ page: 1, limit: 1000 })
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);

    const payload = res.body?.data ?? res.body;
    const items = payload?.items ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeLessThanOrEqual(100);
    expect(payload?.meta?.limit).toBe(100);
    expect(payload?.meta?.total).toBeGreaterThanOrEqual(1000);
  });
});
