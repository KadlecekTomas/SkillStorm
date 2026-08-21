import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import {
  OrganizationRole,
  OrganizationStatus,
  SchoolGrade,
} from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { ImportsService } from '@/imports/imports.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { hashToken } from '@/auth/token.util';

function cookieValue(response: request.Response, name: string): string {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = cookies
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.match(new RegExp(`^${name}=([^;]+)`));
  if (!match?.[1]) throw new Error(`Missing ${name} cookie`);
  return decodeURIComponent(match[1]);
}

describe('Imported account first-login lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let imports: ImportsService;
  let orgId: string;
  let yearId: string;
  let classId: string;
  let directorId: string;
  let directorMembershipId: string;
  let firstEmail: string;
  let secondEmail: string;
  let firstPassword: string;
  let secondPassword: string;
  let firstUserId: string;

  const newPassword = 'StudentSecure987!';
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    imports = app.get(ImportsService);

    const org = await prisma.organization.create({
      data: {
        name: `First Login Org ${suffix}`,
        status: OrganizationStatus.ACTIVE,
        settings: {
          create: {
            initialPassword: 'SharedPredictable9!',
            forceResetOnFirstLogin: true,
          },
        },
      },
      select: { id: true },
    });
    orgId = org.id;

    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label: `2026/${suffix}`,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-12-31T23:59:59.000Z'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;

    const classSection = await prisma.classSection.create({
      data: {
        orgId,
        yearId,
        grade: SchoolGrade.GRADE_7,
        section: 'A',
        label: '7.A',
      },
      select: { id: true },
    });
    classId = classSection.id;

    const director = await prisma.user.create({
      data: {
        email: `first_login_director_${suffix}@example.com`,
        name: 'First Login Director',
        passwordHash: await bcrypt.hash('Director987!', 10),
      },
      select: { id: true, email: true },
    });
    directorId = director.id;
    const membership = await prisma.membership.create({
      data: {
        userId: director.id,
        organizationId: orgId,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
    directorMembershipId = membership.id;

    firstEmail = `imported_first_${suffix}@example.com`;
    secondEmail = `imported_second_${suffix}@example.com`;
    const result = await imports.commitStudents(
      {
        academicYearId: yearId,
        defaultClassSectionId: classId,
        rows: [
          {
            firstName: 'Anna',
            lastName: 'Prvni',
            email: firstEmail,
            class: '7.A',
          },
          {
            firstName: 'Boris',
            lastName: 'Druhy',
            email: secondEmail,
            class: '7.A',
          },
        ],
      },
      {
        userId: directorId,
        email: director.email!,
        membershipId: directorMembershipId,
        organizationId: orgId,
        organizationRole: OrganizationRole.DIRECTOR,
      },
    );

    const successes = result.results.filter((row) => row.status === 'IMPORTED');
    firstPassword = successes[0]?.temporaryPassword ?? '';
    secondPassword = successes[1]?.temporaryPassword ?? '';
    const first = await prisma.user.findUniqueOrThrow({
      where: { email: firstEmail },
      select: { id: true },
    });
    firstUserId = first.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates unique unpredictable credentials instead of the organization template', () => {
    expect(firstPassword).toBeTruthy();
    expect(secondPassword).toBeTruthy();
    expect(firstPassword).not.toBe(secondPassword);
    expect(firstPassword).not.toBe('SharedPredictable9!');
    expect(secondPassword).not.toBe('SharedPredictable9!');
  });

  it('persists only hashes and marks imported users according to policy', async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [firstEmail, secondEmail] } },
      select: { passwordHash: true, mustChangePassword: true },
    });
    expect(users).toHaveLength(2);
    users.forEach((user) => {
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user.passwordHash).not.toBe(firstPassword);
      expect(user.passwordHash).not.toBe(secondPassword);
      expect(user.mustChangePassword).toBe(true);
    });
  });

  it('writes import lifecycle audit events without credential material', async () => {
    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        action: { in: ['STUDENT_IMPORTED', 'PASSWORD_CHANGE_REQUIRED'] },
      },
    });
    expect(
      logs.filter((log) => log.action === 'STUDENT_IMPORTED'),
    ).toHaveLength(2);
    expect(
      logs.filter((log) => log.action === 'PASSWORD_CHANGE_REQUIRED'),
    ).toHaveLength(2);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(firstPassword);
    expect(serialized).not.toContain(secondPassword);
    expect(logs.every((log) => log.userId === directorId)).toBe(true);
  });

  it('reports the required state at login and permits only lifecycle context', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: firstEmail, password: firstPassword })
      .expect(201);
    const access = cookieValue(login, 'ss_at');

    expect(login.body.user.mustChangePassword).toBe(true);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);
    expect(me.body.user.mustChangePassword).toBe(true);

    const blocked = await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${access}`)
      .send({ orgId })
      .expect(403);
    expect(blocked.body.code ?? blocked.body.meta?.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );
  });

  it('allows refresh and logout while the account is restricted', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: secondEmail, password: secondPassword })
      .expect(201);
    const refresh = cookieValue(login, 'ss_rt');

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`ss_rt=${refresh}`])
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', [`ss_rt=${refresh}`])
      .expect(201);
  });

  it('rejects a wrong current password, weak password, and password reuse without clearing state', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: firstEmail, password: firstPassword })
      .expect(201);
    const access = cookieValue(login, 'ss_at');

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${access}`)
      .send({ currentPassword: 'Wrong987!', newPassword })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${access}`)
      .send({ currentPassword: firstPassword, newPassword: 'weak' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${access}`)
      .send({ currentPassword: firstPassword, newPassword: firstPassword })
      .expect(400);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: firstUserId },
      select: { mustChangePassword: true },
    });
    expect(user.mustChangePassword).toBe(true);
  });

  it('atomically changes the password, clears the flag, revokes sessions, and issues a fresh session', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: firstEmail, password: firstPassword })
      .expect(201);
    const oldAccess = cookieValue(login, 'ss_at');
    const oldRefresh = cookieValue(login, 'ss_rt');

    const changed = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${oldAccess}`)
      .send({
        currentPassword: firstPassword,
        newPassword,
        userId: directorId,
      })
      .expect(400);
    expect(changed.body).toBeDefined();

    const success = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${oldAccess}`)
      .send({ currentPassword: firstPassword, newPassword })
      .expect(201);
    const freshAccess = cookieValue(success, 'ss_at');
    expect(success.body.user.id).toBe(firstUserId);
    expect(success.body.user.mustChangePassword).toBe(false);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${oldAccess}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`ss_rt=${oldRefresh}`])
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${freshAccess}`)
      .send({ orgId })
      .expect(201);

    const oldRefreshRow = await prisma.refreshToken.findFirst({
      where: { token: hashToken(oldRefresh) },
    });
    expect(oldRefreshRow?.revokedAt).toBeTruthy();
  });

  it('invalidates the temporary credential and accepts the new password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: firstEmail, password: firstPassword })
      .expect(401);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: firstEmail, password: newPassword })
      .expect(201);
    expect(login.body.user.mustChangePassword).toBe(false);
  });

  it('records PASSWORD_CHANGED once without either password', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entityId: firstUserId, action: 'PASSWORD_CHANGED' },
    });
    expect(logs).toHaveLength(1);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(firstPassword);
    expect(serialized).not.toContain(newPassword);
  });

  it('allows only one concurrent first-login completion to win', async () => {
    const email = `concurrent_${suffix}@example.com`;
    const imported = await imports.commitStudents(
      {
        academicYearId: yearId,
        defaultClassSectionId: classId,
        rows: [
          { firstName: 'Dana', lastName: 'Souběžná', email, class: '7.A' },
        ],
      },
      {
        userId: directorId,
        email: 'director@example.com',
        membershipId: directorMembershipId,
        organizationId: orgId,
        organizationRole: OrganizationRole.DIRECTOR,
      },
    );
    const temporaryPassword = imported.results[0]?.temporaryPassword ?? '';
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: temporaryPassword })
      .expect(201);
    const access = cookieValue(login, 'ss_at');

    const attempts = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${access}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'Concurrent111!',
        }),
      request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${access}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'Concurrent222!',
        }),
    ]);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      201, 401,
    ]);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true, mustChangePassword: true },
    });
    expect(user.mustChangePassword).toBe(false);
    expect(
      await prisma.auditLog.count({
        where: { entityId: user.id, action: 'PASSWORD_CHANGED' },
      }),
    ).toBe(1);
  });

  it('leaves existing and policy-disabled accounts unrestricted', async () => {
    const existing = await prisma.user.create({
      data: {
        email: `existing_${suffix}@example.com`,
        name: 'Existing User',
        passwordHash: await bcrypt.hash('Existing987!', 10),
      },
      select: { id: true, mustChangePassword: true },
    });
    expect(existing.mustChangePassword).toBe(false);

    await prisma.organizationSettings.update({
      where: { orgId },
      data: { forceResetOnFirstLogin: false },
    });
    const disabledEmail = `policy_disabled_${suffix}@example.com`;
    const imported = await imports.commitStudents(
      {
        academicYearId: yearId,
        defaultClassSectionId: classId,
        rows: [
          {
            firstName: 'Cyril',
            lastName: 'Volny',
            email: disabledEmail,
            class: '7.A',
          },
        ],
      },
      {
        userId: directorId,
        email: 'director@example.com',
        membershipId: directorMembershipId,
        organizationId: orgId,
        organizationRole: OrganizationRole.DIRECTOR,
      },
    );
    const credential = imported.results[0];
    expect(credential?.temporaryPassword).toBeTruthy();
    expect(credential?.mustChangePassword).toBe(false);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: disabledEmail, password: credential?.temporaryPassword })
      .expect(201);
    expect(login.body.user.mustChangePassword).toBe(false);
    const access = cookieValue(login, 'ss_at');
    await request(app.getHttpServer())
      .post('/auth/use-org')
      .set('Authorization', `Bearer ${access}`)
      .send({ orgId })
      .expect(201);

    const requiredAudit = await prisma.auditLog.count({
      where: {
        entityId: login.body.user.id,
        action: 'PASSWORD_CHANGE_REQUIRED',
      },
    });
    expect(requiredAudit).toBe(0);
  });
});
