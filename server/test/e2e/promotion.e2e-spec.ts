/**
 * E2E: Grade promotion (postup ročníku)
 *
 * - POST /academic-years/:fromYearId/promote creates new classrooms and copies enrollments
 * - Second promote for same fromYear returns 409
 * - Only DIRECTOR/OWNER can promote
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'PromotionE2E123!';

describe('Promotion (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let director: { token: string; orgId: string };
  let fromYearId: string;
  let toYearId: string;
  let classSectionId: string;
  let studentId: string;

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
      data: {
        name: `Promotion Org ${Date.now()}`,
        status: OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });

    const pastEnd = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const fromStart = new Date(pastEnd);
    fromStart.setFullYear(fromStart.getFullYear() - 1);
    fromStart.setMonth(8, 1);

    const fromYear = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: 'FromYear',
        startsAt: fromStart,
        endsAt: pastEnd,
        isCurrent: false,
      },
      select: { id: true },
    });
    fromYearId = fromYear.id;

    const toStart = new Date(pastEnd.getTime() + 24 * 60 * 60 * 1000);
    const toEnd = new Date(toStart);
    toEnd.setFullYear(toEnd.getFullYear() + 1);

    const toYear = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: 'ToYear',
        startsAt: toStart,
        endsAt: toEnd,
        isCurrent: true,
      },
      select: { id: true },
    });
    toYearId = toYear.id;

    const section = await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: fromYearId,
        grade: 'GRADE_6',
        section: 'A',
        label: '6.A',
      },
      select: { id: true },
    });
    classSectionId = section.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `promo_director_${Date.now()}@example.com`,
        name: 'Promo Director',
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

    const studentUser = await prisma.user.create({
      data: {
        email: `promo_student_${Date.now()}@example.com`,
        name: 'Promo Student',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const studentMembership = await prisma.membership.create({
      data: {
        userId: studentUser.id,
        organizationId: org.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: {
        membershipId: studentMembership.id,
        orgId: org.id,
      },
      select: { id: true },
    });
    studentId = student.id;

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classSectionId,
        yearId: fromYearId,
        orgId: org.id,
      },
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
    await prisma.promotionLog.deleteMany({ where: { organizationId: director.orgId } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { orgId: director.orgId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { orgId: director.orgId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { orgId: director.orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: director.orgId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { orgId: director.orgId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            `promo_director_${Date.now()}@example.com`,
            `promo_student_${Date.now()}@example.com`,
          ].filter(Boolean),
        },
      },
    }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { contains: 'promo_director_' } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { contains: 'promo_student_' } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: director.orgId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /academic-years/:fromYearId/promote creates new classrooms and copies students', async () => {
    const res = await request(app.getHttpServer())
      .post(`/academic-years/${fromYearId}/promote`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({ toYearId })
      .expect(201);

    const data = unwrap(res);
    expect(data).toHaveProperty('fromYearId', fromYearId);
    expect(data).toHaveProperty('toYearId', toYearId);
    expect(data.classroomsCreated).toBeGreaterThanOrEqual(1);
    expect(data.studentsEnrolled).toBeGreaterThanOrEqual(1);

    const listRes = await request(app.getHttpServer())
      .get('/class-sections')
      .query({ yearId: toYearId })
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);

    const list = unwrap(listRes);
    const items = Array.isArray(list) ? list : list?.data ?? list?.items ?? [];
    const promotedClass = items.find(
      (c: { grade: string; section: string }) =>
        c.grade === 'GRADE_7' && c.section === 'A',
    );
    expect(promotedClass).toBeDefined();
    expect(promotedClass).toHaveProperty('id');

    const enrollmentsRes = await request(app.getHttpServer())
      .get(`/classrooms/${promotedClass.id}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);

    const detail = unwrap(enrollmentsRes);
    const enrollments = detail?.enrollments ?? [];
    const foundStudent = enrollments.find(
      (e: { studentId: string }) => e.studentId === studentId,
    );
    expect(foundStudent).toBeDefined();
  });

  it('POST /academic-years/:fromYearId/promote again returns 409', async () => {
    const res = await request(app.getHttpServer())
      .post(`/academic-years/${fromYearId}/promote`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({ toYearId })
      .expect(409);

    expect(res.body?.message ?? res.body?.error).toBeDefined();
  });

  it('when student already has enrollment in target year, promotion succeeds and skips that enrollment', async () => {
    const orgSkip = await prisma.organization.create({
      data: {
        name: `Promo Skip Org ${Date.now()}`,
        status: OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });
    const pastEnd = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const fromStart = new Date(pastEnd);
    fromStart.setFullYear(fromStart.getFullYear() - 1);
    fromStart.setMonth(8, 1);
    const fromY = await prisma.academicYear.create({
      data: {
        orgId: orgSkip.id,
        label: 'SkipFrom',
        startsAt: fromStart,
        endsAt: pastEnd,
        isCurrent: false,
      },
      select: { id: true },
    });
    const toStart = new Date(pastEnd.getTime() + 86400000);
    const toY = await prisma.academicYear.create({
      data: {
        orgId: orgSkip.id,
        label: 'SkipTo',
        startsAt: toStart,
        endsAt: new Date(toStart.getTime() + 365 * 86400000),
        isCurrent: true,
      },
      select: { id: true },
    });
    const sectionFrom = await prisma.classSection.create({
      data: {
        orgId: orgSkip.id,
        yearId: fromY.id,
        grade: 'GRADE_5',
        section: 'A',
        label: '5.A',
      },
      select: { id: true },
    });
    const sectionTo = await prisma.classSection.create({
      data: {
        orgId: orgSkip.id,
        yearId: toY.id,
        grade: 'GRADE_6',
        section: 'A',
        label: '6.A',
      },
      select: { id: true },
    });
    const pwHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const userSkip = await prisma.user.create({
      data: {
        email: `promo_skip_${Date.now()}@example.com`,
        name: 'Skip Director',
        passwordHash: pwHash,
      },
      select: { id: true, email: true },
    });
    const memSkip = await prisma.membership.create({
      data: {
        userId: userSkip.id,
        organizationId: orgSkip.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
    await prisma.user.update({
      where: { id: userSkip.id },
      data: { lastActiveMembershipId: memSkip.id },
    });
    const studentUserSkip = await prisma.user.create({
      data: {
        email: `promo_skip_stu_${Date.now()}@example.com`,
        name: 'Skip Student',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const studentMemSkip = await prisma.membership.create({
      data: {
        userId: studentUserSkip.id,
        organizationId: orgSkip.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    const studentSkip = await prisma.student.create({
      data: {
        membershipId: studentMemSkip.id,
        orgId: orgSkip.id,
      },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentSkip.id,
        classSectionId: sectionFrom.id,
        yearId: fromY.id,
        orgId: orgSkip.id,
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentSkip.id,
        classSectionId: sectionTo.id,
        yearId: toY.id,
        orgId: orgSkip.id,
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userSkip.email, password: TEST_PASSWORD })
      .expect(201);
    const tokenSkip = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
    if (!tokenSkip) throw new Error('Missing token');

    const res = await request(app.getHttpServer())
      .post(`/academic-years/${fromY.id}/promote`)
      .set('Authorization', `Bearer ${tokenSkip}`)
      .send({ toYearId: toY.id })
      .expect(201);

    const log = await prisma.promotionLog.findUnique({
      where: {
        organizationId_fromYearId: { organizationId: orgSkip.id, fromYearId: fromY.id },
      },
      select: { enrollmentsSkippedCount: true },
    });
    expect(log).toBeDefined();
    expect(log!.enrollmentsSkippedCount).toBeGreaterThanOrEqual(1);

    await prisma.promotionLog.deleteMany({ where: { organizationId: orgSkip.id } }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { orgId: orgSkip.id } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { orgId: orgSkip.id } }).catch(() => {});
    await prisma.student.deleteMany({ where: { orgId: orgSkip.id } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgSkip.id } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { orgId: orgSkip.id } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        id: { in: [userSkip.id, studentUserSkip.id] },
      },
    }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgSkip.id } }).catch(() => {});
  });

  it('concurrency: two parallel promote calls — one succeeds, one returns 409', async () => {
    const orgConcur = await prisma.organization.create({
      data: {
        name: `Promo Concur Org ${Date.now()}`,
        status: OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });
    const pastEnd = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const fromStart = new Date(pastEnd);
    fromStart.setFullYear(fromStart.getFullYear() - 1);
    fromStart.setMonth(8, 1);
    const fromY = await prisma.academicYear.create({
      data: {
        orgId: orgConcur.id,
        label: 'ConcurFrom',
        startsAt: fromStart,
        endsAt: pastEnd,
        isCurrent: false,
      },
      select: { id: true },
    });
    const toStart = new Date(pastEnd.getTime() + 86400000);
    const toY = await prisma.academicYear.create({
      data: {
        orgId: orgConcur.id,
        label: 'ConcurTo',
        startsAt: toStart,
        endsAt: new Date(toStart.getTime() + 365 * 86400000),
        isCurrent: true,
      },
      select: { id: true },
    });
    await prisma.classSection.create({
      data: {
        orgId: orgConcur.id,
        yearId: fromY.id,
        grade: 'GRADE_5',
        section: 'A',
        label: '5.A',
      },
    });
    const pwHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const userConcur = await prisma.user.create({
      data: {
        email: `promo_concur_${Date.now()}@example.com`,
        name: 'Concur Director',
        passwordHash: pwHash,
      },
      select: { id: true, email: true },
    });
    const memConcur = await prisma.membership.create({
      data: {
        userId: userConcur.id,
        organizationId: orgConcur.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
    await prisma.user.update({
      where: { id: userConcur.id },
      data: { lastActiveMembershipId: memConcur.id },
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: userConcur.email, password: TEST_PASSWORD })
      .expect(201);
    const tokenConcur = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
    if (!tokenConcur) throw new Error('Missing token');

    const base = () =>
      request(app.getHttpServer())
        .post(`/academic-years/${fromY.id}/promote`)
        .set('Authorization', `Bearer ${tokenConcur}`)
        .send({ toYearId: toY.id });

    const [res1, res2] = await Promise.all([base(), base()]);

    const statuses = [res1.status, res2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
  });
});
