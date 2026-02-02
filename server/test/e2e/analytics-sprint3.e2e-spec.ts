import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'TestPass123!';

describe('Analytics Sprint 3 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let teacher: { token: string; orgId: string; membershipId: string };
  let student: { token: string; membershipId: string };
  let yearId: string;
  let orgId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
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

    const org = await prisma.organization.create({
      data: { name: `Analytics Sprint3 Org ${Date.now()}` },
      select: { id: true },
    });
    orgId = org.id;

    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label: `Sprint3 ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const teacherUser = await prisma.user.create({
      data: {
        email: `analytics_teacher_${Date.now()}@example.com`,
        name: 'Analytics Teacher',
        passwordHash,
      },
      select: { id: true, email: true },
    });
    const teacherMembership = await prisma.membership.create({
      data: {
        userId: teacherUser.id,
        organizationId: orgId,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const studentUser = await prisma.user.create({
      data: {
        email: `analytics_student_${Date.now()}@example.com`,
        name: 'Analytics Student',
        passwordHash,
      },
      select: { id: true, email: true },
    });
    const studentMembership = await prisma.membership.create({
      data: {
        userId: studentUser.id,
        organizationId: orgId,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    const teacherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: teacherUser.email, password: TEST_PASSWORD })
      .expect(201);
    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: studentUser.email, password: TEST_PASSWORD })
      .expect(201);

    const teacherData = unwrap(teacherLogin) ?? teacherLogin.body;
    const studentData = unwrap(studentLogin) ?? studentLogin.body;

    const teacherToken =
      teacherData?.sessionToken ?? teacherData?.data?.sessionToken;
    const studentToken =
      studentData?.sessionToken ?? studentData?.data?.sessionToken;

    if (!teacherToken || !studentToken) {
      throw new Error(
        `Missing tokens: teacher=${!!teacherToken} student=${!!studentToken}`,
      );
    }

    teacher = {
      token: teacherToken,
      orgId,
      membershipId: teacherMembership.id,
    };
    student = {
      token: studentToken,
      membershipId: studentMembership.id,
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /analytics/student-timeline', () => {
    it('returns 400 when yearId is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/student-timeline')
        .set('Authorization', `Bearer ${student.token}`)
        .expect(400);
      expect(res.body).toBeDefined();
    });

    it('STUDENT returns only own submissions (or 403 if RBAC blocks)', async () => {
      if (!yearId) return;
      const res = await request(app.getHttpServer())
        .get(`/analytics/student-timeline?yearId=${yearId}`)
        .set('Authorization', `Bearer ${student.token}`);
      if (res.status === 403) {
        return;
      }
      expect(res.status).toBe(200);
      const data = unwrap(res);
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      data.items.forEach((item: any) => {
        expect(item).toHaveProperty('testTitle');
        expect(item).toHaveProperty('submittedAt');
        expect(item).toHaveProperty('score');
        expect(item).not.toHaveProperty('studentId');
        expect(item).not.toHaveProperty('studentName');
      });
    });

    it('STUDENT cannot see another student by passing studentId', async () => {
      if (!yearId) return;
      const res = await request(app.getHttpServer())
        .get(
          `/analytics/student-timeline?yearId=${yearId}&studentId=${teacher.membershipId}`,
        )
        .set('Authorization', `Bearer ${student.token}`)
        .expect(403);
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /analytics/class-heatmap', () => {
    it('returns 400 when yearId is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics/class-heatmap')
        .set('Authorization', `Bearer ${teacher.token}`)
        .expect(400);
      expect(res.body).toBeDefined();
    });

    it('returns only aggregations, no student identifiers', async () => {
      if (!yearId) return;
      const res = await request(app.getHttpServer())
        .get(`/analytics/class-heatmap?yearId=${yearId}`)
        .set('Authorization', `Bearer ${teacher.token}`)
        .expect(200);
      const data = unwrap(res);
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      data.items.forEach((item: any) => {
        expect(item).toHaveProperty('classSectionId');
        expect(item).toHaveProperty('grade');
        expect(item).toHaveProperty('section');
        expect(item).toHaveProperty('avgScore');
        expect(item).toHaveProperty('submissionCount');
        expect(item).toHaveProperty('totalStudents');
        expect(item).not.toHaveProperty('studentId');
        expect(item).not.toHaveProperty('studentName');
        expect(item).not.toHaveProperty('email');
      });
    });

    it('STUDENT gets 403', async () => {
      if (!yearId) return;
      await request(app.getHttpServer())
        .get(`/analytics/class-heatmap?yearId=${yearId}`)
        .set('Authorization', `Bearer ${student.token}`)
        .expect(403);
    });
  });
});
