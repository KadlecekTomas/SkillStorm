import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { authAs } from 'test/helpers';
import {
  OrganizationRole,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';

describe('Core workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let directorToken = '';
  let studentToken = '';
  let orgId = '';
  let classSectionId = '';
  let studentMembershipId = '';
  let studentId = '';
  let academicYearId = '';

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    const director = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'core_director',
      name: 'Core Director',
    });
    orgId = director.organization.id;
    directorToken = director.accessToken;

    const student = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'core_student',
      name: 'Core Student',
    });

    const membership = await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: student.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    studentMembershipId = membership.id;

    const academicYear = await prisma.academicYear.create({
      data: {
        orgId,
        label: `AY-${Date.now()}`,
        startsAt: new Date('2024-09-01T00:00:00.000Z'),
        endsAt: new Date('2025-08-31T23:59:59.000Z'),
        isCurrent: true,
      },
      select: { id: true },
    });
    academicYearId = academicYear.id;

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYear.id,
        grade: SchoolGrade.GRADE_1,
        section: 'A',
        label: '1.A',
      },
      select: { id: true },
    });
    classSectionId = classSection.id;

    const studentRow = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          membershipId: membership.id,
          orgId,
        },
        select: { id: true },
      });
      await tx.enrollment.create({
        data: {
          studentId: student.id,
          classSectionId,
          yearId: academicYear.id,
          orgId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      return student;
    });
    studentId = studentRow.id;

    const useOrg = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({ orgId })
      .expect(201);
    studentToken = useOrg.body.sessionToken;
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { studentId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { id: studentMembershipId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('core flow: create test → add questions → publish → assign → submit → score', async () => {
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ title: 'Core Test', organizationId: orgId })
      .expect(201);
    const testId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Is 1 < 2?',
        type: QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Capital of CZ?',
        type: QuestionType.FILL_IN_THE_BLANK,
        correctAnswer: 'Praha',
        order: 2,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Pick one',
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswer: 'A',
        order: 3,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Pick two',
        type: QuestionType.MULTIPLE_CHOICE,
        correctAnswers: ['A', 'C'],
        order: 4,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tests/${testId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ status: PublishStatus.PUBLISHED })
      .expect(200);

    const now = new Date();
    const assign = await request(app.getHttpServer())
      .post(`/tests/${testId}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        classSectionId,
        openAt: new Date(now.getTime() - 60_000).toISOString(),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        maxAttempts: 2,
        shuffle: false,
        showExplain: 'NEVER',
      })
      .expect(201);
    const assignmentId = assign.body.id as string;

    const list = await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const ids = (list.body ?? []).map((a: any) => a.id);
    expect(ids).toContain(assignmentId);

    const testDetail = await request(app.getHttpServer())
      .get(`/tests/${testId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .expect(200);
    const questions = testDetail.body.questions as Array<{
      id: string;
      type: QuestionType;
      correctAnswer?: string | null;
      correctAnswers?: string[];
    }>;

    const submission = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);
    const submissionId = submission.body.id as string;

    const responses = questions.map((q) => {
      if (q.type === QuestionType.TRUE_FALSE) {
        return { questionId: q.id, givenText: 'true' };
      }
      if (q.type === QuestionType.FILL_IN_THE_BLANK) {
        return { questionId: q.id, givenText: 'Praha' };
      }
      if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0) {
        return { questionId: q.id, givenText: q.correctAnswers };
      }
      return { questionId: q.id, givenText: q.correctAnswer ?? '' };
    });

    await request(app.getHttpServer())
      .patch(`/submissions/${submissionId}/responses`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ responses })
      .expect(200);

    const finished = await request(app.getHttpServer())
      .post(`/submissions/${submissionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({})
      .expect(200);

    expect(finished.body.status).toBe('APPROVED');
    expect(finished.body.score).toBe(1);
  });

  it('publish fails when test has unscorable question', async () => {
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ title: 'Unscorable Publish', organizationId: orgId })
      .expect(201);
    const testId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Missing answer',
        type: QuestionType.TRUE_FALSE,
        order: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/tests/${testId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ status: PublishStatus.PUBLISHED })
      .expect(400);
  });

  it('assign fails when test has unscorable question', async () => {
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ title: 'Unscorable Assign', organizationId: orgId })
      .expect(201);
    const testId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Missing answer',
        type: QuestionType.FILL_IN_THE_BLANK,
        order: 1,
      })
      .expect(201);

    const now = new Date();
    await request(app.getHttpServer())
      .post(`/tests/${testId}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        classSectionId,
        openAt: new Date(now.getTime() - 60_000).toISOString(),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
      })
      .expect(400);
  });

  it('finish rejects unscorable submission (score=null)', async () => {
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ title: 'Unscorable Finish', organizationId: orgId })
      .expect(201);
    const testId = created.body.id as string;

    const q = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        text: 'Will be cleared',
        type: QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      })
      .expect(201);
    const questionId = q.body.id as string;

    await request(app.getHttpServer())
      .patch(`/tests/${testId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ status: PublishStatus.PUBLISHED })
      .expect(200);

    const now = new Date();
    const assign = await request(app.getHttpServer())
      .post(`/tests/${testId}/assign`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        classSectionId,
        openAt: new Date(now.getTime() - 60_000).toISOString(),
        closeAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
      })
      .expect(201);
    const assignmentId = assign.body.id as string;

    const submission = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assignmentId })
      .expect(201);
    const submissionId = submission.body.id as string;

    await prisma.question.update({
      where: { id: questionId },
      data: { correctAnswer: null, correctAnswers: [] },
    });

    const finished = await request(app.getHttpServer())
      .post(`/submissions/${submissionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({})
      .expect(200);

    expect(finished.body.status).toBe('REJECTED');
    expect(finished.body.score).toBeNull();
  });
});
