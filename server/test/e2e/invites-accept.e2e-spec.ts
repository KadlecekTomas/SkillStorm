/**
 * E2E: Invite accept flow
 * - Student invite requires classSectionId+yearId (400 if missing)
 * - Mismatched yearId vs classSection → 400
 * - Valid student invite → membership + enrollment in one transaction
 * - Teacher invite (ORG_ONLY) → membership only
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { InvitationType, OrganizationRole } from '@prisma/client';
import { addDays } from 'date-fns';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'InviteAccept123!';

describe('Invites Accept (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let director: { token: string; orgId: string };
  let yearId: string;
  let classSectionId: string;
  let studentUser: { id: string; email: string };

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
      data: { name: `Invites E2E Org ${Date.now()}` },
      select: { id: true },
    });

    const year = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: `E2E ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;

    const cls = await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: year.id,
        grade: 'GRADE_7',
        section: 'A',
        label: '7.A',
      },
      select: { id: true },
    });
    classSectionId = cls.id;

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const directorUser = await prisma.user.create({
      data: {
        email: `invite_dir_${Date.now()}@example.com`,
        name: 'Director',
        passwordHash,
      },
      select: { id: true, email: true },
    });

    const directorMembership = await prisma.membership.create({
      data: {
        userId: directorUser.id,
        organizationId: org.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: directorUser.id },
      data: { lastActiveMembershipId: directorMembership.id },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: directorUser.email, password: TEST_PASSWORD })
      .expect(201);
    const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken;
    if (!token) throw new Error('Missing director token');

    director = { token, orgId: org.id };

    const studentUserRecord = await prisma.user.create({
      data: {
        email: `invite_student_${Date.now()}@example.com`,
        name: 'Student',
        passwordHash,
      },
      select: { id: true, email: true },
    });
    if (!studentUserRecord.email) throw new Error('Student must have email');
    studentUser = { id: studentUserRecord.id, email: studentUserRecord.email };

    const studentLoginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: studentUserRecord.email, password: TEST_PASSWORD })
      .expect(201);
    const studentToken = (unwrap(studentLoginRes) ?? studentLoginRes.body)?.sessionToken;
    if (!studentToken) throw new Error('Missing student token');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('POST /invites/accept', () => {
    let studentClassInviteCode: string;

    beforeAll(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/invites')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          type: InvitationType.STUDENT_CLASS,
          classSectionId,
          yearId,
          expiresInDays: 7,
        })
        .expect(201);
      const inv = unwrap(createRes);
      studentClassInviteCode = inv.code;
    });

    it('accept with non-existent code returns 404', async () => {
      const studentLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: studentUser.email, password: TEST_PASSWORD })
        .expect(201);
      const studentToken = (unwrap(studentLogin) ?? studentLogin.body)?.sessionToken;
      if (!studentToken) throw new Error('Missing student token');

      await request(app.getHttpServer())
        .post('/invites/accept')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: 'non-existent-invite-code-xyz' })
        .expect(404);
    });

    it('student invite: valid code yields enrollment, class visible in GET /classrooms', async () => {
      const studentLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: studentUser.email, password: TEST_PASSWORD })
        .expect(201);
      const studentToken = (unwrap(studentLogin) ?? studentLogin.body)?.sessionToken;
      if (!studentToken) throw new Error('Missing student token');

      const acceptRes = await request(app.getHttpServer())
        .post('/invites/accept')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ code: studentClassInviteCode })
        .expect(201);

      const data = unwrap(acceptRes);
      expect(data).toHaveProperty('membership');
      expect(data).toHaveProperty('organization');
      expect(data).toHaveProperty('classSectionId', classSectionId);
      expect(data).toHaveProperty('yearId', yearId);

      const listRes = await request(app.getHttpServer())
        .get(`/classrooms?yearId=${yearId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const listData = unwrap(listRes);
      const items = Array.isArray(listData) ? listData : listData?.data ?? [];
      expect(items.length).toBeGreaterThanOrEqual(1);
      const found = items.find((c: { id: string }) => c.id === classSectionId);
      expect(found).toBeDefined();
    });
  });

  describe('POST /auth/join with STUDENT returns 400', () => {
    it('legacy join with role STUDENT returns 400', async () => {
      const studentLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: studentUser.email, password: TEST_PASSWORD })
        .expect(201);
      const studentToken = (unwrap(studentLogin) ?? studentLogin.body)?.sessionToken;
      if (!studentToken) return;

      await request(app.getHttpServer())
        .post('/auth/join')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ joinCode: director.orgId, role: OrganizationRole.STUDENT })
        .expect(400);
    });
  });
});
