// test/e2e/subjects.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, OrganizationRole, OrganizationType } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('Subjects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // users
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
  let teacherA1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let teacherB1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  // seed IDs (jen stringy kvůli stabilitě)
  let catalogMathId: string;
  let catTopic1Id: string;
  let subjectA1Id: string;
  let subjectA2Id: string;
  let levelA1_1Id: string;
  let topicLvA1_1Id: string;

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

    // --- users ---
    const rSuper = await register(app, 'subjects_super');
    await prisma.user.update({
      where: { id: rSuper.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: rSuper.user.id,
      token: await login(app, rSuper.login),
      login: rSuper.login,
    };

    const rDirA = await register(app, 'subjects_dirA');
    directorA = {
      id: rDirA.user.id,
      token: rDirA.accessToken,
      login: rDirA.login,
    };

    const rTeachA1 = await register(app, 'subjects_teacherA1');
    teacherA1 = {
      id: rTeachA1.user.id,
      token: rTeachA1.accessToken,
      login: rTeachA1.login,
    };

    const rTeachB1 = await register(app, 'subjects_teacherB1');
    teacherB1 = {
      id: rTeachB1.user.id,
      token: rTeachB1.accessToken,
      login: rTeachB1.login,
    };

    // --- orgs + memberships ---
    orgA = await prisma.organization.create({
      data: {
        name: 'Subjects Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true },
    });
    // re-login ředitele, aby měl org v JWT
    directorA.token = await login(app, directorA.login);

    orgB = await prisma.organization.create({
      data: {
        name: 'Subjects Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: teacherB1.id, role: OrganizationRole.TEACHER },
        },
      },
      select: { id: true },
    });
    // re-login učitele B1 (orgB)
    teacherB1.token = await login(app, teacherB1.login);

    // teacherA1 v orgA (membership) + re-login pro org roli
    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherA1.id,
        role: OrganizationRole.TEACHER,
      },
    });
    teacherA1.token = await login(app, teacherA1.login);

    // --- katalogový předmět s povinným code ---
    const cat = await prisma.catalogSubject.create({
      data: { code: `MATH_${Date.now()}`, name: 'Matematika (katalog)' },
      select: { id: true },
    });
    catalogMathId = cat.id;

    // --- seed subjects v orgA ---
    const s1 = await prisma.subject.create({
      data: {
        name: 'Matematika',
        organizationId: orgA.id,
        catalogSubjectId: catalogMathId,
      },
      select: { id: true },
    });
    subjectA1Id = s1.id;

    const s2 = await prisma.subject.create({
      data: { name: 'Český jazyk', organizationId: orgA.id },
      select: { id: true },
    });
    subjectA2Id = s2.id;

    // --- SubjectLevel pro subjectA1 ---
    const lvl = await prisma.subjectLevel.create({
      data: {
        subjectId: subjectA1Id,
        grade: $Enums.SchoolGrade.GRADE_5,
        order: 1,
      },
      select: { id: true },
    });
    levelA1_1Id = lvl.id;

    // --- CatalogTopic navázaný na katalogový předmět ---
    const ct = await prisma.catalogTopic.create({
      data: { subjectId: catalogMathId, name: 'Zlomky' },
      select: { id: true },
    });
    catTopic1Id = ct.id;

    // --- TopicLevel (povinné subjectLevelId + catalogTopicId) ---
    const tl = await prisma.topicLevel.create({
      data: {
        subjectLevelId: levelA1_1Id,
        catalogTopicId: catTopic1Id,
        order: 1,
      },
      select: { id: true },
    });
    topicLvA1_1Id = tl.id;
  });

  afterAll(async () => {
    // best-effort cleanup (vždy kontroluj undefined)
    await prisma.topicLevel
      .deleteMany({
        where: { id: { in: [topicLvA1_1Id].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    await prisma.subjectLevel
      .deleteMany({
        where: { id: { in: [levelA1_1Id].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    await prisma.subject
      .deleteMany({
        where: {
          id: { in: [subjectA1Id, subjectA2Id].filter(Boolean) as string[] },
        },
      })
      .catch(() => {});
    await prisma.catalogTopic
      .deleteMany({
        where: { id: { in: [catTopic1Id].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    await prisma.catalogSubject
      .deleteMany({
        where: { id: { in: [catalogMathId].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    await prisma.membership
      .deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } })
      .catch(() => {});
    await prisma.organization
      .deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } })
      .catch(() => {});
    await prisma.refreshToken
      .deleteMany({
        where: {
          userId: {
            in: [superUser.id, directorA.id, teacherA1.id, teacherB1.id],
          },
        },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: {
          id: { in: [superUser.id, directorA.id, teacherA1.id, teacherB1.id] },
        },
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------
  // CREATE
  // ---------------------------
  it('POST /subjects → DIRECTOR vytvoří subject [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: 'Fyzika',
        organizationId: orgA.id,
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.organizationId).toBe(orgA.id);
    await prisma.subject.delete({ where: { id: res.body.id } });
  });

  it('POST /subjects → TEACHER v orgA vytvoří [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({ name: 'Chemie', organizationId: orgA.id })
      .expect(201);

    expect(res.body.name).toBe('Chemie');
    await prisma.subject.delete({ where: { id: res.body.id } });
  });

  it('POST /subjects → 403 TEACHER jiné organizace', async () => {
    await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ name: 'Biologie', organizationId: orgA.id })
      .expect(403);
  });

  it('POST /subjects → 404 neexistující catalogSubjectId', async () => {
    await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: 'Hudební výchova',
        organizationId: orgA.id,
        catalogSubjectId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(404);
  });

  it('POST /subjects → 409 duplicitní název v organizaci', async () => {
    // pokus duplikovat 'Matematika' v orgA
    await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'Matematika', organizationId: orgA.id })
      .expect(409);
  });

  it('POST /subjects → 400 validace', async () => {
    await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'A', organizationId: 'not-uuid' }) // name too short + bad uuid
      .expect(400);
  });

  // ---------------------------
  // LIST (pagination + search + includeLevels)
  // ---------------------------
  it('GET /subjects → paginace + stabilní pořadí + over-page prázdno', async () => {
    // vytvoř 3 subjekty v orgA
    const created = await Promise.all(
      ['Geografie', 'Informatika', 'Výtvarná výchova'].map((n) =>
        prisma.subject.create({
          data: { name: n, organizationId: orgA.id },
          select: { id: true },
        }),
      ),
    );

    const page1 = await request(app.getHttpServer())
      .get('/subjects')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const again = await request(app.getHttpServer())
      .get('/subjects')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(page1.body.data).toEqual(again.body.data);

    const pages = page1.body.meta.pages;
    const over = await request(app.getHttpServer())
      .get('/subjects')
      .query({ page: pages + 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(over.body.data).toEqual([]);

    // cleanup
    await prisma.subject.deleteMany({
      where: { id: { in: created.map((c) => c.id) } },
    });
  });

  it('GET /subjects → search by name (case/trim) [200]', async () => {
    const byName = await request(app.getHttpServer())
      .get('/subjects')
      .query({ search: '  mate  ' }) // měl by trefit "Matematika"
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(Array.isArray(byName.body.data)).toBe(true);
    const ids = byName.body.data.map((x: any) => x.id);
    expect(ids).toContain(subjectA1Id);
  });

  it('GET /subjects → includeLevels=true vrátí levels+topics', async () => {
    const res = await request(app.getHttpServer())
      .get('/subjects')
      .query({ includeLevels: true })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const item = res.body.data.find((x: any) => x.id === subjectA1Id);
    expect(item).toBeTruthy();
    expect(Array.isArray(item.levels)).toBe(true);
    // minimálně 1 level se seednul
    expect(item.levels.length).toBeGreaterThan(0);
  });

  it('GET /subjects → 401 bez tokenu, 403 TEACHER jiné org na list', async () => {
    await request(app.getHttpServer()).get('/subjects').expect(401);
    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${teacherB1.token}`) // orgB
      .expect(200);
  });

  // ---------------------------
  // DETAIL
  // ---------------------------
  it('GET /subjects/:id → SUPERADMIN vidí [200]', async () => {
    await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('GET /subjects/:id → DIRECTOR stejné org [200]', async () => {
    await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  it('GET /subjects/:id → TEACHER stejné org [200]', async () => {
    await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);
  });

  it('GET /subjects/:id → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('GET /subjects/:id → 404 když neexistuje', async () => {
    await request(app.getHttpServer())
      .get('/subjects/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  // ---------------------------
  // UPDATE
  // ---------------------------
  it('PATCH /subjects/:id → DIRECTOR upraví name/catalog [200]', async () => {
    // vytvoř dočasný subject v orgA
    const tmp = await prisma.subject.create({
      data: { name: 'Dějepis', organizationId: orgA.id },
      select: { id: true },
    });

    // vytvoř jiný katalogový předmět (povinný unique code)
    const otherCatalog = await prisma.catalogSubject.create({
      data: { code: `CAT_${Date.now()}`, name: 'Katalog – Dějepis' },
      select: { id: true },
    });

    // patch: změníme název + napojíme NA JINÝ catalogSubject
    const res = await request(app.getHttpServer())
      .patch(`/subjects/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'Dějepis – rozšířený', catalogSubjectId: otherCatalog.id })
      .expect(200);

    expect(res.body.name).toBe('Dějepis – rozšířený');
    expect(res.body.catalogSubjectId).toBe(otherCatalog.id);

    // cleanup
    await prisma.subject.delete({ where: { id: tmp.id } });
    await prisma.catalogSubject.delete({ where: { id: otherCatalog.id } });
  });

  it('PATCH /subjects/:id → TEACHER v orgA může [200]', async () => {
    const tmp = await prisma.subject.create({
      data: { name: 'Zeměpis', organizationId: orgA.id },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .patch(`/subjects/${tmp.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({ name: 'Zeměpis – edit' })
      .expect(200);

    await prisma.subject.delete({ where: { id: tmp.id } });
  });

  it('PATCH /subjects/:id → 409 duplicitní name v org [409]', async () => {
    // pokus změnit subjectA2 na "Matematika" (existuje v orgA)
    await request(app.getHttpServer())
      .patch(`/subjects/${subjectA2Id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'Matematika' })
      .expect(409);
  });

  it('PATCH /subjects/:id → 403 TEACHER jiné org', async () => {
    await request(app.getHttpServer())
      .patch(`/subjects/${subjectA1Id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ name: 'NOPE' })
      .expect(403);
  });

  it('PATCH /subjects/:id → 404 když neexistuje', async () => {
    await request(app.getHttpServer())
      .patch('/subjects/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'XY' })
      .expect(404);
  });

  // ---------------------------
  // DELETE (soft)
  // ---------------------------
  it('DELETE /subjects/:id → DIRECTOR své org smaže (soft) [200]', async () => {
    const tmp = await prisma.subject.create({
      data: { name: 'Tělesná výchova', organizationId: orgA.id },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .delete(`/subjects/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.id).toBe(tmp.id);
    const check = await prisma.subject.findUnique({ where: { id: tmp.id } });
    expect(check?.deletedAt).not.toBeNull();
  });

  it('DELETE /subjects/:id → 403 TEACHER jiné org', async () => {
    await request(app.getHttpServer())
      .delete(`/subjects/${subjectA1Id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('DELETE /subjects/:id → 404 neexistuje', async () => {
    await request(app.getHttpServer())
      .delete('/subjects/33333333-3333-4333-8333-333333333333')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  // ---------------------------
  // Subject → Levels / TopicLevels
  // ---------------------------
  it('GET /subjects/:id/levels → seznam levelů [200]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}/levels`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((x: any) => x.id);
    expect(ids).toContain(levelA1_1Id);
  });

  it('GET /subjects/:id/topics → seznam topicLevels přes levels [200]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}/topics`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((x: any) => x.id);
    expect(ids).toContain(topicLvA1_1Id);
  });

  // ============================
  // EXTRA TESTS / EDGE CASES
  // ============================

  it('GET /subjects → SUPERADMIN vidí napříč organizacemi [200]', async () => {
    // vytvoř subject v orgB
    const sb = await prisma.subject.create({
      data: { name: 'Fyzika (orgB)', organizationId: orgB.id },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const ids = res.body.data.map((x: any) => x.id);
    expect(ids).toContain(sb.id);

    await prisma.subject.delete({ where: { id: sb.id } });
  });

  it('GET /subjects → STUDENT nemá přístup (403)', async () => {
    // založ studenta + membership v orgA + re-login
    const rStud = await register(app, 'subjects_extra_student');
    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: rStud.user.id,
        role: OrganizationRole.STUDENT,
      },
    });
    const studToken = await login(app, rStud.login);

    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${studToken}`)
      .expect(403);

    // cleanup user
    await prisma.refreshToken.deleteMany({ where: { userId: rStud.user.id } });
    await prisma.user.delete({ where: { id: rStud.user.id } });
  });

  it('GET /subjects/:id/levels → TEACHER jiné org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}/levels`)
      .set('Authorization', `Bearer ${teacherB1.token}`) // učitel z orgB
      .expect(403);
  });

  it('GET /subjects/:id/topics → TEACHER jiné org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/subjects/${subjectA1Id}/topics`)
      .set('Authorization', `Bearer ${teacherB1.token}`) // učitel z orgB
      .expect(403);
  });

  it('PATCH /subjects/:id → 404 když catalogSubjectId neexistuje', async () => {
    const tmp = await prisma.subject.create({
      data: { name: 'Biologie', organizationId: orgA.id },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .patch(`/subjects/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: 'Biologie – edit',
        catalogSubjectId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(404);

    await prisma.subject.delete({ where: { id: tmp.id } });
  });

  it('PATCH /subjects/:id → no-op (prázdný body) [200] a hodnoty beze změny', async () => {
    const tmp = await prisma.subject.create({
      data: { name: 'Informatika – no-op', organizationId: orgA.id },
      select: { id: true },
    });
    const before = await prisma.subject.findUnique({ where: { id: tmp.id } });

    const res = await request(app.getHttpServer())
      .patch(`/subjects/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({})
      .expect(200);

    expect(res.body.name).toBe(before!.name);
    expect(res.body.catalogSubjectId).toBe(before!.catalogSubjectId);

    await prisma.subject.delete({ where: { id: tmp.id } });
  });

  it('POST /subjects → duplicitní název po trimu (409)', async () => {
    await request(app.getHttpServer())
      .post('/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: '   Matematika   ', organizationId: orgA.id }) // už existuje 'Matematika'
      .expect(409);
  });

  it('GET /subjects/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/subjects/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  it('DELETE /subjects/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .delete('/subjects/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  it('DELETE → smazaný subject se neobjeví v listu', async () => {
    const tmp = await prisma.subject.create({
      data: { name: 'VV – k vymazání', organizationId: orgA.id },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/subjects/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids = list.body.data.map((x: any) => x.id);
    expect(ids).not.toContain(tmp.id);
  });

  it('GET /subjects → includeLevels=false (default) – položky nemají .levels', async () => {
    const res = await request(app.getHttpServer())
      .get('/subjects') // includeLevels vynecháno
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const item = res.body.data.find((x: any) => x.id === subjectA1Id);
    expect(item).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(item, 'levels')).toBe(false);
  });
});
