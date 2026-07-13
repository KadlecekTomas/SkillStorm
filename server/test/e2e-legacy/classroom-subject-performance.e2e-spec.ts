/**
 * E2E: GET /classrooms/:id/subject-performance
 * - Two subjects, different averages → sorting asc (worst first)
 * - Subject without submissions excluded
 * - Trend UP / DOWN
 * - Student role → 403
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationRole, PublishStatus, SubmissionStatus } from '@prisma/client';
import { login, uniqueEmail } from 'test/helpers';
import { bootstrapOrg } from './helpers/bootstrap-org';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Classroom Subject Performance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let directorToken: string;
  let studentToken: string;
  let orgId: string;
  let yearId: string;
  let classSectionId: string;
  let membershipDir: string;
  let membershipStudent: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const boot = await bootstrapOrg(prisma, {
      grade: $Enums.SchoolGrade.GRADE_6,
      section: 'B',
      classLabel: '6.B',
    });
    orgId = boot.orgId;
    yearId = boot.academicYearId;
    classSectionId = boot.classSectionId;

    const dirEmail = uniqueEmail('subjperf_dir');
    const dirPw = 'Password123!';
    const dirUser = await prisma.user.create({
      data: {
        email: dirEmail,
        username: `subjperf_dir_${Date.now()}`,
        name: 'E2E Director',
        passwordHash: await bcrypt.hash(dirPw, 10),
      },
      select: { id: true },
    });
    const dirMem = await prisma.membership.create({
      data: { userId: dirUser.id, organizationId: orgId, role: OrganizationRole.DIRECTOR },
      select: { id: true },
    });
    membershipDir = dirMem.id;
    directorToken = await login(app, { email: dirEmail, password: dirPw, organizationId: orgId });

    const stuEmail = uniqueEmail('subjperf_stu');
    const stuPw = 'Password123!';
    const stuUser = await prisma.user.create({
      data: {
        email: stuEmail,
        username: `subjperf_stu_${Date.now()}`,
        name: 'E2E Student',
        passwordHash: await bcrypt.hash(stuPw, 10),
      },
      select: { id: true },
    });
    const stuMem = await prisma.membership.create({
      data: { userId: stuUser.id, organizationId: orgId, role: OrganizationRole.STUDENT },
      select: { id: true },
    });
    membershipStudent = stuMem.id;
    const studentEntity = await prisma.student.create({
      data: { membershipId: stuMem.id, orgId },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        orgId,
        yearId,
        classSectionId,
        studentId: studentEntity.id,
        status: 'ACTIVE',
      },
    });
    studentToken = await login(app, { email: stuEmail, password: stuPw, organizationId: orgId });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('5) Role student → 403', () => {
    it('GET /classrooms/:id/subject-performance as student → 403', async () => {
      const res = await request(app.getHttpServer())
        .get(`/classrooms/${classSectionId}/subject-performance`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('1) Two subjects, different averages → sorting asc', () => {
    it('returns subjects sorted by averageScorePercent asc (worst first)', async () => {
      const subjectLow = await prisma.orgSubject.create({
        data: { name: 'Nízký průměr', gradeFrom: 1, gradeTo: 9, organizationId: orgId },
      });
      const subjectHigh = await prisma.orgSubject.create({
        data: { name: 'Vysoký průměr', gradeFrom: 1, gradeTo: 9, organizationId: orgId },
      });

      const testLow = await prisma.test.create({
        data: {
          title: 'Test Low',
          organizationId: orgId,
          creatorId: membershipDir,
          orgSubjectId: subjectLow.id,
          status: PublishStatus.PUBLISHED,
        },
      });
      const testHigh = await prisma.test.create({
        data: {
          title: 'Test High',
          organizationId: orgId,
          creatorId: membershipDir,
          orgSubjectId: subjectHigh.id,
          status: PublishStatus.PUBLISHED,
        },
      });

      const qLow = await prisma.question.create({
        data: { testId: testLow.id, text: 'Q', type: 'TRUE_FALSE', correctAnswer: 'true', score: 10, order: 0 },
      });
      const qHigh = await prisma.question.create({
        data: { testId: testHigh.id, text: 'Q', type: 'TRUE_FALSE', correctAnswer: 'true', score: 10, order: 0 },
      });

      const assignLow = await prisma.assignment.create({
        data: {
          organizationId: orgId,
          yearId,
          testId: testLow.id,
          classSectionId,
          createdById: membershipDir,
          openAt: new Date(),
          closeAt: new Date(Date.now() + 86400000),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        },
      });
      const assignHigh = await prisma.assignment.create({
        data: {
          organizationId: orgId,
          yearId,
          testId: testHigh.id,
          classSectionId,
          createdById: membershipDir,
          openAt: new Date(),
          closeAt: new Date(Date.now() + 86400000),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        },
      });

      await prisma.submission.create({
        data: {
          assignmentId: assignLow.id,
          testId: testLow.id,
          studentId: membershipStudent,
          score: 2,
          submittedAt: new Date(),
          attemptNo: 1,
          status: SubmissionStatus.APPROVED,
        },
      });
      await prisma.submission.create({
        data: {
          assignmentId: assignHigh.id,
          testId: testHigh.id,
          studentId: membershipStudent,
          score: 9,
          submittedAt: new Date(),
          attemptNo: 1,
          status: SubmissionStatus.APPROVED,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/classrooms/${classSectionId}/subject-performance`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      expect(body.classroomId).toBe(classSectionId);
      expect(body.subjects).toHaveLength(2);
      expect(body.subjects[0].averageScorePercent).toBeLessThanOrEqual(body.subjects[1].averageScorePercent);
      expect(body.subjects[0].name).toBe('Nízký průměr');
      expect(body.subjects[1].name).toBe('Vysoký průměr');

      await prisma.submission.deleteMany({ where: { assignmentId: { in: [assignLow.id, assignHigh.id] } } });
      await prisma.assignment.deleteMany({ where: { id: { in: [assignLow.id, assignHigh.id] } } });
      await prisma.question.deleteMany({ where: { id: { in: [qLow.id, qHigh.id] } } });
      await prisma.test.deleteMany({ where: { id: { in: [testLow.id, testHigh.id] } } });
      await prisma.orgSubject.deleteMany({ where: { id: { in: [subjectLow.id, subjectHigh.id] } } });
    });
  });

  describe('2) Subject without submissions excluded', () => {
    it('subject with assignment but no submissions does not appear', async () => {
      const subjectNoSub = await prisma.orgSubject.create({
        data: { name: 'Bez odevzdání', gradeFrom: 1, gradeTo: 9, organizationId: orgId },
      });
      const testNoSub = await prisma.test.create({
        data: {
          title: 'Test No Sub',
          organizationId: orgId,
          creatorId: membershipDir,
          orgSubjectId: subjectNoSub.id,
          status: PublishStatus.PUBLISHED,
        },
      });
      await prisma.question.create({
        data: { testId: testNoSub.id, text: 'Q', type: 'TRUE_FALSE', correctAnswer: 'true', score: 10, order: 0 },
      });
      const assignNoSub = await prisma.assignment.create({
        data: {
          organizationId: orgId,
          yearId,
          testId: testNoSub.id,
          classSectionId,
          createdById: membershipDir,
          openAt: new Date(),
          closeAt: new Date(Date.now() + 86400000),
          maxAttempts: 1,
          shuffle: false,
          showExplain: 'never',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/classrooms/${classSectionId}/subject-performance`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      const found = body.subjects?.find((s: { subjectId: string }) => s.subjectId === subjectNoSub.id);
      expect(found).toBeUndefined();

      await prisma.assignment.delete({ where: { id: assignNoSub.id } });
      await prisma.question.deleteMany({ where: { testId: testNoSub.id } });
      await prisma.test.delete({ where: { id: testNoSub.id } });
      await prisma.orgSubject.delete({ where: { id: subjectNoSub.id } });
    });
  });

  describe('3) Trend UP', () => {
    it('recent 30% higher than older 70% → trend UP', async () => {
      const subjectUp = await prisma.orgSubject.create({
        data: { name: 'TrendUp', gradeFrom: 1, gradeTo: 9, organizationId: orgId },
      });
      const testUp = await prisma.test.create({
        data: {
          title: 'Test Up',
          organizationId: orgId,
          creatorId: membershipDir,
          orgSubjectId: subjectUp.id,
          status: PublishStatus.PUBLISHED,
        },
      });
      await prisma.question.create({
        data: { testId: testUp.id, text: 'Q', type: 'TRUE_FALSE', correctAnswer: 'true', score: 10, order: 0 },
      });
      const assignUp = await prisma.assignment.create({
        data: {
          organizationId: orgId,
          yearId,
          testId: testUp.id,
          classSectionId,
          createdById: membershipDir,
          openAt: new Date(Date.now() - 30 * 86400000),
          closeAt: new Date(Date.now() + 86400000),
          maxAttempts: 5,
          shuffle: false,
          showExplain: 'never',
        },
      });
      const base = Date.now() - 20 * 86400000;
      for (let i = 0; i < 7; i++) {
        await prisma.submission.create({
          data: {
            assignmentId: assignUp.id,
            testId: testUp.id,
            studentId: membershipStudent,
            score: i < 5 ? 3 : 9,
            submittedAt: new Date(base + i * 86400000),
            attemptNo: i + 1,
            status: SubmissionStatus.APPROVED,
          },
        });
      }

      const res = await request(app.getHttpServer())
        .get(`/classrooms/${classSectionId}/subject-performance`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      const subj = body.subjects?.find((s: { subjectId: string }) => s.subjectId === subjectUp.id);
      expect(subj).toBeDefined();
      expect(subj.trend).toBe('UP');

      await prisma.submission.deleteMany({ where: { assignmentId: assignUp.id } });
      await prisma.assignment.delete({ where: { id: assignUp.id } });
      await prisma.question.deleteMany({ where: { testId: testUp.id } });
      await prisma.test.delete({ where: { id: testUp.id } });
      await prisma.orgSubject.delete({ where: { id: subjectUp.id } });
    });
  });

  describe('4) Trend DOWN', () => {
    it('recent 30% lower than older 70% → trend DOWN', async () => {
      const subjectDown = await prisma.orgSubject.create({
        data: { name: 'TrendDown', gradeFrom: 1, gradeTo: 9, organizationId: orgId },
      });
      const testDown = await prisma.test.create({
        data: {
          title: 'Test Down',
          organizationId: orgId,
          creatorId: membershipDir,
          orgSubjectId: subjectDown.id,
          status: PublishStatus.PUBLISHED,
        },
      });
      await prisma.question.create({
        data: { testId: testDown.id, text: 'Q', type: 'TRUE_FALSE', correctAnswer: 'true', score: 10, order: 0 },
      });
      const assignDown = await prisma.assignment.create({
        data: {
          organizationId: orgId,
          yearId,
          testId: testDown.id,
          classSectionId,
          createdById: membershipDir,
          openAt: new Date(Date.now() - 30 * 86400000),
          closeAt: new Date(Date.now() + 86400000),
          maxAttempts: 5,
          shuffle: false,
          showExplain: 'never',
        },
      });
      const base = Date.now() - 20 * 86400000;
      for (let i = 0; i < 7; i++) {
        await prisma.submission.create({
          data: {
            assignmentId: assignDown.id,
            testId: testDown.id,
            studentId: membershipStudent,
            score: i < 5 ? 9 : 2,
            submittedAt: new Date(base + i * 86400000),
            attemptNo: i + 1,
            status: SubmissionStatus.APPROVED,
          },
        });
      }

      const res = await request(app.getHttpServer())
        .get(`/classrooms/${classSectionId}/subject-performance`)
        .set('Authorization', `Bearer ${directorToken}`);
      expect(res.status).toBe(200);
      const body = unwrapBody(res);
      const subj = body.subjects?.find((s: { subjectId: string }) => s.subjectId === subjectDown.id);
      expect(subj).toBeDefined();
      expect(subj.trend).toBe('DOWN');

      await prisma.submission.deleteMany({ where: { assignmentId: assignDown.id } });
      await prisma.assignment.delete({ where: { id: assignDown.id } });
      await prisma.question.deleteMany({ where: { testId: testDown.id } });
      await prisma.test.delete({ where: { id: testDown.id } });
      await prisma.orgSubject.delete({ where: { id: subjectDown.id } });
    });
  });
});
