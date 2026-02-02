/**
 * RELEASE GATE: Classrooms × AcademicYear
 *
 * Ověřuje invarianty:
 * - POST /classrooms bez yearId → 400
 * - GET /classrooms bez yearId → 400
 * - POST bez aktivního roku v org → 409 NO_ACTIVE_ACADEMIC_YEAR
 * - POST s yearId OK → 201, vrací id + yearId
 * - yearId musí patřit org uživatele
 */
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

const TEST_PASSWORD = 'ReleaseGate123!';

describe('Classrooms Release Gate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let director: { token: string; orgId: string };
  let yearId: string;

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
      data: { name: `RG Classrooms Org ${Date.now()}` },
      select: { id: true },
    });

    const year = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: `RG ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `rg_director_${Date.now()}@example.com`,
        name: 'RG Director',
        passwordHash,
      },
      select: { id: true, email: true },
    });

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveMembershipId: membership.id },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(201);
    const loginData = unwrap(loginRes) ?? loginRes.body;
    const token = loginData?.sessionToken ?? loginRes.body?.sessionToken;
    if (!token) throw new Error('Missing token');

    director = { token, orgId: org.id };
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /classrooms', () => {
    it('400 when yearId and academicYearId are both missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          grade: 'GRADE_7',
          section: 'A',
        })
        .expect(400);

      expect(res.body).toBeDefined();
      expect(res.body.message || res.body.error).toBeDefined();
    });

    it('201 with yearId, returns id and yearId', async () => {
      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          yearId,
          grade: 'GRADE_7',
          section: 'X',
          label: '7.X',
        })
        .expect(201);

      const data = unwrap(res);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('yearId', yearId);
      expect(data).toHaveProperty('grade', 'GRADE_7');
      expect(data).toHaveProperty('section', 'X');
    });

    it('201 with academicYearId (alias), returns yearId', async () => {
      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          academicYearId: yearId,
          grade: 'GRADE_8',
          section: 'Y',
        })
        .expect(201);

      const data = unwrap(res);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('yearId', yearId);
    });
  });

  describe('GET /classrooms', () => {
    it('400 when yearId/academicYearId is missing in query', async () => {
      await request(app.getHttpServer())
        .get('/classrooms')
        .set('Authorization', `Bearer ${director.token}`)
        .expect(400);
    });

    it('200 with yearId in query, returns data array', async () => {
      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId })
        .set('Authorization', `Bearer ${director.token}`)
        .expect(200);

      const raw = unwrap(res);
      const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
      expect(Array.isArray(items)).toBe(true);
      items.forEach((item: { id?: string; yearId?: string }) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('yearId', yearId);
      });
    });

    it('200 with academicYearId in query (alias)', async () => {
      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ academicYearId: yearId })
        .set('Authorization', `Bearer ${director.token}`)
        .expect(200);

      const raw = unwrap(res);
      const items = Array.isArray(raw) ? raw : (raw?.data ?? []);
      expect(Array.isArray(items)).toBe(true);
    });

    it('year-scoping: class in year1 not visible when querying year2', async () => {
      const year2 = await prisma.academicYear.create({
        data: {
          orgId: director.orgId,
          label: `RG Year2 ${Date.now()}`,
          startsAt: new Date('2026-09-01'),
          endsAt: new Date('2027-06-30'),
          isCurrent: false,
        },
        select: { id: true },
      });

      const resYear2 = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId: year2.id })
        .set('Authorization', `Bearer ${director.token}`)
        .expect(200);

      const raw2 = unwrap(resYear2);
      const itemsYear2 = Array.isArray(raw2) ? raw2 : (raw2?.data ?? []);
      const year1Ids = itemsYear2
        .filter((i: { yearId?: string }) => i.yearId === yearId)
        .map((i: { id?: string }) => i.id);
      expect(year1Ids).toHaveLength(0);

      const resYear1 = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId })
        .set('Authorization', `Bearer ${director.token}`)
        .expect(200);

      const raw1 = unwrap(resYear1);
      const itemsYear1 = Array.isArray(raw1) ? raw1 : (raw1?.data ?? []);
      expect(itemsYear1.length).toBeGreaterThanOrEqual(1);
      expect(itemsYear1.every((i: { yearId?: string }) => i.yearId === yearId)).toBe(true);

      await prisma.academicYear.deleteMany({ where: { id: year2.id } });
    });
  });

  describe('409 NO_ACTIVE_ACADEMIC_YEAR', () => {
    it('org without active year returns 409 on POST /classrooms', async () => {
      const orgNoActive = await prisma.organization.create({
        data: { name: `RG NoActive Org ${Date.now()}` },
        select: { id: true },
      });

      const yearInactive = await prisma.academicYear.create({
        data: {
          orgId: orgNoActive.id,
          label: 'Past',
          startsAt: new Date('2020-09-01'),
          endsAt: new Date('2021-06-30'),
          isCurrent: false,
        },
        select: { id: true },
      });

      const userNoActive = await prisma.user.create({
        data: {
          email: `rg_noactive_${Date.now()}@example.com`,
          name: 'No Active',
          passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
        },
        select: { id: true, email: true },
      });

      const membershipNoActive = await prisma.membership.create({
        data: {
          userId: userNoActive.id,
          organizationId: orgNoActive.id,
          role: OrganizationRole.DIRECTOR,
        },
        select: { id: true },
      });

      await prisma.user.update({
        where: { id: userNoActive.id },
        data: { lastActiveMembershipId: membershipNoActive.id },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: userNoActive.email, password: TEST_PASSWORD })
        .expect(201);
      const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
      if (!token) throw new Error('Missing token for no-active org');

      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          yearId: yearInactive.id,
          grade: 'GRADE_1',
          section: 'A',
        })
        .expect(409);

      const body = res.body;
      const code =
        body?.meta?.code ?? body?.data?.meta?.code ?? body?.code;
      expect(code).toBe('NO_ACTIVE_ACADEMIC_YEAR');

      await prisma.membership.deleteMany({ where: { organizationId: orgNoActive.id } });
      await prisma.user.deleteMany({ where: { id: userNoActive.id } });
      await prisma.academicYear.deleteMany({ where: { id: yearInactive.id } });
      await prisma.organization.deleteMany({ where: { id: orgNoActive.id } });
    });
  });

  describe('Enrollment flow', () => {
    let classId: string;
    let studentId: string;

    beforeAll(async () => {
      const clsRes = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${director.token}`)
        .send({ yearId, grade: 'GRADE_1', section: 'E', label: '1.E' })
        .expect(201);
      const cls = unwrap(clsRes);
      classId = cls.id;

      const studentUser = await prisma.user.create({
        data: {
          email: `rg_student_${Date.now()}@example.com`,
          name: 'RG Student',
          passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
        },
        select: { id: true },
      });
      const studentMembership = await prisma.membership.create({
        data: {
          userId: studentUser.id,
          organizationId: director.orgId,
          role: OrganizationRole.STUDENT,
        },
        select: { id: true },
      });
      const student = await prisma.student.create({
        data: {
          membershipId: studentMembership.id,
          orgId: director.orgId,
        },
        select: { id: true },
      });
      studentId = student.id;
    });

    it('POST /enrollments creates enrollment, student visible in GET /classrooms/:id', async () => {
      const enrollRes = await request(app.getHttpServer())
        .post('/enrollments')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          studentId,
          classSectionId: classId,
          yearId,
        })
        .expect(201);

      const enrollment = unwrap(enrollRes);
      expect(enrollment).toHaveProperty('id');
      expect(enrollment).toHaveProperty('studentId', studentId);
      expect(enrollment).toHaveProperty('classSectionId', classId);
      expect(enrollment).toHaveProperty('yearId', yearId);

      const detailRes = await request(app.getHttpServer())
        .get(`/classrooms/${classId}`)
        .set('Authorization', `Bearer ${director.token}`)
        .expect(200);

      const detail = unwrap(detailRes);
      expect(detail).toHaveProperty('enrollments');
      expect(Array.isArray(detail.enrollments)).toBe(true);
      const found = detail.enrollments.find(
        (e: { studentId: string }) => e.studentId === studentId,
      );
      expect(found).toBeDefined();
    });

    it('POST /enrollments with wrong yearId → 400', async () => {
      const otherYear = await prisma.academicYear.create({
        data: {
          orgId: director.orgId,
          label: `RG Other ${Date.now()}`,
          startsAt: new Date('2026-09-01'),
          endsAt: new Date('2027-06-30'),
          isCurrent: false,
        },
        select: { id: true },
      });

      await request(app.getHttpServer())
        .post('/enrollments')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          studentId,
          classSectionId: classId,
          yearId: otherYear.id,
        })
        .expect(400);

      await prisma.academicYear.deleteMany({ where: { id: otherYear.id } });
    });
  });
});
