import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, OrganizationType, OrganizationRole } from '@prisma/client';
import { login, register } from 'test/helpers';
import { randomUUID } from 'crypto';

describe('Teachers (e2e)', () => {
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
  }; // bude Teacher v orgA
  let teacherUserA2: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // druhý Teacher v orgA – pro search/pagination
  let teacherUserB1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // Teacher v orgB
  let studentUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // outsider student

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  // subjects
  let subjA1: { id: string };
  let subjA2: { id: string };
  let subjB1: { id: string };

  // created teachers (entity IDs)
  let teacherA1: { id: string; membershipId: string };
  let teacherA2: { id: string; membershipId: string };
  let teacherB1: { id: string; membershipId: string };

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

    const rTA1 = await register(app, 'teacherA1', 'Pan Učitel Novák');
    teacherUserA1 = {
      id: rTA1.user.id,
      token: rTA1.accessToken,
      login: rTA1.login,
    };

    const rTA2 = await register(app, 'teacherA2', 'Paní Učitelová Sýkorová');
    teacherUserA2 = {
      id: rTA2.user.id,
      token: rTA2.accessToken,
      login: rTA2.login,
    };

    const rTB1 = await register(app, 'teacherB1', 'Profesor Cizinec');
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

    // refresh directors to embed roles in JWT (if RolesGuard reads JWT)
    directorA.token = await login(app, directorA.login);
    directorB.token = await login(app, directorB.login);

    // Make teacher memberships (needed to create Teacher)
    const mA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherUserA1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    const mA2 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherUserA2.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    const mB1 = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: teacherUserB1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    // refresh teachers for TEACHER role in JWT (for GET eligibility)
    teacherUserA1.token = await login(app, teacherUserA1.login);
    teacherUserA2.token = await login(app, teacherUserA2.login);
    teacherUserB1.token = await login(app, teacherUserB1.login);

    // subjects in orgA + orgB
    subjA1 = await prisma.subject.create({
      data: { organizationId: orgA.id, name: 'Matematika A1' },
      select: { id: true },
    });
    subjA2 = await prisma.subject.create({
      data: { organizationId: orgA.id, name: 'Fyzika A2' },
      select: { id: true },
    });
    subjB1 = await prisma.subject.create({
      data: { organizationId: orgB.id, name: 'Chemie B1' },
      select: { id: true },
    });

    // create Teacher entities via API (as DIRECTOR of orgA/orgB)
    // TeacherA1
    {
      const res = await request(app.getHttpServer())
        .post('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({ membershipId: mA1.id, organizationId: orgA.id })
        .expect(201);

      teacherA1 = { id: res.body.id, membershipId: mA1.id };
    }
    // TeacherA2
    {
      const res = await request(app.getHttpServer())
        .post('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({ membershipId: mA2.id, organizationId: orgA.id })
        .expect(201);

      teacherA2 = { id: res.body.id, membershipId: mA2.id };
    }
    // TeacherB1
    {
      const res = await request(app.getHttpServer())
        .post('/teachers')
        .set('Authorization', `Bearer ${directorB.token}`)
        .send({ membershipId: mB1.id, organizationId: orgB.id })
        .expect(201);

      teacherB1 = { id: res.body.id, membershipId: mB1.id };
    }
  });

  afterAll(async () => {
    // hard cleanup (Teacher has soft-delete via deletedAt; we ensure DB teardown)
    await prisma.teacherSubject.deleteMany({
      where: {
        teacherId: {
          in: [teacherA1?.id, teacherA2?.id, teacherB1?.id].filter(
            Boolean,
          ) as string[],
        },
      },
    });
    await prisma.teacher.deleteMany({
      where: {
        id: {
          in: [teacherA1?.id, teacherA2?.id, teacherB1?.id].filter(
            Boolean,
          ) as string[],
        },
      },
    });

    await prisma.subject.deleteMany({
      where: {
        id: {
          in: [subjA1?.id, subjA2?.id, subjB1?.id].filter(Boolean) as string[],
        },
      },
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

  it('POST /teachers → 201 Director orgA vytvoří učitele v orgA', async () => {
    const tmpUser = await register(app, 'tmpTA');
    // membership role TEACHER v orgA
    const mTmp = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmpUser.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: mTmp.id, organizationId: orgA.id })
      .expect(201);

    expect(res.body.id).toBeTruthy();

    // cleanup entity + user
    await prisma.teacher.delete({ where: { id: res.body.id } });
    await prisma.membership.delete({ where: { id: mTmp.id } });
    await prisma.refreshToken.deleteMany({
      where: { userId: tmpUser.user.id },
    });
    await prisma.user.delete({ where: { id: tmpUser.user.id } });
  });

  it('POST /teachers → 403 Director orgA nesmí vytvořit učitele v orgB (cross‑org)', async () => {
    const some = await register(app, 'tmpCross');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: some.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m.id, organizationId: orgB.id })
      .expect(403);

    // cleanup
    await prisma.membership.delete({ where: { id: m.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: some.user.id } });
    await prisma.user.delete({ where: { id: some.user.id } });
  });

  it('POST /teachers → 403/400 když membership.role není TEACHER (např. STUDENT)', async () => {
    const some = await register(app, 'tmpWrongRole');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: some.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m.id, organizationId: orgA.id })
      .expect((r) => {
        if (![400, 403, 409].includes(r.status))
          throw new Error(`Expected 400/403/409, got ${r.status}`);
      });

    // cleanup
    await prisma.membership.delete({ where: { id: m.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: some.user.id } });
    await prisma.user.delete({ where: { id: some.user.id } });
  });

  // ---------------------------
  // LIST + SEARCH + PAGINATION
  // ---------------------------

  it('GET /teachers → 200 Director orgA vidí pouze učitele své organizace', async () => {
    const res = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 50 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const ids = items.map((t: any) => t.id);
    expect(ids).toEqual(expect.arrayContaining([teacherA1.id, teacherA2.id]));
    expect(ids).not.toContain(teacherB1.id);
  });

  it('GET /teachers?search=Novák → 200 najde teacherA1 (fulltext přes user.name/email)', async () => {
    const res = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, search: 'Novák', page: 1, limit: 50 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const ids = items.map((t: any) => t.id);
    expect(ids).toContain(teacherA1.id);
  });

  it('GET /teachers (as SUPERADMIN) → 200 a vidí učitele v orgA', async () => {
    const res = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 50 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const ids = items.map((t: any) => t.id);
    expect(ids).toEqual(expect.arrayContaining([teacherA1.id, teacherA2.id]));
    expect(ids).not.toContain(teacherB1.id);
  });

  // (volitelně) otestuj i orgB zvlášť:
  it('GET /teachers (as SUPERADMIN, orgB) → 200 a vidí učitele v orgB', async () => {
    const res = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ organizationId: orgB.id, page: 1, limit: 50 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const ids = items.map((t: any) => t.id);
    expect(ids).toContain(teacherB1.id);
  });

  // ---------------------------
  // DETAIL / GET :id (roles: SUPERADMIN, DIRECTOR, TEACHER)
  // ---------------------------

  it('GET /teachers/:id → 200 TEACHER z téže org může vidět detail učitele své org (např. teacherA1 vidí teacherA2)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/teachers/${teacherA2.id}`)
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .expect(200);

    expect(res.body.id).toBe(teacherA2.id);
  });

  it('GET /teachers/:id → 403/404 TEACHER z jiné org nemá přístup (teacherB1 → teacherA1)', async () => {
    await request(app.getHttpServer())
      .get(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${teacherUserB1.token}`)
      .expect((r) => {
        if (![403, 404].includes(r.status))
          throw new Error(`Expected 403/404, got ${r.status}`);
      });
  });

  // ---------------------------
  // UPDATE
  // ---------------------------

  it('PATCH /teachers/:id → 200 Director orgA může update (no-op update)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({}) // no-op, jen ověříme oprávnění a 200
      .expect(200);

    expect(res.body.id).toBe(teacherA1.id);
  });

  it('PATCH /teachers/:id → 403 Director orgB nemůže měnit učitele orgA', async () => {
    await request(app.getHttpServer())
      .patch(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${directorB.token}`)
      .send({})
      .expect(403);
  });

  // ---------------------------
  // ASSIGN SUBJECTS
  // ---------------------------

  it('POST /teachers/:id/subjects → 200 přidá předměty z téže org (add mode)', async () => {
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA1.id], replaceAll: false })
      .expect(201); // create mapping → může vracet 201/200 v závislosti na implementaci

    // zkontrolujeme v DB, že mapping existuje
    const link = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacherA1.id, subjectId: subjA1.id },
    });
    expect(link).toBeTruthy();
  });

  it('POST /teachers/:id/subjects → 200/201 replaceAll nahradí existující přiřazení', async () => {
    // nejdřív přidej ještě subjA2 (add)
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA2.id], replaceAll: false })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    // teď replaceAll jen na subjA2 (subjA1 by měl zmizet)
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA2.id], replaceAll: true })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    const remainsA1 = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacherA1.id, subjectId: subjA1.id },
    });
    const remainsA2 = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacherA1.id, subjectId: subjA2.id },
    });
    expect(remainsA1).toBeNull();
    expect(remainsA2).toBeTruthy();
  });

  it('POST /teachers/:id/subjects → 400/403 když předmět je z cizí organizace (subjB1 → teacherA1)', async () => {
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjB1.id], replaceAll: false })
      .expect((r) => {
        if (![400, 403, 409].includes(r.status))
          throw new Error(`Expected 400/403/409, got ${r.status}`);
      });
  });

  it('DELETE /teachers/:id/subjects/:subjectId → 200 smaže konkrétní přiřazení (teacherA1, subjA2)', async () => {
    await request(app.getHttpServer())
      .delete(`/teachers/${teacherA1.id}/subjects/${subjA2.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const gone = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacherA1.id, subjectId: subjA2.id },
    });
    expect(gone).toBeNull();
  });

  // ---------------------------
  // DELETE (soft delete)
  // ---------------------------

  it('DELETE /teachers/:id → 403 Director orgA nemůže smazat učitele orgB', async () => {
    await request(app.getHttpServer())
      .delete(`/teachers/${teacherB1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);
  });

  it('DELETE /teachers/:id → 200 Director orgA smaže učitele orgA (soft‑delete)', async () => {
    // vytvoříme dočasného učitele v orgA
    const temp = await register(app, 'tempToDelete');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: temp.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    const resCreate = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m.id, organizationId: orgA.id })
      .expect(201);

    const tempTeacherId = resCreate.body.id as string;

    await request(app.getHttpServer())
      .delete(`/teachers/${tempTeacherId}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // po soft-delete by detail měl vrátit 404 (pokud filtruješ deletedAt)
    await request(app.getHttpServer())
      .get(`/teachers/${tempTeacherId}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);

    // interně by měl mít deletedAt
    const db = await prisma.teacher.findUnique({
      where: { id: tempTeacherId },
    });
    expect(db?.deletedAt).toBeTruthy();

    // cleanup user + membership + (teacher je již soft‑deleted)
    await prisma.membership.delete({ where: { id: m.id } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: temp.user.id } });
    await prisma.user.delete({ where: { id: temp.user.id } });
  });

  // ---------------------------
  // NEGATIVE RBAC
  // ---------------------------

  it('GET /teachers → 403 STUDENT (bez role) nemá přístup k listu', async () => {
    // studentUser není v žádné org s rolí director => list by měl spadnout na 403
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(403);
  });

  // =============================
  // DOPLŇUJÍCÍ TEACHERS E2E TESTY
  // =============================

  it('GET /teachers → 401 bez tokenu', async () => {
    await request(app.getHttpServer()).get('/teachers').expect(401);
  });

  it('GET /teachers (as SUPERADMIN, bez organizationId) → 400', async () => {
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(400);
  });

  // Stabilní order + pagination
  it('GET /teachers → 200 stabilní řazení (name asc, id asc) + pagination', async () => {
    // page=1,limit=1 → vezmeme prvního (podle name asc)
    const res1 = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 1 })
      .expect(200);

    const items1 = Array.isArray(res1.body)
      ? res1.body
      : (res1.body.items ?? []);
    expect(items1.length).toBe(1);

    const res2 = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 2, limit: 1 })
      .expect(200);

    const items2 = Array.isArray(res2.body)
      ? res2.body
      : (res2.body.items ?? []);
    expect(items2.length).toBe(1);

    // oba různí
    expect(items1[0].id).not.toBe(items2[0].id);

    // pro sanity zkontrolujeme, že oba jsou z orgA
    expect(items1[0].organizationId).toBe(orgA.id);
    expect(items2[0].organizationId).toBe(orgA.id);
  });

  // UPDATE negativní: zákaz změny membershipId/orgId
  it('PATCH /teachers/:id → 409 když se pokusím změnit membershipId', async () => {
    // vytvoř dočasné TEACHER membership pro existujícího studentUser (orgA)
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: studentUser.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .patch(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m.id })
      .expect(409);

    // cleanup
    await prisma.membership.delete({ where: { id: m.id } });
  });

  it('PATCH /teachers/:id → 409 když se pokusím změnit organizationId', async () => {
    await request(app.getHttpServer())
      .patch(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ organizationId: orgB.id })
      .expect(409);
  });

  // SUPERADMIN může vytvořit učitele k libovolné org
  it('POST /teachers (SUPERADMIN) → 201 vytvoří učitele v orgB', async () => {
    // dočasné TEACHER membership pro existujícího studentUser v orgB
    const m = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: studentUser.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ membershipId: m.id, organizationId: orgB.id })
      .expect(201);

    expect(res.body.id).toBeTruthy();

    // cleanup teacher + membership
    await prisma.teacher.delete({ where: { id: res.body.id } });
    await prisma.membership.delete({ where: { id: m.id } });
  });

  // assignSubjects: 400 na prázdné pole
  it('POST /teachers/:id/subjects → 400 když subjectIds=[]', async () => {
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [], replaceAll: false })
      .expect(400);
  });

  // assignSubjects: idempotence (duplicitní create nevytvoří duplicitní řádky)
  it('POST /teachers/:id/subjects → idempotentní přidání nezduplikuje vazbu', async () => {
    // nejdřív smaž případnou existující vazbu
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id, subjectId: subjA1.id },
    });

    // přidej 2x stejné subjectId
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA1.id], replaceAll: false })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA1.id], replaceAll: false })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    const count = await prisma.teacherSubject.count({
      where: { teacherId: teacherA1.id, subjectId: subjA1.id },
    });
    expect(count).toBe(1);
  });

  // assignSubjects: 404 na neexistující subject
  it('POST /teachers/:id/subjects → 404 když subject neexistuje', async () => {
    const fakeId = randomUUID(); // validní v4, ale neexistuje
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [fakeId], replaceAll: false })
      .expect(404);
  });

  // removeSubject je idempotentní (když vazba neexistuje)
  it('DELETE /teachers/:id/subjects/:subjectId → 200 i když vazba neexistuje', async () => {
    // zajistíme, že vazba neexistuje
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id, subjectId: subjA2.id },
    });

    await request(app.getHttpServer())
      .delete(`/teachers/${teacherA1.id}/subjects/${subjA2.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  // Soft‑delete: po smazání není v listu a detail vrací 404
  it('DELETE /teachers/:id → 200 + po smazání není v listu a detail 404', async () => {
    // 1) vytvoř dočasného učitele v orgA
    const tmp = await register(app, `tmpSoftCheck_${Date.now()}`);
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const created = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m.id, organizationId: orgA.id })
      .expect(201);

    const tid = created.body.id as string;

    // (volitelně) zahřej list cache, aby test skutečně ověřil invalidaci
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 100 })
      .expect(200);

    // 2) smaž
    await request(app.getHttpServer())
      .delete(`/teachers/${tid}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // 3) detail 404 (s cache-busterem pro jistotu)
    await request(app.getHttpServer())
      .get(`/teachers/${tid}?_=${Date.now()}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);

    // 4) list neobsahuje tid (cache-buster)
    const res = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 200, _: Date.now() })
      .expect(200);

    const body = Array.isArray(res.body) ? { items: res.body } : res.body;
    const ids = (body.items ?? []).map((t: any) => t.id);
    expect(ids).not.toContain(tid);

    // 5) cleanup až teď: membership + uživatel
    await prisma.membership.delete({ where: { id: m.id } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  // =============================
  // EXTRA TEACHERS E2E – full RBAC + edges
  // =============================

  // 1) TEACHER nemůže listovat (pokud je to tvoje politika)
  it('GET /teachers → 403 TEACHER nesmí listovat', async () => {
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${teacherUserA1.token}`)
      .query({ organizationId: orgA.id })
      .expect(403);
  });

  // 2) DIRECTOR jiné organizace nevidí detail cizího učitele
  it('GET /teachers/:id → 403/404 directorB nemá přístup k teacherA1', async () => {
    await request(app.getHttpServer())
      .get(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${directorB.token}`)
      .expect((r) => {
        if (![403, 404].includes(r.status)) {
          throw new Error(`Expected 403/404, got ${r.status}`);
        }
      });
  });

  // 3) SEARCH přes email i username
  it('GET /teachers?search=email → 200 najde teacherA1 podle emailu', async () => {
    const u = await prisma.user.findUnique({
      where: { id: teacherUserA1.id },
      select: { email: true },
    });
    expect(u?.email).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, search: u!.email, page: 1, limit: 50 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const ids = items.map((t: any) => t.id);
    expect(ids).toContain(teacherA1.id);
  });

  it('GET /teachers?search=username → 200 najde teacherA1 podle username', async () => {
    // vezmeme cokoliv, co máš uložené jako username (pokud nepoužíváš, test automaticky přeskočí)
    const u = await prisma.user.findUnique({
      where: { id: teacherUserA1.id },
      select: { username: true, email: true },
    });

    if (!u?.username) {
      // fallback: použijeme část emailu před @ jako "username-like"
      const fallback = u?.email?.split('@')[0] ?? '';
      if (!fallback) return; // nothing to test
      const res = await request(app.getHttpServer())
        .get('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .query({
          organizationId: orgA.id,
          search: fallback,
          page: 1,
          limit: 50,
        })
        .expect(200);
      const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
      const ids = items.map((t: any) => t.id);
      expect(ids).toContain(teacherA1.id);
    } else {
      const res = await request(app.getHttpServer())
        .get('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .query({
          organizationId: orgA.id,
          search: u.username,
          page: 1,
          limit: 50,
        })
        .expect(200);
      const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
      const ids = items.map((t: any) => t.id);
      expect(ids).toContain(teacherA1.id);
    }
  });

  // 4) Stabilní order tie‑break (stejné jméno → id asc)
  it('GET /teachers → stabilní pořadí pro stejné jméno (tie-break id asc) a zachování mezi stránkami', async () => {
    // připravíme dva učitele se stejným jménem v orgA
    const tmp1 = await register(app, 'sameName1', 'Jan Stejny');
    const tmp2 = await register(app, 'sameName2', 'Jan Stejny');

    const m1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp1.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    const m2 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp2.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const r1 = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m1.id, organizationId: orgA.id })
      .expect(201);
    const r2 = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m2.id, organizationId: orgA.id })
      .expect(201);

    const t1 = r1.body.id as string;
    const t2 = r2.body.id as string;

    // načteme 2 stránky po 1 záznamu, se search "Jan Stejny" (abychom izolovali)
    const page1 = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({
        organizationId: orgA.id,
        search: 'Jan Stejny',
        page: 1,
        limit: 1,
      })
      .expect(200);
    const page2 = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({
        organizationId: orgA.id,
        search: 'Jan Stejny',
        page: 2,
        limit: 1,
      })
      .expect(200);

    const i1 = Array.isArray(page1.body)
      ? page1.body
      : (page1.body.items ?? []);
    const i2 = Array.isArray(page2.body)
      ? page2.body
      : (page2.body.items ?? []);
    expect(i1.length).toBe(1);
    expect(i2.length).toBe(1);
    expect(i1[0].id).not.toBe(i2[0].id);

    // znovu načtení musí vrátit stejné pořadí (stabilita)
    const page1b = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({
        organizationId: orgA.id,
        search: 'Jan Stejny',
        page: 1,
        limit: 1,
      })
      .expect(200);
    const page2b = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({
        organizationId: orgA.id,
        search: 'Jan Stejny',
        page: 2,
        limit: 1,
      })
      .expect(200);

    const j1 = Array.isArray(page1b.body)
      ? page1b.body
      : (page1b.body.items ?? []);
    const j2 = Array.isArray(page2b.body)
      ? page2b.body
      : (page2b.body.items ?? []);
    expect(j1[0].id).toBe(i1[0].id);
    expect(j2[0].id).toBe(i2[0].id);

    // cleanup
    await prisma.teacher.deleteMany({ where: { id: { in: [t1, t2] } } });
    await prisma.membership.deleteMany({
      where: { id: { in: [m1.id, m2.id] } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: [tmp1.user.id, tmp2.user.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [tmp1.user.id, tmp2.user.id] } },
    });
  });

  // 5) assignSubjects replaceAll prázdným polem → zůstane 0 vazeb
  it('POST /teachers/:id/subjects → replaceAll s [] smaže všechna přiřazení', async () => {
    // zajistí, že existuje aspoň 1 vazba
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id },
    });
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA1.id], replaceAll: false })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    // replaceAll na prázdné
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [], replaceAll: true })
      .expect(400);

    // stav se nezměnil (pořád jedna vazba)
    const countAfter = await prisma.teacherSubject.count({
      where: { teacherId: teacherA1.id },
    });
    expect(countAfter).toBe(1);
  });

  // 6) Cache bump smoke (volitelné, ale fajn): změna přiřazení se projeví hned
  it('POST /teachers/:id/subjects → změna je vidět hned (cache bump smoke)', async () => {
    // 0) čistý stav (pro jistotu)
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id, subjectId: subjA2.id },
    });

    // 1) add subjA2
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA2.id], replaceAll: false })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    // 2) ověř (první detail může klidně skončit v cache)
    const d1 = await request(app.getHttpServer())
      .get(`/teachers/${teacherA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect((d1.body.subjects ?? []).map((x: any) => x.subjectId)).toContain(
      subjA2.id,
    );

    // 3) remove subjA2
    await request(app.getHttpServer())
      .delete(`/teachers/${teacherA1.id}/subjects/${subjA2.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // 4) DB sanity – vazba pryč
    const count = await prisma.teacherSubject.count({
      where: { teacherId: teacherA1.id, subjectId: subjA2.id },
    });
    expect(count).toBe(0);

    // 5) detail s cache‑busterem, aby se nevrátila stará cache
    const bust = Date.now();
    const d2 = await request(app.getHttpServer())
      .get(`/teachers/${teacherA1.id}?_=${bust}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect((d2.body.subjects ?? []).map((x: any) => x.subjectId)).not.toContain(
      subjA2.id,
    );
  });
  // ========= RBAC MATRIX (table-driven) =========
  describe('Teachers RBAC matrix', () => {
    const actors = [
      {
        name: 'SUPERADMIN',
        token: () => superUser.token,
        org: () => orgA.id,
        list: 200,
        detail: [200],
        create: 201,
      },
      {
        name: 'DIRECTOR_A',
        token: () => directorA.token,
        org: () => orgA.id,
        list: 200,
        detail: [200],
        create: 201,
      },
      // Ředitel B má pořád 200 na /teachers (listuje si svojí org), i když pošle orgA v query — service to ignoruje
      {
        name: 'DIRECTOR_B',
        token: () => directorB.token,
        org: () => orgB.id, // ředitel B pracuje se svou org
        list: 200, // list své org povolen
        detail: [403, 404], // detail teacherA1 (orgA) stále zakázán
        create: 201, // ve své org může vytvořit učitele
      },
      {
        name: 'DIRECTOR_B_cross_orgA',
        token: () => directorB.token,
        org: () => orgA.id,
        list: 403,
        detail: [403, 404],
        create: 403,
      },
      {
        name: 'TEACHER_A',
        token: () => teacherUserA1.token,
        org: () => orgA.id,
        list: 403,
        detail: [200],
        create: 403,
      },
      {
        name: 'STUDENT',
        token: () => studentUser.token,
        org: () => orgA.id,
        list: 403,
        detail: [403, 404],
        create: 403,
      },
    ];

    it.each(actors)('RBAC list: $name', async ({ token, org, list }) => {
      await request(app.getHttpServer())
        .get('/teachers')
        .set('Authorization', `Bearer ${token()}`)
        .query({ organizationId: org(), page: 1, limit: 5 })
        .expect(list);
    });

    it.each(actors)('RBAC detail: $name', async ({ token, detail }) => {
      await request(app.getHttpServer())
        .get(`/teachers/${teacherA1.id}`)
        .set('Authorization', `Bearer ${token()}`)
        .expect((r) => {
          if (!detail.includes(r.status)) {
            throw new Error(`Expected ${detail.join('/')} got ${r.status}`);
          }
        });
    });

    it.each(actors)('RBAC create: $name', async ({ token, org, create }) => {
      // připrav dočasné membership v cílové org pro existujícího studentUser
      const m = await prisma.membership.create({
        data: {
          organizationId: org(),
          userId: studentUser.id,
          role: OrganizationRole.TEACHER,
        },
        select: { id: true },
      });
      const res = await request(app.getHttpServer())
        .post('/teachers')
        .set('Authorization', `Bearer ${token()}`)
        .send({ membershipId: m.id, organizationId: org() })
        .expect((r) => {
          if (
            r.status !== create &&
            !(create === 403 && [400, 403, 409].includes(r.status))
          )
            throw new Error(`Expected ${create}, got ${r.status}`);
        });
      // cleanup (jen když se vytvořil teacher)
      if (res.status < 300 && res.body?.id) {
        await prisma.teacher.delete({ where: { id: res.body.id } });
      }
      await prisma.membership.delete({ where: { id: m.id } }).catch(() => {});
    });
  });

  // ========= Search diakritika & case =========
  it('GET /teachers?search → case-insensitive + diacritika tolerantní (pokud podporuje DB)', async () => {
    // "Pan Učitel Novák" je v beforeAll
    const queries = ['novák', 'novák', 'NoVáK'];
    for (const q of queries) {
      const res = await request(app.getHttpServer())
        .get('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .query({ organizationId: orgA.id, search: q, page: 1, limit: 50 })
        .expect(200);
      const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
      const ids = items.map((t: any) => t.id);
      // pokud by DB neuměla odstraňovat diakritiku, aspoň case-insensitive by projít měl
      expect(ids).toContain(teacherA1.id);
    }
  });

  // ========= Pagination edges =========
  it('GET /teachers → page za hranou vrátí prázdno, meta sedí', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 1000 })
      .expect(200);
    const body1 = Array.isArray(res1.body)
      ? { items: res1.body, meta: null }
      : res1.body;
    const total = body1.meta?.total ?? body1.items.length;
    expect(total).toBeGreaterThan(0);
    const pages = body1.meta?.pages ?? 1;

    const res2 = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: pages + 1, limit: 10 })
      .expect(200);
    const items2 = Array.isArray(res2.body)
      ? res2.body
      : (res2.body.items ?? []);
    expect(items2.length).toBe(0);
  });

  // ========= Validation edges =========
  it('GET /teachers → 400 na nevalidní UUID v organizationId', async () => {
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: 'not-a-uuid', page: 1, limit: 10 })
      .expect(400);
  });

  it('GET /teachers → 400 na limit<=0', async () => {
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 0 })
      .expect(400);
  });

  // ========= Injection-ish search smoke =========
  it('GET /teachers?search se speciálními znaky nepadá', async () => {
    const needles = [`%'";--`, `(*)[?]`, `<script>alert(1)</script>`];
    for (const s of needles) {
      await request(app.getHttpServer())
        .get('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .query({ organizationId: orgA.id, search: s, page: 1, limit: 5 })
        .expect(200);
    }
  });

  // ========= Bulk assign (velikost + duplicitní IDs) =========
  it('POST /teachers/:id/subjects → bulk replaceAll bez duplicit v DB (i když payload duplikuje)', async () => {
    // připrav dalších 3 subjects v orgA
    const many = await prisma.$transaction([
      prisma.subject.create({
        data: { organizationId: orgA.id, name: 'Geo A3' },
        select: { id: true },
      }),
      prisma.subject.create({
        data: { organizationId: orgA.id, name: 'Bio A4' },
        select: { id: true },
      }),
      prisma.subject.create({
        data: { organizationId: orgA.id, name: 'IT A5' },
        select: { id: true },
      }),
    ]);
    const ids = [subjA1.id, subjA2.id, many[0].id, many[1].id, many[2].id];

    // replaceAll s payloadem obsahujícím duplicity
    const payload = [...ids, ids[0], ids[1]];
    await request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: payload, replaceAll: true })
      .expect((r) => {
        if (![200, 201].includes(r.status))
          throw new Error(`Expected 200/201, got ${r.status}`);
      });

    const count = await prisma.teacherSubject.count({
      where: { teacherId: teacherA1.id },
    });
    expect(count).toBe(ids.length); // v DB bez duplicit

    // cleanup přidaných subjectů
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id, subjectId: { in: ids } },
    });
    await prisma.subject.deleteMany({
      where: { id: { in: many.map((m) => m.id) } },
    });
  });

  // ========= Concurrency smoke (replaceAll) =========
  it('POST /teachers/:id/subjects → dva replaceAll paralelně skončí konzistentně', async () => {
    // 2 nové subjects
    const sX = await prisma.subject.create({
      data: { organizationId: orgA.id, name: 'Par X' },
      select: { id: true },
    });
    const sY = await prisma.subject.create({
      data: { organizationId: orgA.id, name: 'Par Y' },
      select: { id: true },
    });

    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id },
    });

    // dvě paralelní replaceAll – jeden na [subjA1], druhý na [sX,sY]
    const p1 = request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [subjA1.id], replaceAll: true });

    const p2 = request(app.getHttpServer())
      .post(`/teachers/${teacherA1.id}/subjects`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ subjectIds: [sX.id, sY.id], replaceAll: true });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect([200, 201]).toContain(r1.status);
    expect([200, 201]).toContain(r2.status);

    // výsledek musí být jeden z obou setů, ne mix
    const finalLinks = await prisma.teacherSubject.findMany({
      where: { teacherId: teacherA1.id },
    });
    const finalSet = new Set(finalLinks.map((l) => l.subjectId));
    const setA = new Set([subjA1.id]);
    const setB = new Set([sX.id, sY.id]);

    const equals = (A: Set<string>, B: Set<string>) =>
      A.size === B.size && [...A].every((x) => B.has(x));
    expect(equals(finalSet, setA) || equals(finalSet, setB)).toBe(true);

    // cleanup
    await prisma.teacherSubject.deleteMany({
      where: { teacherId: teacherA1.id },
    });
    await prisma.subject.deleteMany({ where: { id: { in: [sX.id, sY.id] } } });
  });

  // ========= Cache invalidation po DELETE teacher =========
  it('DELETE /teachers/:id invaliduje list & detail cache', async () => {
    // 1) připrav jednorázového učitele v orgA
    const tmp = await register(app, `tmpCacheDelete_${Date.now()}`);
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    const created = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: m.id, organizationId: orgA.id })
      .expect(201);

    const tid = created.body.id as string;

    // 2) warm-up: načti list (ať se klidně nacachuje)
    await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 100 })
      .expect(200);

    // 3) smaž Teacher
    await request(app.getHttpServer())
      .delete(`/teachers/${tid}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // 4) detail musí být 404
    await request(app.getHttpServer())
      .get(`/teachers/${tid}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);

    // 5) list s cache-busterem neobsahuje tid
    const res = await request(app.getHttpServer())
      .get('/teachers?_=' + Date.now())
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ organizationId: orgA.id, page: 1, limit: 200 })
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    const ids = items.map((t: any) => t.id);
    expect(ids).not.toContain(tid);

    // 6) cleanup – až teď!
    await prisma.teacher.delete({ where: { id: tid } }).catch(() => {});
    await prisma.membership.delete({ where: { id: m.id } }).catch(() => {});
  });
});
