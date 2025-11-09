// test/e2e/tests.e2e-spec.ts
import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  $Enums,
  OrganizationType,
  OrganizationRole,
  PublishStatus,
  QuestionType,
} from '@prisma/client';
import { login, register } from 'test/helpers';

type ActorCase = {
  name: string;
  token: () => string;
  listOrg: () => string;
  createOrg: () => string;
  canUpdate: boolean;
  canDelete: boolean;
  expectList: number;
  expectDetail: readonly number[];
  expectCreate: number;
};

describe('Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // actors
  let superUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let directorA: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let directorB: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let teacherUserA1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // author in orgA
  let teacherUserA2: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // other teacher in orgA
  let teacherUserB1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // teacher in orgB
  let studentUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  // memberships (for convenience in tests)
  let mTA1: { id: string };
  let mTB1: { id: string };

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
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

    // users
    const rSuper = await register(app, 'super');
    await prisma.user.update({
      where: { id: rSuper.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: rSuper.user.id,
      token: await login(app, rSuper.login),
      login: rSuper.login,
    };

    const rDirA = await register(app, 'directorA');
    directorA = {
      id: rDirA.user.id,
      token: rDirA.accessToken,
      login: rDirA.login,
    };

    const rDirB = await register(app, 'directorB');
    directorB = {
      id: rDirB.user.id,
      token: rDirB.accessToken,
      login: rDirB.login,
    };

    const rTA1 = await register(app, 'teacherA1');
    teacherUserA1 = {
      id: rTA1.user.id,
      token: rTA1.accessToken,
      login: rTA1.login,
    };

    const rTA2 = await register(app, 'teacherA2');
    teacherUserA2 = {
      id: rTA2.user.id,
      token: rTA2.accessToken,
      login: rTA2.login,
    };

    const rTB1 = await register(app, 'teacherB1');
    teacherUserB1 = {
      id: rTB1.user.id,
      token: rTB1.accessToken,
      login: rTB1.login,
    };

    const rStud = await register(app, 'student');
    studentUser = {
      id: rStud.user.id,
      token: rStud.accessToken,
      login: rStud.login,
    };

    // org A & B
    orgA = await prisma.organization.create({
      data: {
        name: 'E2E Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: [{ userId: directorA.id, role: OrganizationRole.DIRECTOR }],
        },
      },
      select: { id: true },
    });
    orgB = await prisma.organization.create({
      data: {
        name: 'E2E Org B',
        type: OrganizationType.PRIVATE,
        memberships: {
          create: [{ userId: directorB.id, role: OrganizationRole.DIRECTOR }],
        },
      },
      select: { id: true },
    });

    // refresh directors (JWT with role)
    directorA.token = await login(app, directorA.login);
    directorB.token = await login(app, directorB.login);

    // memberships for teachers
    mTA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherUserA1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherUserA2.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    mTB1 = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: teacherUserB1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    // refresh teachers (JWT with role)
    teacherUserA1.token = await login(app, teacherUserA1.login);
    teacherUserA2.token = await login(app, teacherUserA2.login);
    teacherUserB1.token = await login(app, teacherUserB1.login);
  });

  afterAll(async () => {
    // hard cleanup: nejdřív test-related entities (questions/options/answers cascade via FK),
    // pak memberships/orgs/users/tokens
    await prisma.question.deleteMany({});
    await prisma.testAssignment.deleteMany({});
    await prisma.submission.deleteMany({});
    await prisma.test.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });

    await prisma.membership.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId: {
          in: [
            superUser.id,
            directorA.id,
            directorB.id,
            teacherUserA1.id,
            teacherUserA2.id,
            teacherUserB1.id,
            studentUser.id,
          ],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            superUser.id,
            directorA.id,
            directorB.id,
            teacherUserA1.id,
            teacherUserA2.id,
            teacherUserB1.id,
            studentUser.id,
          ],
        },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------
  // CREATE
  // ---------------------------

  it('POST /tests → 201 DIRECTOR orgA vytvoří test v orgA', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        title: 'Prověrka A1',
        organizationId: orgA.id,
        status: PublishStatus.DRAFT,
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();

    // cleanup (hard)
    await prisma.test.delete({ where: { id: res.body.id } });
  });

  it('POST /tests → 201 TEACHER orgA vytvoří test ve své org; cross-org 403', async () => {
    // own org ok
    const ok = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ title: 'Author Test', organizationId: orgA.id })
      .expect(201);

    // cross-org forbidden
    await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ title: 'Nope', organizationId: orgB.id })
      .expect(403);

    await prisma.test.delete({ where: { id: ok.body.id } });
  });

  it('POST /tests (SUPERADMIN) → 201 libovolná org', async () => {
    const res = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({
        title: 'Global admin can create anywhere',
        organizationId: orgB.id,
      })
      .expect(201);
    await prisma.test.delete({ where: { id: res.body.id } });
  });

  // ---------------------------
  // LIST + SEARCH + PAGINATION
  // ---------------------------

  it('GET /tests → 200 DIRECTOR orgA vidí jen testy své org; SUPERADMIN může přepnout organizationId', async () => {
    // seed: 2 tests in orgA, 1 in orgB
    const seedA = await prisma.$transaction([
      prisma.test.create({
        data: {
          title: 'A: Algebra',
          organizationId: orgA.id,
          creatorId: mTA1.id,
        },
      }),
      prisma.test.create({
        data: {
          title: 'A: Fyzika',
          organizationId: orgA.id,
          creatorId: mTA1.id,
        },
      }),
    ]);
    const seedB = await prisma.test.create({
      data: { title: 'B: Chemie', organizationId: orgB.id, creatorId: mTB1.id },
    });

    const listA = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 50 })
      .expect(200);

    const itemsA = Array.isArray(listA.body)
      ? listA.body
      : (listA.body.items ?? []);
    const idsA = itemsA.map((x: any) => x.id);
    expect(idsA).toEqual(expect.arrayContaining(seedA.map((t) => t.id)));
    expect(idsA).not.toContain(seedB.id);

    // SUPERADMIN orgB
    const listB = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ organizationId: orgB.id, page: 1, limit: 50 })
      .expect(200);
    const itemsB = Array.isArray(listB.body)
      ? listB.body
      : (listB.body.items ?? []);
    expect(itemsB.map((x: any) => x.id)).toContain(seedB.id);
  });

  it('GET /tests?search=Algebra → 200 najde dle title (case-insensitive)', async () => {
    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, search: 'algebra', page: 1, limit: 50 })
      .expect(200);
    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const titles = items.map((x: any) => x.title.toLowerCase());
    expect(titles.some((t: string) => t.includes('algebra'))).toBe(true);
  });

  it('GET /tests → 200 stabilní řazení (createdAt desc, id asc) + pagination', async () => {
    // create a few to paginate
    const t1 = await prisma.test.create({
      data: { title: 'Pag-1', organizationId: orgA.id, creatorId: mTA1.id },
    });
    const t2 = await prisma.test.create({
      data: { title: 'Pag-2', organizationId: orgA.id, creatorId: mTA1.id },
    });

    const res1 = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 1 })
      .expect(200);
    const page1 = Array.isArray(res1.body)
      ? res1.body
      : (res1.body.items ?? []);
    expect(page1.length).toBe(1);

    const res2 = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 2, limit: 1 })
      .expect(200);
    const page2 = Array.isArray(res2.body)
      ? res2.body
      : (res2.body.items ?? []);
    expect(page2.length).toBe(1);
    expect(page1[0].id).not.toBe(page2[0].id);

    await prisma.test.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
  });

  // ---------------------------
  // DETAIL / GET :id
  // ---------------------------

  it('GET /tests/:id → 200 v rámci stejné org; 403 cross-org', async () => {
    const created = await prisma.test.create({
      data: { title: 'Detail-OK', organizationId: orgA.id, creatorId: mTA1.id },
    });

    await request(app.getHttpServer())
      .get(`/tests/${created.id}`)
      .set('Authorization', `Bearer ${teacherUserA2.token}`) // same org
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tests/${created.id}`)
      .set('Authorization', `Bearer ${teacherUserB1.token}`) // other org
      .expect((r) => {
        if (![403, 404].includes(r.status))
          throw new Error(`Expected 403/404, got ${r.status}`);
      });

    await prisma.test.delete({ where: { id: created.id } });
  });

  it('GET /tests/:id → 400 na nevalidní UUID', async () => {
    await request(app.getHttpServer())
      .get('/tests/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  // ---------------------------
  // UPDATE
  // ---------------------------

  it('PATCH /tests/:id → 200 autor teacher nebo director; jiný teacher 403', async () => {
    // author creates via API (so creatorId = mTA1.id)
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ title: 'Owned by A1', organizationId: orgA.id })
      .expect(201);

    // other teacher (same org) cannot update
    await request(app.getHttpServer())
      .patch(`/tests/${created.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA2.token}`)
      .send({ title: 'Nope' })
      .expect(403);

    // director can update
    await request(app.getHttpServer())
      .patch(`/tests/${created.body.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ title: 'Director OK', status: PublishStatus.PUBLISHED })
      .expect(200);

    // author can update
    await request(app.getHttpServer())
      .patch(`/tests/${created.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ description: 'Author updated' })
      .expect(200);

    // cleanup (hard)
    await prisma.test.delete({ where: { id: created.body.id } });
  });

  // ---------------------------
  // DELETE (soft via API) – allowed director/superadmin
  // ---------------------------

  it('DELETE /tests/:id → 403 teacher; 200 director', async () => {
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ title: 'To-delete', organizationId: orgA.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/tests/${created.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/tests/${created.body.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // detail after delete should be 404 (filtered by deletedAt)
    await request(app.getHttpServer())
      .get(`/tests/${created.body.id}?_=${Date.now()}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);

    // DB still contains soft-deleted row:
    const row = await prisma.test.findUnique({
      where: { id: created.body.id },
    });
    expect(row?.deletedAt).toBeTruthy();

    // hard cleanup
    await prisma.test
      .delete({ where: { id: created.body.id } })
      .catch(() => {});
  });

  // ---------------------------
  // NESTED: Questions / Options / Answers / Reorder
  // ---------------------------

  it('Nested CRUD → question + option + answer + reorder + delete', async () => {
    // create test as author A1 (creatorId = mTA1.id)
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ title: 'Nested Test', organizationId: orgA.id })
      .expect(201);

    const testId = created.body.id as string;

    // add questions
    const q1 = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ text: '1+1?', type: QuestionType.MULTIPLE_CHOICE, order: 0 })
      .expect(201);

    const q2 = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ text: '2+2?', type: QuestionType.MULTIPLE_CHOICE, order: 1 })
      .expect(201);

    // update question
    await request(app.getHttpServer())
      .patch(`/tests/${testId}/questions/${q2.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ text: '2+2 = ?', order: 5 })
      .expect(200);

    // add option + answer to q1
    const opt = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${q1.body.id}/options`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ text: '2' })
      .expect(201);

    const ans = await request(app.getHttpServer())
      .post(`/tests/${testId}/questions/${q1.body.id}/answers`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ text: '2' })
      .expect(201);

    // reorder questions (alias s dvojtečkou)
    await request(app.getHttpServer())
      .patch(`/tests/${testId}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [
          { id: q2.body.id, order: 0 },
          { id: q1.body.id, order: 1 },
        ],
      })
      .expect(200);

    // delete nested pieces
    await request(app.getHttpServer())
      .delete(`/tests/${testId}/questions/${q1.body.id}/answers/${ans.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/tests/${testId}/questions/${q1.body.id}/options/${opt.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/tests/${testId}/questions/${q2.body.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .expect(200);

    // final cleanup: delete test hard
    await prisma.test.delete({ where: { id: testId } });
  });

  // ---------------------------
  // STUDENT permissions (READ allowed, WRITE denied)
  // ---------------------------

  it('GET /tests (STUDENT) → 200 v rámci své org', async () => {
    // add student membership to orgA
    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: studentUser.id,
        role: OrganizationRole.STUDENT,
      },
    });
    studentUser.token = await login(app, studentUser.login);

    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 10 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    expect(Array.isArray(items)).toBe(true);
  });

  it('POST/PATCH/DELETE /tests (STUDENT) → 403', async () => {
    // try create
    await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({ title: 'Student nope', organizationId: orgA.id })
      .expect(403);

    // prepare one test owned by A1
    const created = await prisma.test.create({
      data: {
        title: 'For student ops',
        organizationId: orgA.id,
        creatorId: mTA1.id,
      },
    });

    // update
    await request(app.getHttpServer())
      .patch(`/tests/${created.id}`)
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({ title: 'Nope' })
      .expect(403);

    // delete
    await request(app.getHttpServer())
      .delete(`/tests/${created.id}`)
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(403);

    await prisma.test.delete({ where: { id: created.id } });
  });

  // ---------------------------
  // RBAC MATRIX (table-driven)
  // ---------------------------

  describe('Tests RBAC matrix', () => {
    let sampleId: string;

    beforeAll(async () => {
      const t = await prisma.test.create({
        data: {
          title: 'RBAC Sample',
          organizationId: orgA.id,
          creatorId: mTA1.id,
        },
      });
      sampleId = t.id;
    });

    afterAll(async () => {
      await prisma.test.delete({ where: { id: sampleId } }).catch(() => {});
    });

    const actors: ActorCase[] = [
      {
        name: 'SUPERADMIN',
        token: () => superUser.token,
        listOrg: () => orgA.id,
        createOrg: () => orgB.id,
        canUpdate: true,
        canDelete: true,
        expectList: 200,
        expectDetail: [200],
        expectCreate: 201,
      },
      {
        name: 'DIRECTOR_A',
        token: () => directorA.token,
        listOrg: () => orgA.id,
        createOrg: () => orgA.id,
        canUpdate: true,
        canDelete: true,
        expectList: 200,
        expectDetail: [200],
        expectCreate: 201,
      },
      {
        name: 'DIRECTOR_B',
        token: () => directorB.token,
        listOrg: () => orgB.id,
        createOrg: () => orgB.id,
        canUpdate: false, // against orgA sample
        canDelete: false,
        expectList: 200,
        expectDetail: [403, 404],
        expectCreate: 201,
      },
      {
        name: 'TEACHER_A1_author',
        token: () => teacherUserA1.token,
        listOrg: () => orgA.id,
        createOrg: () => orgA.id,
        canUpdate: true,
        canDelete: false,
        expectList: 200,
        expectDetail: [200],
        expectCreate: 201,
      },
      {
        name: 'TEACHER_A2_other',
        token: () => teacherUserA2.token,
        listOrg: () => orgA.id,
        createOrg: () => orgA.id,
        canUpdate: false,
        canDelete: false,
        expectList: 200,
        expectDetail: [200],
        expectCreate: 201,
      },
      {
        name: 'TEACHER_B1_otherOrg',
        token: () => teacherUserB1.token,
        listOrg: () => orgB.id,
        createOrg: () => orgB.id,
        canUpdate: false,
        canDelete: false,
        expectList: 200,
        expectDetail: [403, 404],
        expectCreate: 201,
      },
      {
        name: 'STUDENT',
        token: () => studentUser.token,
        listOrg: () => orgA.id,
        createOrg: () => orgA.id,
        canUpdate: false,
        canDelete: false,
        expectList: 200, // students mohou listovat v naší implementaci
        expectDetail: [200],
        expectCreate: 403,
      },
    ] as const;

    it.each(actors)(
      'RBAC list: $name',
      async ({ token, listOrg, expectList }) => {
        await request(app.getHttpServer())
          .get('/tests')
          .set('Authorization', `Bearer ${token()}`)
          .query({ organizationId: listOrg(), page: 1, limit: 5 })
          .expect(expectList);
      },
    );

    it.each(actors)('RBAC detail: $name', async ({ token, expectDetail }) => {
      await request(app.getHttpServer())
        .get(`/tests/${sampleId}`)
        .set('Authorization', `Bearer ${token()}`)
        .expect((r) => {
          if (!expectDetail.includes(r.status)) {
            throw new Error(
              `Expected ${expectDetail.join('/')} got ${r.status}`,
            );
          }
        });
    });

    it.each(actors)(
      'RBAC create: $name',
      async ({ token, createOrg, expectCreate }) => {
        const res = await request(app.getHttpServer())
          .post('/tests')
          .set('Authorization', `Bearer ${token()}`)
          .send({
            title: `RBAC Create ${Date.now()}`,
            organizationId: createOrg(),
          })
          .expect((r) => {
            if (
              r.status !== expectCreate &&
              !(expectCreate === 403 && [400, 403].includes(r.status))
            ) {
              throw new Error(`Expected ${expectCreate}, got ${r.status}`);
            }
          });

        if (res.status < 300 && res.body?.id) {
          await prisma.test.delete({ where: { id: res.body.id } });
        }
      },
    );

    it.each(actors)('RBAC update: $name', async ({ token, canUpdate }) => {
      const status = canUpdate ? 200 : 403;
      await request(app.getHttpServer())
        .patch(`/tests/${sampleId}`)
        .set('Authorization', `Bearer ${token()}`)
        .send({ title: `Upd ${Date.now()}` })
        .expect((r) => {
          if (r.status !== status)
            throw new Error(`Expected ${status}, got ${r.status}`);
        });
    });

    it.each(actors)('RBAC delete: $name', async ({ token, canDelete }) => {
      // create disposable test in orgA by author A1
      const disposable = await prisma.test.create({
        data: {
          title: 'Disposable',
          organizationId: orgA.id,
          creatorId: mTA1.id,
        },
      });
      const status = canDelete ? 200 : 403;

      await request(app.getHttpServer())
        .delete(`/tests/${disposable.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .expect((r) => {
          if (r.status !== status)
            throw new Error(`Expected ${status}, got ${r.status}`);
        });

      // hard cleanup if not deleted soft by API or still present
      await prisma.test
        .delete({ where: { id: disposable.id } })
        .catch(() => {});
    });
  });

  // ---------------------------
  // Validation & injection-ish smoke
  // ---------------------------

  it('GET /tests → 400 na nevalidní UUID v organizationId', async () => {
    await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: 'not-a-uuid', page: 1, limit: 10 })
      .expect(400);
  });

  it('GET /tests?search se speciálními znaky nepadá', async () => {
    for (const s of [`%'";--`, `(*)[?]`, `<script>alert(1)</script>`]) {
      await request(app.getHttpServer())
        .get('/tests')
        .set('Authorization', `Bearer ${directorA.token}`)
        .query({ organizationId: orgA.id, search: s, page: 1, limit: 5 })
        .expect(200);
    }
  });

  it('GET /tests → page za hranou vrátí prázdno a meta dává smysl', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 1000 })
      .expect(200);
    const body1 = Array.isArray(res1.body)
      ? { items: res1.body, meta: null }
      : res1.body;
    const pages = body1.meta?.pages ?? 1;

    const res2 = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: pages + 1, limit: 10 })
      .expect(200);
    const items2 = Array.isArray(res2.body)
      ? res2.body
      : (res2.body.items ?? []);
    expect(items2.length).toBe(0);
  });

  // ---------------------------
  // Edges: :reorder validation
  // ---------------------------

  it('PATCH /tests/:id/questions/reorder → 400 když některé question nepatří do testu', async () => {
    // create two tests and one question in each
    const tA = await prisma.test.create({
      data: { title: 'Reorder-A', organizationId: orgA.id, creatorId: mTA1.id },
    });
    const tB = await prisma.test.create({
      data: { title: 'Reorder-B', organizationId: orgA.id, creatorId: mTA1.id },
    });

    const qA = await prisma.question.create({
      data: {
        testId: tA.id,
        text: 'QA',
        type: QuestionType.TRUE_FALSE,
        order: 0,
      },
    });
    const qB = await prisma.question.create({
      data: {
        testId: tB.id,
        text: 'QB',
        type: QuestionType.TRUE_FALSE,
        order: 0,
      },
    });

    await request(app.getHttpServer())
      .patch(`/tests/${tA.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [
          { id: qA.id, order: 1 },
          { id: qB.id, order: 0 },
        ],
      }) // qB nepatří do tA
      .expect(400);

    await prisma.test.deleteMany({ where: { id: { in: [tA.id, tB.id] } } });
  });

  // ---- Reorder: obě trasy fungují (/reorder i :reorder) + shape odpovědi
  it('PATCH /tests/:id/questions/(re)order → 200 na obou alias cestách + {ok:true}', async () => {
    const t = await prisma.test.create({
      data: {
        title: 'Reorder-Alias',
        organizationId: orgA.id,
        creatorId: mTA1.id,
      },
    });
    const [q1, q2] = await prisma.$transaction([
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q1',
          type: QuestionType.TRUE_FALSE,
          order: 0,
        },
      }),
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q2',
          type: QuestionType.TRUE_FALSE,
          order: 1,
        },
      }),
    ]);

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [
          { id: q2.id, order: 0 },
          { id: q1.id, order: 1 },
        ],
      })
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ ok: true }));

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [
          { id: q1.id, order: 0 },
          { id: q2.id, order: 1 },
        ],
      })
      .expect(200)
      .expect((r) => expect(r.body).toMatchObject({ ok: true }));

    await prisma.test.delete({ where: { id: t.id } });
  });

  // ---- Reorder: duplicitní ID → 400 a žádná změna v DB
  it('PATCH /tests/:id/questions/reorder → 400 na duplicitních ID a nic se nezmění', async () => {
    const t = await prisma.test.create({
      data: {
        title: 'Reorder-Duplicates',
        organizationId: orgA.id,
        creatorId: mTA1.id,
      },
    });
    const [q1] = await prisma.$transaction([
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q1',
          type: QuestionType.TRUE_FALSE,
          order: 0,
        },
      }),
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q2',
          type: QuestionType.TRUE_FALSE,
          order: 1,
        },
      }),
    ]);
    const before = await prisma.question.findMany({
      where: { testId: t.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [
          { id: q1.id, order: 1 },
          { id: q1.id, order: 0 },
        ],
      })
      .expect(400);

    const after = await prisma.question.findMany({
      where: { testId: t.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    expect(after).toEqual(before);

    await prisma.test.delete({ where: { id: t.id } });
  });

  // ---- Reorder: prázdný payload / invalidní data → 400
  it('PATCH /tests/:id/questions/reorder → 400 na prázdný items', async () => {
    const t = await prisma.test.create({
      data: {
        title: 'Reorder-Empty',
        organizationId: orgA.id,
        creatorId: mTA1.id,
      },
    });

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ items: [] })
      .expect(400);

    await prisma.test.delete({ where: { id: t.id } });
  });

  it('PATCH /tests/:id/questions/reorder → 400 na neUUID id a non-number order', async () => {
    const t = await prisma.test.create({
      data: {
        title: 'Reorder-Invalid',
        organizationId: orgA.id,
        creatorId: mTA1.id,
      },
    });

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ items: [{ id: 'not-a-uuid', order: 0 }] })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [{ id: '00000000-0000-0000-0000-000000000000', order: 'x' }],
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({
        items: [{ id: '00000000-0000-0000-0000-000000000000', order: -1 }],
      })
      .expect(400);

    await prisma.test.delete({ where: { id: t.id } });
  });

  // ---- Reorder: partial subset povolen (jen zadané se změní)
  it('PATCH /tests/:id/questions/reorder → 200 partial subset mění jen uvedené', async () => {
    const t = await prisma.test.create({
      data: {
        title: 'Reorder-Partial',
        organizationId: orgA.id,
        creatorId: mTA1.id,
      },
    });
    const [q1, q2, q3] = await prisma.$transaction([
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q1',
          type: QuestionType.TRUE_FALSE,
          order: 0,
        },
      }),
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q2',
          type: QuestionType.TRUE_FALSE,
          order: 1,
        },
      }),
      prisma.question.create({
        data: {
          testId: t.id,
          text: 'Q3',
          type: QuestionType.TRUE_FALSE,
          order: 2,
        },
      }),
    ]);

    await request(app.getHttpServer())
      .patch(`/tests/${t.id}/questions/reorder`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .send({ items: [{ id: q3.id, order: 0 }] }) // změní se jen q3
      .expect(200);

    const after = await prisma.question.findMany({
      where: { testId: t.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    const orders: Record<string, number> = Object.fromEntries(
      after.map((q) => [q.id, q.order]),
    );
    expect(orders[q3.id]).toBe(0);
    expect(orders[q1.id]).toBe(0);
    expect(orders[q2.id]).toBe(1);

    await prisma.test.delete({ where: { id: t.id } });
  });

  // ---------------------------
  // Nested RBAC (questions/options/answers)
  // ---------------------------

  describe('Nested RBAC (questions/options/answers)', () => {
    let tId: string;
    let qId: string;

    beforeAll(async () => {
      const t = await prisma.test.create({
        data: {
          title: 'Nested-RBAC',
          organizationId: orgA.id,
          creatorId: mTA1.id,
        },
      });
      tId = t.id;
      const q = await prisma.question.create({
        data: {
          testId: tId,
          text: 'RBAC-Q',
          type: QuestionType.TRUE_FALSE,
          order: 0,
        },
      });
      qId = q.id;

      // zajistí, že student je v orgA
      await prisma.membership
        .create({
          data: {
            organizationId: orgA.id,
            userId: studentUser.id,
            role: OrganizationRole.STUDENT,
          },
        })
        .catch(() => {});
      studentUser.token = await login(app, studentUser.login);
    });

    afterAll(async () => {
      await prisma.test.delete({ where: { id: tId } }).catch(() => {});
    });

    it('TEACHER_A2 (jiný v téže org) → 403 add/update/delete question/option/answer', async () => {
      await request(app.getHttpServer())
        .post(`/tests/${tId}/questions`)
        .set('Authorization', `Bearer ${teacherUserA2.token}`)
        .send({ text: 'Nope', type: QuestionType.TRUE_FALSE, order: 1 })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/tests/${tId}/questions/${qId}`)
        .set('Authorization', `Bearer ${teacherUserA2.token}`)
        .send({ text: 'Nope' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/tests/${tId}/questions/${qId}/options`)
        .set('Authorization', `Bearer ${teacherUserA2.token}`)
        .send({ text: 'X' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/tests/${tId}/questions/${qId}/answers`)
        .set('Authorization', `Bearer ${teacherUserA2.token}`)
        .send({ text: 'Y' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/tests/${tId}/questions/${qId}`)
        .set('Authorization', `Bearer ${teacherUserA2.token}`)
        .expect(403);
    });

    it('STUDENT → 403 na všechny nested write endpointy', async () => {
      await request(app.getHttpServer())
        .post(`/tests/${tId}/questions`)
        .set('Authorization', `Bearer ${studentUser.token}`)
        .send({ text: 'Nope', type: QuestionType.TRUE_FALSE, order: 1 })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/tests/${tId}/questions/${qId}`)
        .set('Authorization', `Bearer ${studentUser.token}`)
        .send({ text: 'Nope' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/tests/${tId}/questions/${qId}/options`)
        .set('Authorization', `Bearer ${studentUser.token}`)
        .send({ text: 'X' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/tests/${tId}/questions/${qId}/answers`)
        .set('Authorization', `Bearer ${studentUser.token}`)
        .send({ text: 'Y' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/tests/${tId}/questions/${qId}`)
        .set('Authorization', `Bearer ${studentUser.token}`)
        .expect(403);
    });
  });

  // ---------------------------
  // Soft-delete dopad: list a nested endpoints
  // ---------------------------

  it('Soft-delete test → nevyskytuje se v listu a nested operace vrací 404', async () => {
    // vytvoří ředitel, aby mohl mazat
    const created = await request(app.getHttpServer())
      .post('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ title: 'Soft-Delete-Nested', organizationId: orgA.id })
      .expect(201);

    const testId = created.body.id as string;
    const q = await prisma.question.create({
      data: { testId, text: 'Q', type: QuestionType.TRUE_FALSE, order: 0 },
    });

    // soft delete
    await request(app.getHttpServer())
      .delete(`/tests/${testId}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // list by orgA – neměl by obsahovat testId
    const list = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 50 })
      .expect(200);
    const items = Array.isArray(list.body)
      ? list.body
      : (list.body.items ?? []);
    expect(items.find((x: any) => x.id === testId)).toBeFalsy();

    // nested operace = 404
    await request(app.getHttpServer())
      .patch(`/tests/${testId}/questions/reorder`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ items: [{ id: q.id, order: 1 }] })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ text: 'New', type: QuestionType.TRUE_FALSE, order: 1 })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/tests/${testId}/questions/${q.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);

    // hard cleanup
    await prisma.test.delete({ where: { id: testId } }).catch(() => {});
  });

  // ---------------------------
  // SUPERADMIN bez organizationId vrací globál
  // ---------------------------

  it('GET /tests (SUPERADMIN bez organizationId) → vrátí mix z více org', async () => {
    const [ta, tb] = await prisma.$transaction([
      prisma.test.create({
        data: {
          title: 'SA-Global-A',
          organizationId: orgA.id,
          creatorId: mTA1.id,
        },
      }),
      prisma.test.create({
        data: {
          title: 'SA-Global-B',
          organizationId: orgB.id,
          creatorId: mTB1.id,
        },
      }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ page: 1, limit: 100 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const orgIds = new Set(items.map((x: any) => x.organizationId));
    expect(orgIds.has(orgA.id)).toBe(true);
    expect(orgIds.has(orgB.id)).toBe(true);

    await prisma.test.deleteMany({ where: { id: { in: [ta.id, tb.id] } } });
  });

  // ---------------------------
  // Student cross-org list → 403
  // ---------------------------

  it('GET /tests (STUDENT) s cizí organizationId → 403', async () => {
    // student je v orgA (viz dřívější testy). Zkusí listovat orgB
    await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .query({ organizationId: orgB.id, page: 1, limit: 5 })
      .expect(403);
  });

  // ---------------------------
  // Stabilní meta/shape v listu
  // ---------------------------

  it('GET /tests → kontrola meta (page/limit/pages/total) a shape', async () => {
    // zajisti pár záznamů v orgA
    const toCreate = Array.from({ length: 3 }, (_, i) => ({
      title: `Meta-${Date.now()}-${i}`,
      organizationId: orgA.id,
      creatorId: mTA1.id,
    }));
    await prisma.test.createMany({ data: toCreate });

    const r = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 2 })
      .expect(200);

    if (Array.isArray(r.body)) {
      expect(Array.isArray(r.body)).toBe(true);
      expect(r.body.length).toBeLessThanOrEqual(2);
    } else {
      expect(r.body).toHaveProperty('items');
      expect(r.body).toHaveProperty('meta');
      expect(r.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        pages: expect.any(Number),
        total: expect.any(Number),
      });
      expect(Array.isArray(r.body.items)).toBe(true);
    }

    // cleanup
    await prisma.test.deleteMany({
      where: { title: { startsWith: 'Meta-' } },
    });
  });

  // ---------------------------
  // Tie-breaker (createdAt stejné → id asc)
  // ---------------------------

  it('GET /tests → tie-breaker id asc při shodném createdAt', async () => {
    const sameTime = new Date('2024-01-01T00:00:00.000Z');
    const t1 = await prisma.test.create({
      data: { title: 'Tie-1', organizationId: orgA.id, creatorId: mTA1.id },
    });
    const t2 = await prisma.test.create({
      data: { title: 'Tie-2', organizationId: orgA.id, creatorId: mTA1.id },
    });

    // nastavíme stejný createdAt
    await prisma.$transaction([
      prisma.test.update({
        where: { id: t1.id },
        data: { createdAt: sameTime },
      }),
      prisma.test.update({
        where: { id: t2.id },
        data: { createdAt: sameTime },
      }),
    ]);

    const res = await request(app.getHttpServer())
      .get('/tests')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 50 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const tie = items
      .filter(
        (x: any) =>
          x.createdAt && new Date(x.createdAt).getTime() === sameTime.getTime(),
      )
      .filter((x: any) => [t1.id, t2.id].includes(x.id));

    if (tie.length === 2) {
      const [first, second] = tie;
      expect(first.id < second.id).toBe(true);
    }

    await prisma.test.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
  });
});
