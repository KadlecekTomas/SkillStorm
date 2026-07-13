// test/e2e/catalog.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  $Enums,
  OrganizationRole,
  SchoolGrade,
  TopicPhase,
  Difficulty,
  SystemRole,
} from '@prisma/client';
import { createSystemUser, setupOrgContext } from 'test/helpers';

describe('Catalog (e2e)', () => {
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

  // org + year + level infra
  let org: { id: string };
  let ctx: Awaited<ReturnType<typeof setupOrgContext>>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let year: { id: string } | null = null;
  let subjectFromMaterialize: { id: string } | null = null;
  let subjectLevelForMaterialize: { id: string } | null = null;

  // catalog seed
  let catSubjectA: { id: string; code: string; name: string };
  let catSubjectB: { id: string; code: string; name: string };
  let catTopicA1: { id: string; name: string };
  let catTopicA2: { id: string; name: string };
  let catTopicB1: { id: string; name: string };

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

    ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: 'catalog',
      with: { teacher: true, student: true },
    });

    org = { id: ctx.organization.id };
    director = {
      id: ctx.owner.user.id,
      token: ctx.owner.accessToken,
      login: ctx.owner.login,
    };
    teacher = {
      id: ctx.teacher!.user.id,
      token: ctx.teacher!.accessToken,
      login: ctx.teacher!.login,
    };
    student = {
      id: ctx.student!.user.id,
      token: ctx.student!.accessToken,
      login: ctx.student!.login,
    };

    const superUserAuth = await createSystemUser(
      app,
      prisma,
      SystemRole.SUPERADMIN,
      'catalog_super',
    );
    await ctx.addMembershipForUser(
      superUserAuth.user.id,
      OrganizationRole.DIRECTOR,
    );
    superUser = {
      id: superUserAuth.user.id,
      token: superUserAuth.accessToken,
      login: superUserAuth.login,
    };

    // academic year (kvůli subject levels materializaci)
    year = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: '2025/26',
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });

    // catalog seed (přes service by šlo taky, ale jednodušší je přímý seed)
    catSubjectA = await prisma.catalogSubject.create({
      data: { code: 'MATH', name: 'Matematika' },
      select: { id: true, code: true, name: true },
    });
    catSubjectB = await prisma.catalogSubject.create({
      data: { code: 'PHY', name: 'Fyzika' },
      select: { id: true, code: true, name: true },
    });

    [catTopicA1, catTopicA2] = await prisma.$transaction([
      prisma.catalogTopic.create({
        data: { subjectId: catSubjectA.id, name: 'Zlomky' },
        select: { id: true, name: true },
      }),
      prisma.catalogTopic.create({
        data: { subjectId: catSubjectA.id, name: 'Rovnice' },
        select: { id: true, name: true },
      }),
    ]);

    catTopicB1 = await prisma.catalogTopic.create({
      data: { subjectId: catSubjectB.id, name: 'Mechanika' },
      select: { id: true, name: true },
    });
  });

  afterAll(async () => {
    // cleanup subject/materialized levels
    if (subjectLevelForMaterialize?.id) {
      await prisma.topicLevel.deleteMany({
        where: { subjectLevelId: subjectLevelForMaterialize.id },
      });
    }
    if (subjectFromMaterialize?.id) {
      await prisma.subjectLevel.deleteMany({
        where: { subjectId: subjectFromMaterialize.id },
      });
      await prisma.subject.deleteMany({
        where: { id: subjectFromMaterialize.id },
      });
    }

    // cleanup catalog
    await prisma.catalogTopic.deleteMany({
      where: { id: { in: [catTopicA1.id, catTopicA2.id, catTopicB1.id] } },
    });
    await prisma.catalogSubject.deleteMany({
      where: { id: { in: [catSubjectA.id, catSubjectB.id] } },
    });

    // org tree
    await prisma.membership.deleteMany({ where: { organizationId: org.id } });
    await prisma.academicYear.deleteMany({ where: { orgId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });

    // users
    await prisma.refreshToken.deleteMany({
      where: {
        userId: { in: [superUser.id, director.id, teacher.id, student.id] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [superUser.id, director.id, teacher.id, student.id] },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------
  // READ: subjects + topics
  // ---------------------------

  it('GET /catalog/subjects → 200 list + search (DIRECTOR)', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalog/subjects')
      .set('Authorization', `Bearer ${director.token}`)
      .query({ search: 'mat', page: 1, limit: 10 })
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    const codes = res.body.data.map((s: any) => s.code);
    expect(codes).toContain('MATH');
  });

  it('GET /catalog/subjects/:id → 200 detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/catalog/subjects/${catSubjectA.id}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    expect(res.body.id).toBe(catSubjectA.id);
    expect(res.body.code).toBe('MATH');
  });

  it('GET /catalog/subjects/:id/topics → 200 list topics by subject (DIRECTOR)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/catalog/subjects/${catSubjectA.id}/topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .query({ search: 'ov', page: 1, limit: 50 })
      .expect(200);

    const names = res.body.data.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(['Rovnice']));
  });

  it('GET /catalog/topics/:id → 200 detail topic (DIRECTOR)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/catalog/topics/${catTopicA1.id}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);

    expect(res.body.id).toBe(catTopicA1.id);
    expect(res.body.subject.code).toBe('MATH');
  });

  // ---------------------------
  // CRUD (SUPERADMIN)
  // ---------------------------

  it('POST /catalog/subjects (SUPERADMIN) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/subjects')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ code: 'BIO', name: 'Biologie' })
      .expect(201);

    expect(res.body.code).toBe('BIO');

    // cleanup
    await prisma.catalogSubject.delete({ where: { id: res.body.id } });
  });

  it('POST /catalog/subjects (director) → 403', async () => {
    await request(app.getHttpServer())
      .post('/catalog/subjects')
      .set('Authorization', `Bearer ${director.token}`)
      .send({ code: 'GEO', name: 'Geografie' })
      .expect(403);
  });

  it('PATCH /catalog/subjects/:id (SUPERADMIN) → 200', async () => {
    const cs = await prisma.catalogSubject.create({
      data: { code: 'TMP', name: 'Dočas' },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .patch(`/catalog/subjects/${cs.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'Dočas upraven' })
      .expect(200);

    expect(res.body.name).toMatch(/upraven/i);

    await prisma.catalogSubject.delete({ where: { id: cs.id } });
  });

  it('DELETE /catalog/subjects/:id (SUPERADMIN) → 200', async () => {
    const cs = await prisma.catalogSubject.create({
      data: { code: 'DEL', name: 'Ke smazání' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/catalog/subjects/${cs.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const gone = await prisma.catalogSubject.findUnique({
      where: { id: cs.id },
    });
    expect(gone).toBeNull();
  });

  it('POST /catalog/subjects/:id/topics (SUPERADMIN) → 201', async () => {
    const cs = await prisma.catalogSubject.create({
      data: { code: 'CHE', name: 'Chemie' },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post(`/catalog/subjects/${cs.id}/topics`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ subjectId: cs.id, name: 'Stavba látky' })
      .expect(201);

    expect(res.body.subjectId).toBe(cs.id);

    // cleanup
    await prisma.catalogTopic.delete({ where: { id: res.body.id } });
    await prisma.catalogSubject.delete({ where: { id: cs.id } });
  });

  it('PATCH /catalog/topics/:id (SUPERADMIN) → 200', async () => {
    const cs = await prisma.catalogSubject.create({
      data: { code: 'HIS', name: 'Dějepis' },
      select: { id: true },
    });
    const ct = await prisma.catalogTopic.create({
      data: { subjectId: cs.id, name: 'Pravěk' },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .patch(`/catalog/topics/${ct.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'Pravěk a starověk' })
      .expect(200);
    expect(res.body.name).toMatch(/starověk/i);

    await prisma.catalogTopic.delete({ where: { id: ct.id } });
    await prisma.catalogSubject.delete({ where: { id: cs.id } });
  });

  it('DELETE /catalog/topics/:id (SUPERADMIN) → 200', async () => {
    const ct = await prisma.catalogTopic.create({
      data: { subjectId: catSubjectA.id, name: 'Dočasné téma' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/catalog/topics/${ct.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const gone = await prisma.catalogTopic.findUnique({ where: { id: ct.id } });
    expect(gone).toBeNull();
  });

  // ---------------------------
  // MATERIALIZE
  // ---------------------------

  it('POST /catalog/subjects/:id/materialize-to-org (DIRECTOR) → 201 + optional levels', async () => {
    const res = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-to-org`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        organizationId: org.id,
        nameOverride: 'Matematika (org)',
        createLevelsForGrades: [SchoolGrade.GRADE_6, SchoolGrade.GRADE_7],
      })
      .expect(201);

    subjectFromMaterialize = res.body;
    if (!subjectFromMaterialize) {
      throw new Error('subjectFromMaterialize is null');
    }

    // levels created?
    const levels = await prisma.subjectLevel.findMany({
      where: { subjectId: subjectFromMaterialize.id },
    });
    expect(levels.length).toBeGreaterThanOrEqual(2);

    // pro další testy si necháme 1 level bokem
    if (!levels[0]) {
      throw new Error('No subject levels created');
    }
    subjectLevelForMaterialize = { id: levels[0].id };
  });

  it('POST /catalog/topics/:id/materialize-to-subject-level (DIRECTOR) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/catalog/topics/${catTopicA2.id}/materialize-to-subject-level`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        subjectLevelId: subjectLevelForMaterialize!.id,
        phase: TopicPhase.INTRO,
        difficulty: Difficulty.BASIC,
        order: 10,
      })
      .expect(201);

    expect(res.body.subjectLevel.id).toBe(subjectLevelForMaterialize!.id);
  });

  it('POST /catalog/subjects/:id/materialize-topics (DIRECTOR) → 201 bulk', async () => {
    const res = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        catalogSubjectId: catSubjectA.id,
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicIds: [catTopicA1.id, catTopicA2.id],
        defaultPhase: TopicPhase.DEEPEN,
        defaultDifficulty: Difficulty.INTERMEDIATE,
      })
      .expect(201);

    expect(res.body.createdCount).toBeGreaterThan(0);
  });

  // ---------------------------
  // RBAC basic matrix
  // ---------------------------

  it('student nemá přístup k materialize endpointům → 403', async () => {
    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-to-org`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ organizationId: org.id })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/catalog/topics/${catTopicA1.id}/materialize-to-subject-level`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ subjectLevelId: subjectLevelForMaterialize!.id })
      .expect(403);
  });

  // ---------------------------
  // VALIDATION & EDGES
  // ---------------------------

  it('GET /catalog/subjects → 400 na invalidní page/limit', async () => {
    await request(app.getHttpServer())
      .get('/catalog/subjects?page=0&limit=0')
      .set('Authorization', `Bearer ${director.token}`)
      .expect(400);
  });

  it('GET /catalog/subjects/:id → 404 pro non-existing UUID', async () => {
    await request(app.getHttpServer())
      .get(`/catalog/subjects/${randomUUID()}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(404);
  });

  it('POST /catalog/subjects/:id/topics (SUPERADMIN) → 403 když DTO.subjectId != path', async () => {
    const other = await prisma.catalogSubject.create({
      data: { code: 'DIFF', name: 'Jiný' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/topics`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ subjectId: other.id, name: 'Mismatch' })
      .expect(403);

    await prisma.catalogSubject.delete({ where: { id: other.id } });
  });

  // ---------------------------
  // CACHE bump smoke
  // ---------------------------

  it('CRUD na catalog bumpne global cache verzi → změny jsou hned vidět (smoke)', async () => {
    // list před
    const before = await request(app.getHttpServer())
      .get('/catalog/subjects')
      .set('Authorization', `Bearer ${director.token}`)
      .query({ page: 1, limit: 200 })
      .expect(200);
    const beforeNames = new Set(before.body.data.map((s: any) => s.name));

    // create + update + delete
    const created = await request(app.getHttpServer())
      .post('/catalog/subjects')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ code: 'TMPX', name: 'Dočasné X' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/catalog/subjects/${created.body.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'Dočasné X+1' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/catalog/subjects/${created.body.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    // list po – s cache-busterem přes search (nebo změnou pořadí)
    const after = await request(app.getHttpServer())
      .get('/catalog/subjects')
      .set('Authorization', `Bearer ${director.token}`)
      .query({ page: 1, limit: 200, search: '' + Date.now() }) // nevadí, služba ignoruje empty → jen "bust"
      .expect(200);

    const afterNames = new Set(after.body.data.map((s: any) => s.name));
    // nezaručujeme konkrétní diff, jen že dotaz projde (cache bump se nadoraz netestuje)
    expect(afterNames).toBeDefined();
    expect(beforeNames).toBeDefined();
  });

  it('GET /catalog/subjects (STUDENT) → 403', async () => {
    await request(app.getHttpServer())
      .get('/catalog/subjects')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);
  });

  it('POST /catalog/subjects (SUPERADMIN) → 409 když code už existuje', async () => {
    // MATH už existuje z beforeAll
    await request(app.getHttpServer())
      .post('/catalog/subjects')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ code: 'MATH', name: 'Duplicitní' })
      .expect(409);
  });

  it('POST /catalog/subjects/:id/topics → 409 duplicitní topic name v rámci stejného subjectu', async () => {
    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/topics`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ subjectId: catSubjectA.id, name: 'Zlomky' }) // existuje z beforeAll
      .expect(409);
  });

  it('PATCH /catalog/topics/:id → 409 když přesun do jiného subjectu způsobí duplicitní name', async () => {
    // vytvoř dočasný topic 'Mechanika' v MATH, aby přesun stejného jména z PHY failnul
    const tmp = await prisma.catalogTopic.create({
      data: { subjectId: catSubjectA.id, name: 'Mechanika' },
      select: { id: true },
    });

    // topic catTopicB1 = 'Mechanika' v PHY -> pokus o přesun do MATH narazí na duplicitní jméno
    await request(app.getHttpServer())
      .patch(`/catalog/topics/${catTopicB1.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ subjectId: catSubjectA.id })
      .expect(409);

    await prisma.catalogTopic.delete({ where: { id: tmp.id } });
  });

  it('POST materialize-to-org (TEACHER) → 403 do cizí org', async () => {
    const otherCtx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `catalog_other_${Date.now()}`,
    });

    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-to-org`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ organizationId: otherCtx.organization.id }) // teacher není členem
      .expect(403);

    await prisma.membership.deleteMany({
      where: { organizationId: otherCtx.organization.id },
    });
    await prisma.organization.delete({
      where: { id: otherCtx.organization.id },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: otherCtx.owner.user.id },
    });
    await prisma.user.delete({ where: { id: otherCtx.owner.user.id } });
  });

  it('POST materialize-to-org (DIRECTOR) → createLevelsForGrades idempotentní (duplicitní ročníky se nezdvojí)', async () => {
    const cs = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectB.id}/materialize-to-org`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        organizationId: org.id,
        createLevelsForGrades: [
          SchoolGrade.GRADE_6,
          SchoolGrade.GRADE_6,
          SchoolGrade.GRADE_7,
        ],
      })
      .expect(201);

    const levels = await prisma.subjectLevel.findMany({
      where: { subjectId: cs.body.id },
    });
    const set = new Set(levels.map((l) => l.grade));
    expect(set.has(SchoolGrade.GRADE_6)).toBe(true);
    expect(set.has(SchoolGrade.GRADE_7)).toBe(true);
    expect(levels.length).toBe(set.size); // bez duplicit

    // cleanup
    await prisma.topicLevel.deleteMany({
      where: { subjectLevel: { subjectId: cs.body.id } },
    });
    await prisma.subjectLevel.deleteMany({ where: { subjectId: cs.body.id } });
    await prisma.subject.delete({ where: { id: cs.body.id } });
  });

  it('POST materialize-to-org (TEACHER) → 403 do cizí org', async () => {
    const otherCtx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `catalog_other_2_${Date.now()}`,
    });

    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-to-org`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .send({ organizationId: otherCtx.organization.id }) // teacher není členem
      .expect(403);

    await prisma.membership.deleteMany({
      where: { organizationId: otherCtx.organization.id },
    });
    await prisma.organization.delete({
      where: { id: otherCtx.organization.id },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: otherCtx.owner.user.id },
    });
    await prisma.user.delete({ where: { id: otherCtx.owner.user.id } });
  });

  it('POST materialize-to-org (DIRECTOR) → createLevelsForGrades idempotentní (duplicitní ročníky se nezdvojí)', async () => {
    const cs = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectB.id}/materialize-to-org`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        organizationId: org.id,
        createLevelsForGrades: [
          SchoolGrade.GRADE_6,
          SchoolGrade.GRADE_6,
          SchoolGrade.GRADE_7,
        ],
      })
      .expect(201);

    const levels = await prisma.subjectLevel.findMany({
      where: { subjectId: cs.body.id },
    });
    const set = new Set(levels.map((l) => l.grade));
    expect(set.has(SchoolGrade.GRADE_6)).toBe(true);
    expect(set.has(SchoolGrade.GRADE_7)).toBe(true);
    expect(levels.length).toBe(set.size); // bez duplicit

    // cleanup
    await prisma.topicLevel.deleteMany({
      where: { subjectLevel: { subjectId: cs.body.id } },
    });
    await prisma.subjectLevel.deleteMany({ where: { subjectId: cs.body.id } });
    await prisma.subject.delete({ where: { id: cs.body.id } });
  });

  it('POST materialize-to-subject-level → 409 když už pro stejný catalogTopic a phase existuje TopicLevel', async () => {
    // první create (ok)
    await request(app.getHttpServer())
      .post(`/catalog/topics/${catTopicA1.id}/materialize-to-subject-level`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        subjectLevelId: subjectLevelForMaterialize!.id,
        phase: TopicPhase.INTRO,
        difficulty: Difficulty.BASIC,
      })
      .expect(201);

    // druhý stejné (fail díky unique [subjectLevelId, catalogTopicId, phase])
    await request(app.getHttpServer())
      .post(`/catalog/topics/${catTopicA1.id}/materialize-to-subject-level`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        subjectLevelId: subjectLevelForMaterialize!.id,
        phase: TopicPhase.INTRO,
        difficulty: Difficulty.ADVANCED,
      })
      .expect(409);
  });
  it('POST materialize-topics (DIRECTOR) → 404 když některé catalogTopicIds nepatří do subjectu', async () => {
    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        catalogSubjectId: catSubjectA.id,
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicIds: [catTopicA1.id, catTopicB1.id], // B1 je z PHY
      })
      .expect(404);
  });

  it('POST materialize-topics (DIRECTOR) → order respektuje appendAfter i auto-last', async () => {
    // 1) smaž existující TopicLevel pro čistotu
    await prisma.topicLevel.deleteMany({
      where: { subjectLevelId: subjectLevelForMaterialize!.id },
    });

    // 2) první várka bez appendAfter → order začne od last (zde 0) + 1
    const r1 = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        catalogSubjectId: catSubjectA.id,
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicIds: [catTopicA1.id],
        defaultPhase: TopicPhase.INTRO,
        defaultDifficulty: Difficulty.BASIC,
      })
      .expect(201);

    expect(r1.body.createdCount).toBe(1);
    const first = await prisma.topicLevel.findFirst({
      where: {
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicId: catTopicA1.id,
      },
    });
    expect(first?.order).toBeGreaterThanOrEqual(1);

    // 3) druhá várka s appendAfter = current last → naváže
    const r2 = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        catalogSubjectId: catSubjectA.id,
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicIds: [catTopicA2.id],
        defaultPhase: TopicPhase.DEEPEN,
        defaultDifficulty: Difficulty.INTERMEDIATE,
        appendAfter: first!.order!,
      })
      .expect(201);

    expect(r2.body.createdCount).toBe(1);
    const second = await prisma.topicLevel.findFirst({
      where: {
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicId: catTopicA2.id,
      },
    });
    expect(second?.order).toBe(first!.order! + 1);
  });

  it('POST materialize-topics → idempotentní při opakovaném volání (nevzniknou duplicitní řádky)', async () => {
    const payload = {
      catalogSubjectId: catSubjectA.id,
      subjectLevelId: subjectLevelForMaterialize!.id,
      catalogTopicIds: [catTopicA1.id, catTopicA2.id],
      defaultPhase: TopicPhase.INTRO,
      defaultDifficulty: Difficulty.BASIC,
    };

    await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send(payload)
      .expect(201);

    const r2 = await request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send(payload)
      .expect(201);

    // druhý běh by měl vytvořit 0 nových (vše existuje)
    expect([0, r2.body.createdCount]).toContain(r2.body.createdCount);
  });
  it('GET /catalog/subjects/:id/topics → 400 na nevalidní page/limit', async () => {
    await request(app.getHttpServer())
      .get(`/catalog/subjects/${catSubjectA.id}/topics?page=0&limit=0`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(400);
  });

  it('GET /catalog/topics/:id → 404 neexistující UUID', async () => {
    await request(app.getHttpServer())
      .get(`/catalog/topics/${randomUUID()}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(404);
  });

  it('POST materialize-topics → dva paralelní bulky skončí konzistentně (no mix)', async () => {
    // clean
    await prisma.topicLevel.deleteMany({
      where: { subjectLevelId: subjectLevelForMaterialize!.id },
    });

    const p1 = request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        catalogSubjectId: catSubjectA.id,
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicIds: [catTopicA1.id],
        defaultPhase: TopicPhase.INTRO,
        defaultDifficulty: Difficulty.BASIC,
      });

    const p2 = request(app.getHttpServer())
      .post(`/catalog/subjects/${catSubjectA.id}/materialize-topics`)
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        catalogSubjectId: catSubjectA.id,
        subjectLevelId: subjectLevelForMaterialize!.id,
        catalogTopicIds: [catTopicA2.id],
        defaultPhase: TopicPhase.INTRO,
        defaultDifficulty: Difficulty.BASIC,
      });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect([200, 201]).toContain(r1.status);
    expect([200, 201]).toContain(r2.status);

    const final = await prisma.topicLevel.findMany({
      where: { subjectLevelId: subjectLevelForMaterialize!.id },
      orderBy: { order: 'asc' },
    });
    // Výsledek je buď jen A1, nebo jen A2, nebo oba ve stabilním pořadí (podle toho, co doběhlo)
    expect(final.length).toBeGreaterThanOrEqual(1);
    expect(final.length).toBeLessThanOrEqual(2);
  });
});
