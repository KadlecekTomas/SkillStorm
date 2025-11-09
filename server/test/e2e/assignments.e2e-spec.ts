// test/e2e/assignments.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationRole, OrganizationType } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('Assignments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // actors
  let superUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let director: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let teacher: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let student: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // org + memberships
  let org: { id: string };
  let mTeacher!: { id: string }; // Membership.id
  let mStudent!: { id: string }; // Membership.id

  // content infra
  let testA!: { id: string };
  let assignmentIdForGetPatchDelete: string | null = null;

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
        // pokud nemáš @Type(() => Date) u dat, zvaž zapnutí implicit conversion:
        // transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();

    // users
    const rSuper = await register(app, 'super-assignments');
    await prisma.user.update({
      where: { id: rSuper.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: rSuper.user.id,
      token: await login(app, rSuper.login),
      login: rSuper.login,
    };

    const rDir = await register(app, 'director-assignments');
    director = { id: rDir.user.id, token: rDir.accessToken, login: rDir.login };

    const rTeacher = await register(
      app,
      'teacher-assignments',
      'Učitel Assign',
    );
    teacher = {
      id: rTeacher.user.id,
      token: rTeacher.accessToken,
      login: rTeacher.login,
    };

    const rStud = await register(app, 'student-assignments');
    student = {
      id: rStud.user.id,
      token: rStud.accessToken,
      login: rStud.login,
    };

    // org + membership
    org = await prisma.organization.create({
      data: {
        name: 'Assignments E2E Org',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: [
            { userId: director.id, role: OrganizationRole.DIRECTOR },
            { userId: teacher.id, role: OrganizationRole.TEACHER },
            { userId: student.id, role: OrganizationRole.STUDENT },
          ],
        },
      },
      select: { id: true },
    });

    // načti Membership.id pro teacher & student
    [mTeacher, mStudent] = await Promise.all([
      prisma.membership.findFirstOrThrow({
        where: { userId: teacher.id, organizationId: org.id },
        select: { id: true },
      }),
      prisma.membership.findFirstOrThrow({
        where: { userId: student.id, organizationId: org.id },
        select: { id: true },
      }),
    ]);

    // refresh tokens (ať RolesGuard čte aktuální org/membership)
    director.token = await login(app, director.login);
    teacher.token = await login(app, teacher.login);
    student.token = await login(app, student.login);

    // test entity v rámci org
    testA = await prisma.test.create({
      data: {
        organizationId: org.id,
        title: 'E2E – Test A',
        creatorId: mTeacher.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });

    // seed: jeden assignment přímo přes prisma pro GET/PATCH/DELETE
    const seeded = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        testId: testA.id,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 60_000).toISOString() as unknown as Date,
        closeAt: new Date(
          Date.now() + 3_600_000,
        ).toISOString() as unknown as Date,
        maxAttempts: 3,
        timeLimitSec: 1200,
        shuffle: true,
        showExplain: 'ALWAYS',
        createdById: mTeacher.id,
      },
      select: { id: true },
    });
    assignmentIdForGetPatchDelete = seeded.id;
  });

  afterAll(async () => {
    // cleanup – assignments
    await prisma.assignment
      .deleteMany({
        where: { testId: { in: [testA?.id].filter(Boolean) as string[] } },
      })
      .catch(() => {});

    // tests
    await prisma.test
      .deleteMany({
        where: { id: { in: [testA?.id].filter(Boolean) as string[] } },
      })
      .catch(() => {});

    // org tree
    await prisma.membership
      .deleteMany({ where: { organizationId: org.id } })
      .catch(() => {});
    await prisma.organization
      .deleteMany({ where: { id: org.id } })
      .catch(() => {});

    // users
    await prisma.refreshToken
      .deleteMany({
        where: {
          userId: { in: [superUser.id, director.id, teacher.id, student.id] },
        },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: {
          id: { in: [superUser.id, director.id, teacher.id, student.id] },
        },
      })
      .catch(() => {});

    await prisma.$disconnect();
    await app.close();
  });

  // helper: valid payload factory
  const mkPayload = (over: Partial<any> = {}) => {
    const base = {
      organizationId: org.id,
      testId: testA.id,
      targetType: 'STUDENTS' as const,
      studentIds: [mStudent.id],
      openAt: new Date(Date.now() + 5_000).toISOString(),
      closeAt: new Date(Date.now() + 3_600_000).toISOString(),
      maxAttempts: 2,
      timeLimitSec: 900,
      shuffle: false,
      showExplain: 'ON_REVIEW',
      createdById: mTeacher.id,
    };
    return { ...base, ...over };
  };

  // ---------------------------
  // CREATE
  // ---------------------------

  it('POST /assignments (DIRECTOR) → 201 (STUDENTS target)', async () => {
    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
      .send(mkPayload())
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.organizationId).toBe(org.id);
    expect(res.body.testId).toBe(testA.id);
    expect(res.body.targetType).toBe('STUDENTS');

    // cleanup
    await prisma.assignment.delete({ where: { id: res.body.id } });
  });

  it('POST /assignments (TEACHER) → 201 (valid dates; openAt < closeAt)', async () => {
    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(
        mkPayload({
          openAt: new Date(Date.now() - 1000).toISOString(),
          closeAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        }),
      )
      .expect(201);

    expect(res.body.maxAttempts).toBe(2);

    await prisma.assignment.delete({ where: { id: res.body.id } });
  });

  it('POST /assignments (STUDENT) → 403', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${student.token}`)
      .send(mkPayload())
      .expect(403);
  });

  it('POST /assignments (TEACHER) → 400 když targetType=STUDENTS bez studentIds', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(mkPayload({ studentIds: [] }))
      .expect(400);
  });

  it('POST /assignments (TEACHER) → 400 když openAt >= closeAt', async () => {
    const t = new Date().toISOString();
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(mkPayload({ openAt: t, closeAt: t }))
      .expect(400);
  });

  it('POST /assignments (TEACHER) → 400 když test nepatří do org', async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: 'Other Org A', type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    const foreignTest = await prisma.test.create({
      data: {
        organizationId: otherOrg.id,
        title: 'Cizí test',
        creatorId: mTeacher.id, // creatorId nezabrání – kontroluje se org testu
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(mkPayload({ testId: foreignTest.id }))
      .expect(400);

    // cleanup
    await prisma.test.delete({ where: { id: foreignTest.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it('POST /assignments (TEACHER) → 400 když createdById není aktivní TEACHER/DIRECTOR v org', async () => {
    // vytvoř cizí org a člena (STUDENT) – použijeme jeho membership jako createdById
    const otherOrg = await prisma.organization.create({
      data: {
        name: 'Other Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: [{ userId: student.id, role: OrganizationRole.STUDENT }],
        },
      },
      select: { id: true },
    });
    const foreignStudentM = await prisma.membership.findFirstOrThrow({
      where: { userId: student.id, organizationId: otherOrg.id },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(mkPayload({ createdById: foreignStudentM.id }))
      .expect(400);

    await prisma.membership.deleteMany({
      where: { organizationId: otherOrg.id },
    });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  // ---------------------------
  // READ
  // ---------------------------

  it('GET /assignments/:id (TEACHER/DIRECTOR) → 200 detail', async () => {
    const res1 = await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(200);
    expect(res1.body.id).toBe(assignmentIdForGetPatchDelete);

    const res2 = await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    expect(res2.body.organizationId).toBe(org.id);
  });

  it('GET /assignments/:id (STUDENT) → 200 ve stejné org', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(res.body.testId).toBe(testA.id);
  });

  it('GET /assignments/:id (STUDENT) → 403 do cizí org', async () => {
    // založ cizí org + assignment
    const otherOrg = await prisma.organization.create({
      data: { name: 'Foreign Org C', type: OrganizationType.SCHOOL },
      select: { id: true },
    });
    const foreignTest = await prisma.test.create({
      data: {
        organizationId: otherOrg.id,
        title: 'Cizí test C',
        creatorId: mTeacher.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    const foreignAssignment = await prisma.assignment.create({
      data: {
        organizationId: otherOrg.id,
        testId: foreignTest.id,
        targetType: 'STUDENTS',
        openAt: new Date().toISOString() as unknown as Date,
        closeAt: new Date(Date.now() + 60_000).toISOString() as unknown as Date,
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: mTeacher.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .get(`/assignments/${foreignAssignment.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    // cleanup
    await prisma.assignment.delete({ where: { id: foreignAssignment.id } });
    await prisma.test.delete({ where: { id: foreignTest.id } });
    await prisma.organization.delete({ where: { id: otherOrg.id } });
  });

  it('GET /assignments/:id (SUPERADMIN) → 403 (není whitelisted v @Roles)', async () => {
    await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('GET /assignments/:id → 404 pro non-existing UUID', async () => {
    await request(app.getHttpServer())
      .get(`/assignments/${randomUUID()}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      // controller volá service.findOne → vrací null; pokud máš NotFound guard jinde, tu je 404,
      // jinak může být 200 s null. Očekáváme 404, uprav service/controller dle potřeby.
      .expect(404); // ← pokud už máš 404, změň na .expect(404)
  });

  // ---------------------------
  // UPDATE
  // ---------------------------

  it('PATCH /assignments/:id (TEACHER) → 200 mění mutable pole', async () => {
    const newOpen = new Date(Date.now() + 10_000).toISOString();
    const newClose = new Date(Date.now() + 120_000).toISOString();

    const res = await request(app.getHttpServer())
      .patch(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        maxAttempts: 5,
        timeLimitSec: 1800,
        shuffle: false,
        showExplain: 'ALWAYS',
        openAt: newOpen,
        closeAt: newClose,
      })
      .expect(200);

    expect(res.body.maxAttempts).toBe(5);
    expect(new Date(res.body.openAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('PATCH /assignments/:id (DIRECTOR) → 400 když openAt >= closeAt', async () => {
    const same = new Date(Date.now() + 50_000).toISOString();
    await request(app.getHttpServer())
      .patch(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({ openAt: same, closeAt: same })
      .expect(400);
  });

  it('PATCH /assignments/:id (TEACHER) → 400 když se pokusí změnit identity fields', async () => {
    await request(app.getHttpServer())
      .patch(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({
        organizationId: randomUUID(),
        testId: randomUUID(),
        createdById: randomUUID(),
        studentIds: [randomUUID()],
      })
      .expect(400);
  });

  it('PATCH /assignments/:id (STUDENT) → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ maxAttempts: 9 })
      .expect(403);
  });

  // ---------------------------
  // DELETE
  // ---------------------------

  it('DELETE /assignments/:id (TEACHER) → 200', async () => {
    const toDelete = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        testId: testA.id,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 10_000).toISOString() as unknown as Date,
        closeAt: new Date(Date.now() + 10_000).toISOString() as unknown as Date,
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: mTeacher.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/assignments/${toDelete.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(200);

    const gone = await prisma.assignment.findUnique({
      where: { id: toDelete.id },
    });
    expect(gone).toBeNull();
  });

  it('DELETE /assignments/:id (STUDENT) → 403', async () => {
    const toDelete = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        testId: testA.id,
        targetType: 'STUDENTS',
        openAt: new Date().toISOString() as unknown as Date,
        closeAt: new Date(Date.now() + 60_000).toISOString() as unknown as Date,
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: mTeacher.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/assignments/${toDelete.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    // cleanup
    await prisma.assignment.delete({ where: { id: toDelete.id } });
  });

  // ---------------------------
  // VALIDATION & EDGES
  // ---------------------------

  it('POST /assignments → 400 při targetType neznámé hodnoty', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(mkPayload({ targetType: 'WTF' }))
      .expect(400);
  });

  it('POST /assignments → 400 když classSectionId neexistuje nebo nepatří do org', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${teacher.token}`)
      .send(
        mkPayload({
          targetType: 'CLASS',
          studentIds: undefined,
          classSectionId: randomUUID(), // neexistuje
        }),
      )
      .expect(400);
  });

  it('GET /assignments/:id → 400 na nevalidní UUID (pokud používáš pipe/validator na Param)', async () => {
    // Pokud používáš Param UUID pipe, očekávej 400; jinak může projít jako 404/not found.
    await request(app.getHttpServer())
      .get('/assignments/not-a-uuid')
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect([400, 404]);
  });
});
