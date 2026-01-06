// test/e2e/topics.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  $Enums,
  OrganizationRole,
  ContentType,
  TopicPhase,
  Difficulty,
  SystemRole,
} from '@prisma/client';
import { createSystemUser, setupOrgContext } from 'test/helpers';

async function makeTempTopic(
  prisma: PrismaService,
  params: {
    levelId: string;
    catSubjectId: string; // např. catSubMath.id
    phase: $Enums.TopicPhase;
  },
): Promise<{ topic: { id: string }; cat: { id: string } }> {
  const cat = await prisma.catalogTopic.create({
    data: {
      subjectId: params.catSubjectId,
      name: `TMP_${Date.now()}_${Math.random()}`,
    },
    select: { id: true },
  });
  const topic = await prisma.topicLevel.create({
    data: {
      subjectLevelId: params.levelId,
      catalogTopicId: cat.id,
      phase: params.phase,
    },
    select: { id: true },
  });
  return { topic, cat };
}

describe('Topics (e2e)', () => {
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
  let directorB: {
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
  let studentUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  let ctxA: Awaited<ReturnType<typeof setupOrgContext>>;
  let ctxB: Awaited<ReturnType<typeof setupOrgContext>>;

  // memberships (kvůli createdById u materiálů/testů)
  let mbDirectorA!: { id: string };
  let mbTeacherA1!: { id: string };
  let mbTeacherB1!: { id: string };

  // subjects/levels/topics (seed)
  let subjectA_math!: { id: string };
  let levelA_math_g5!: { id: string };
  let topicSeed_intro!: { id: string };

  // catalog
  let catSubMath!: { id: string };
  let catSubPhys!: { id: string };
  let catTopicFractions!: { id: string };
  let catTopicGeometry!: { id: string };
  let catTopicForce!: { id: string };

  // materials & tests (orgA)
  let matA1!: { id: string };
  let matA2!: { id: string };
  let matA3_global!: { id: string }; // global material (organizationId=null)
  let testA1!: { id: string };
  let testA2!: { id: string };

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

    ctxA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: 'topicsA',
    });
    ctxB = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: 'topicsB',
    });

    orgA = { id: ctxA.organization.id };
    orgB = { id: ctxB.organization.id };

    directorA = {
      id: ctxA.owner.user.id,
      token: ctxA.owner.accessToken,
      login: ctxA.owner.login,
    };
    directorB = {
      id: ctxB.owner.user.id,
      token: ctxB.owner.accessToken,
      login: ctxB.owner.login,
    };

    const superUserAuth = await createSystemUser(
      app,
      prisma,
      SystemRole.SUPERADMIN,
      'topics_super',
    );
    await ctxA.addMembershipForUser(
      superUserAuth.user.id,
      OrganizationRole.DIRECTOR,
    );
    await ctxB.addMembershipForUser(
      superUserAuth.user.id,
      OrganizationRole.DIRECTOR,
    );
    superUser = {
      id: superUserAuth.user.id,
      token: superUserAuth.accessToken,
      login: superUserAuth.login,
    };

    const tA1 = await ctxA.addMember(
      OrganizationRole.TEACHER,
      'topics_teacherA1',
    );
    teacherA1 = {
      id: tA1.user.id,
      token: tA1.accessToken,
      login: tA1.login,
    };
    mbTeacherA1 = tA1.membership;
    await prisma.teacher.create({
      data: { membershipId: mbTeacherA1.id, organizationId: orgA.id },
      select: { id: true },
    });

    const tB1 = await ctxB.addMember(
      OrganizationRole.TEACHER,
      'topics_teacherB1',
    );
    teacherB1 = {
      id: tB1.user.id,
      token: tB1.accessToken,
      login: tB1.login,
    };
    mbTeacherB1 = tB1.membership;
    await prisma.teacher.create({
      data: { membershipId: mbTeacherB1.id, organizationId: orgB.id },
      select: { id: true },
    });

    const stud = await ctxA.addMember(
      OrganizationRole.STUDENT,
      'topics_student1',
    );
    studentUser = {
      id: stud.user.id,
      token: stud.accessToken,
      login: stud.login,
    };

    mbDirectorA = ctxA.owner.membership;

    // catalog subjects + topics
    catSubMath = await prisma.catalogSubject.create({
      data: { code: `MATH_${Date.now()}`, name: 'Matematika (kat)' },
      select: { id: true },
    });
    catSubPhys = await prisma.catalogSubject.create({
      data: { code: `PHYS_${Date.now()}`, name: 'Fyzika (kat)' },
      select: { id: true },
    });

    catTopicFractions = await prisma.catalogTopic.create({
      data: { subjectId: catSubMath.id, name: 'Zlomky' },
      select: { id: true },
    });
    catTopicGeometry = await prisma.catalogTopic.create({
      data: { subjectId: catSubMath.id, name: 'Geometrie' },
      select: { id: true },
    });
    catTopicForce = await prisma.catalogTopic.create({
      data: { subjectId: catSubPhys.id, name: 'Síla' },
      select: { id: true },
    });

    // subject v orgA + level
    subjectA_math = await prisma.subject.create({
      data: {
        name: 'Matematika',
        organizationId: orgA.id,
        catalogSubjectId: catSubMath.id,
      },
      select: { id: true },
    });
    levelA_math_g5 = await prisma.subjectLevel.create({
      data: {
        subjectId: subjectA_math.id,
        grade: $Enums.SchoolGrade.GRADE_5,
        order: 1,
      },
      select: { id: true },
    });

    // seed topic (INTRO, fractions)
    topicSeed_intro = await prisma.topicLevel.create({
      data: {
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicFractions.id,
        phase: TopicPhase.INTRO,
        difficulty: Difficulty.BASIC,
        order: 1,
      },
      select: { id: true },
    });

    // materials (orgA + 1 global)
    matA1 = await prisma.learningMaterial.create({
      data: {
        title: 'Materiál A1',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        subjectId: subjectA_math.id,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
        isDownloadable: true,
      },
      select: { id: true },
    });

    matA2 = await prisma.learningMaterial.create({
      data: {
        title: 'Materiál A2',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        subjectId: subjectA_math.id,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    matA3_global = await prisma.learningMaterial.create({
      data: {
        title: 'Materiál GLOBAL',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        subjectId: null,
        organizationId: null, // globální
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    // tests (orgA)
    testA1 = await prisma.test.create({
      data: {
        organizationId: orgA.id,
        title: 'Test A1',
        description: 'desc',
        creatorId: mbDirectorA.id,
      },
      select: { id: true },
    });
    testA2 = await prisma.test.create({
      data: {
        organizationId: orgA.id,
        title: 'Test A2',
        description: 'desc',
        creatorId: mbDirectorA.id,
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    // cleanup — best effort
    await prisma.testAssignment
      .deleteMany({ where: { testId: { in: [testA1.id, testA2.id] } } })
      .catch(() => {});
    await prisma.materialAssignment
      .deleteMany({
        where: { materialId: { in: [matA1.id, matA2.id, matA3_global.id] } },
      })
      .catch(() => {});
    await prisma.test
      .deleteMany({ where: { id: { in: [testA1.id, testA2.id] } } })
      .catch(() => {});
    await prisma.learningMaterial
      .deleteMany({
        where: { id: { in: [matA1.id, matA2.id, matA3_global.id] } },
      })
      .catch(() => {});
    await prisma.topicLevel
      .deleteMany({ where: { id: { in: [topicSeed_intro.id] } } })
      .catch(() => {});
    await prisma.subjectLevel
      .deleteMany({ where: { id: { in: [levelA_math_g5.id] } } })
      .catch(() => {});
    await prisma.subject
      .deleteMany({ where: { id: { in: [subjectA_math.id] } } })
      .catch(() => {});
    await prisma.catalogTopic
      .deleteMany({
        where: {
          id: {
            in: [catTopicFractions.id, catTopicGeometry.id, catTopicForce.id],
          },
        },
      })
      .catch(() => {});
    await prisma.catalogSubject
      .deleteMany({ where: { id: { in: [catSubMath.id, catSubPhys.id] } } })
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
            in: [
              superUser.id,
              directorA.id,
              directorB.id,
              teacherA1.id,
              teacherB1.id,
              studentUser.id,
            ],
          },
        },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: {
          id: {
            in: [
              superUser.id,
              directorA.id,
              directorB.id,
              teacherA1.id,
              teacherB1.id,
              studentUser.id,
            ],
          },
        },
      })
      .catch(() => {});

    await prisma.teacher
      .deleteMany({
        where: {
          membershipId: {
            in: [mbTeacherA1?.id, mbTeacherB1?.id].filter(Boolean) as string[],
          },
        },
      })
      .catch(() => {});

    await prisma.membership
      .deleteMany({
        where: {
          id: {
            in: [mbTeacherA1?.id, mbTeacherB1?.id].filter(Boolean) as string[],
          },
        },
      })
      .catch(() => {});

    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------
  // CREATE
  // ---------------------------
  it('POST /topics → DIRECTOR vytvoří topic [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicGeometry.id,
        name: 'Geom intro',
        phase: TopicPhase.INTRO, // stejné phase OK, protože jiný catalogTopic
        difficulty: Difficulty.INTERMEDIATE,
        order: 2,
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.subjectLevelId).toBe(levelA_math_g5.id);

    // cleanup created topic
    await prisma.topicLevel.delete({ where: { id: res.body.id } });
  });

  it('POST /topics → DIRECTOR v orgA vytvoří [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicGeometry.id,
        phase: TopicPhase.DEEPEN, // jiná phase než seed
        order: 3,
      })
      .expect(201);

    expect(res.body.phase).toBe(TopicPhase.DEEPEN);

    await prisma.topicLevel.delete({ where: { id: res.body.id } });
  });

  it('POST /topics → 403 TEACHER jiné organizace', async () => {
    await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicGeometry.id,
      })
      .expect(403);
  });

  it('POST /topics → 404 neexistující catalogTopic', async () => {
    await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: '11111111-1111-4111-8111-111111111111',
      })
      .expect(404);
  });

  it('POST /topics → 409 duplicitní (subjectLevel + catalogTopic + phase)', async () => {
    // duplicita seed: (levelA_math_g5, catTopicFractions, INTRO)
    await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicFractions.id,
        phase: TopicPhase.INTRO,
      })
      .expect(409);
  });

  it('POST /topics → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        subjectLevelId: 'not-uuid',
        catalogTopicId: 'not-uuid',
      })
      .expect(400);
  });

  // ---------------------------
  // LIST (pagination + filters + search)
  // ---------------------------
  it('GET /topics → paginace + stabilní pořadí + over-page prázdno', async () => {
    // vytvoř tři různá témata přes helper (vždy unikátní kombinace)
    const { topic: t1, cat: c1 } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });
    const { topic: t2, cat: c2 } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.DEEPEN,
    });
    const { topic: t3, cat: c3 } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.EXTENSION,
    });

    const page1 = await request(app.getHttpServer())
      .get('/topics')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const again = await request(app.getHttpServer())
      .get('/topics')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(page1.body.data).toEqual(again.body.data);

    const pages = page1.body.meta.pages;
    const over = await request(app.getHttpServer())
      .get('/topics')
      .query({ page: pages + 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(over.body.data).toEqual([]);

    // cleanup
    await prisma.topicLevel.deleteMany({
      where: { id: { in: [t1.id, t2.id, t3.id] } },
    });
    await prisma.catalogTopic.deleteMany({
      where: { id: { in: [c1.id, c2.id, c3.id] } },
    });
  });

  it('GET /topics → filter by subjectId / subjectLevelId / search [200]', async () => {
    // search by catalog topic name prefix 'Zlo'
    const res1 = await request(app.getHttpServer())
      .get('/topics')
      .query({ search: 'Zlo' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    const ids1 = res1.body.data.map((x: any) => x.id);
    expect(ids1).toContain(topicSeed_intro.id);

    // filter by subjectId
    const res2 = await request(app.getHttpServer())
      .get('/topics')
      .query({ subjectId: subjectA_math.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(Array.isArray(res2.body.data)).toBe(true);

    // filter by subjectLevelId
    const res3 = await request(app.getHttpServer())
      .get('/topics')
      .query({ subjectLevelId: levelA_math_g5.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    const ids3 = res3.body.data.map((x: any) => x.id);
    expect(ids3).toContain(topicSeed_intro.id);
  });

  it('GET /topics → 401 bez tokenu, DIRECTOR jiné org → 200 (scoped, pravděpodobně prázdno)', async () => {
    await request(app.getHttpServer()).get('/topics').expect(401);

    const res = await request(app.getHttpServer())
      .get('/topics')
      .set('Authorization', `Bearer ${directorB.token}`)
      .expect(200); // director vidí jen svou org (orgB) → v našem seed prázdno
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ---------------------------
  // DETAIL
  // ---------------------------
  it('GET /topics/:id → SUPERADMIN vidí [200]', async () => {
    await request(app.getHttpServer())
      .get(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('GET /topics/:id → DIRECTOR stejné org [200]', async () => {
    await request(app.getHttpServer())
      .get(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  it('GET /topics/:id → DIRECTOR stejné org [200]', async () => {
    await request(app.getHttpServer())
      .get(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  it('GET /topics/:id → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('GET /topics/:id → 404 když neexistuje', async () => {
    await request(app.getHttpServer())
      .get('/topics/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  it('GET /topics/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/topics/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  // ---------------------------
  // BY SUBJECT
  // ---------------------------
  it('GET /topics/by-subject/:subjectId [200]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/topics/by-subject/${subjectA_math.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    const ids = res.body.map((x: any) => x.id);
    expect(ids).toContain(topicSeed_intro.id);
  });

  it('GET /topics/by-subject/:subjectId → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/topics/by-subject/${subjectA_math.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  // ---------------------------
  // UPDATE
  // ---------------------------
  it('PATCH /topics/:id → DIRECTOR upraví name/phase/difficulty/order [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    const res = await request(app.getHttpServer())
      .patch(`/topics/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: 'Geom – rozšířená',
        phase: TopicPhase.DEEPEN,
        difficulty: Difficulty.ADVANCED,
        order: 99,
      })
      .expect(200);

    expect(res.body.name).toBe('Geom – rozšířená');
    expect(res.body.phase).toBe(TopicPhase.DEEPEN);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('PATCH /topics/:id → 409 když by změna vedla na duplicitní (SL + CT + phase)', async () => {
    // vytvoř dočasný topic, který zkusíme přepnout na (fractions, INTRO) → kolize se seedem
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    await request(app.getHttpServer())
      .patch(`/topics/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ catalogTopicId: catTopicFractions.id, phase: TopicPhase.INTRO })
      .expect(409);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('PATCH /topics/:id → DIRECTOR v orgA může [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.EXTENSION,
    });

    await request(app.getHttpServer())
      .patch(`/topics/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ order: 5 })
      .expect(200);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('PATCH /topics/:id → 404 když neexistuje (valid UUID)', async () => {
    await request(app.getHttpServer())
      .patch('/topics/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'XY' })
      .expect(404);
  });

  it('PATCH /topics/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .patch('/topics/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ name: 'XY' })
      .expect(400);
  });

  // ---------------------------
  // DELETE
  // ---------------------------
  it('DELETE /topics/:id → DIRECTOR smaže [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    const res = await request(app.getHttpServer())
      .delete(`/topics/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.id).toBe(tmp.id);
    const check = await prisma.topicLevel.findUnique({ where: { id: tmp.id } });
    expect(check).toBeNull();

    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('DELETE /topics/:id → TEACHER jiné org → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('DELETE /topics/:id → 404 neexistuje', async () => {
    await request(app.getHttpServer())
      .delete('/topics/33333333-3333-4333-8333-333333333333')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  it('DELETE /topics/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .delete('/topics/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  // ---------------------------
  // ASSIGN MATERIALS
  // ---------------------------
  it('POST /topics/:id/materials → replaceAll=false přidá bez duplicit [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.DEEPEN,
    });

    // add matA1 + matA3_global (globální je povolen)
    let res = await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA1.id, matA3_global.id], replaceAll: false })
      .expect(201);

    expect(Array.isArray(res.body.LearningMaterial)).toBe(true);
    const ids = res.body.LearningMaterial.map((m: any) => m.id);
    expect(ids).toEqual(expect.arrayContaining([matA1.id, matA3_global.id]));

    // znovu přidáme matA1 + matA2 → matA1 se nesmí zdvojit
    res = await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA1.id, matA2.id], replaceAll: false })
      .expect(201);

    const ids2 = res.body.LearningMaterial.map((m: any) => m.id);
    expect(ids2).toEqual(
      expect.arrayContaining([matA1.id, matA2.id, matA3_global.id]),
    );

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/materials → replaceAll=true nahradí existující [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.EXTENSION,
    });

    // nejprv něco přiřadíme
    await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA1.id], replaceAll: false })
      .expect(201);

    // replaceAll → jen matA2 zůstane
    const res = await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA2.id], replaceAll: true })
      .expect(201);

    const ids = res.body.LearningMaterial.map((m: any) => m.id);
    expect(ids).toEqual([matA2.id]);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('DELETE /topics/:id/materials/:materialId → odebere přiřazení [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA1.id, matA2.id], replaceAll: true })
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/topics/${tmp.id}/materials/${matA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids = res.body.LearningMaterial.map((m: any) => m.id);
    expect(ids).toEqual([matA2.id]);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/materials → 404 když materiál(y) neexistují / mimo org', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        materialIds: ['11111111-1111-4111-8111-111111111111'],
        replaceAll: false,
      })
      .expect(404);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/materials → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .post(`/topics/${topicSeed_intro.id}/materials`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ materialIds: [matA1.id] })
      .expect(403);
  });

  // ---------------------------
  // ASSIGN TESTS
  // ---------------------------
  it('POST /topics/:id/tests → replaceAll=false přidá bez duplicit [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.DEEPEN,
    });

    let res = await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA1.id], replaceAll: false })
      .expect(201);

    let ids =
      res.body.assignments?.map?.((t: any) => t.testId) ??
      res.body.Tests?.map?.((t: any) => t.id) ??
      [];
    expect(ids).toContain(testA1.id);

    // přidáme A1 znovu + A2 (dup A1 se nesmí zdvojit)
    res = await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA1.id, testA2.id], replaceAll: false })
      .expect(201);

    ids =
      res.body.assignments?.map?.((t: any) => t.testId) ??
      res.body.Tests?.map?.((t: any) => t.id) ??
      [];
    expect(ids).toEqual(expect.arrayContaining([testA1.id, testA2.id]));

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/tests → replaceAll=true nahradí existující [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.EXTENSION,
    });

    await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA1.id], replaceAll: false })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA2.id], replaceAll: true })
      .expect(201);

    const ids =
      res.body.assignments?.map?.((t: any) => t.testId) ??
      res.body.Tests?.map?.((t: any) => t.id) ??
      [];
    expect(ids).toEqual([testA2.id]);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('DELETE /topics/:id/tests/:testId → odebere přiřazení [200]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA1.id, testA2.id], replaceAll: true })
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/topics/${tmp.id}/tests/${testA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids =
      res.body.assignments?.map?.((t: any) => t.testId) ??
      res.body.Tests?.map?.((t: any) => t.id) ??
      [];
    expect(ids).toEqual([testA2.id]);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/tests → 404 když test(y) neexistují/mimo org [404]', async () => {
    const { topic: tmp, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    await request(app.getHttpServer())
      .post(`/topics/${tmp.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        testIds: ['11111111-1111-4111-8111-111111111111'],
        replaceAll: false,
      })
      .expect(404);

    await prisma.topicLevel.delete({ where: { id: tmp.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/tests → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .post(`/topics/${topicSeed_intro.id}/tests`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ testIds: [testA1.id] })
      .expect(403);
  });

  // ---------------------------
  // CATALOG endpoints
  // ---------------------------
  it('GET /topics/catalog/subjects [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/topics/catalog/subjects')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids = res.body.map((x: any) => x.id);
    expect(ids).toEqual(expect.arrayContaining([catSubMath.id, catSubPhys.id]));
  });

  it('GET /topics/catalog/subjects/:id/topics [200]', async () => {
    const res = await request(app.getHttpServer())
      .get(`/topics/catalog/subjects/${catSubMath.id}/topics`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const topicNames = res.body.map((x: any) => x.name);
    expect(topicNames).toEqual(expect.arrayContaining(['Zlomky', 'Geometrie']));
  });

  // ---------------------------
  // RBAC – STUDENT
  // ---------------------------
  it('GET /topics → STUDENT 403', async () => {
    await request(app.getHttpServer())
      .get('/topics')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(403);
  });

  it('POST /topics → STUDENT 403', async () => {
    await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicGeometry.id,
      })
      .expect(403);
  });

  it('PATCH /topics/:id → STUDENT 403', async () => {
    await request(app.getHttpServer())
      .patch(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${studentUser.token}`)
      .send({ name: 'nope' })
      .expect(403);
  });

  it('DELETE /topics/:id → STUDENT 403', async () => {
    await request(app.getHttpServer())
      .delete(`/topics/${topicSeed_intro.id}`)
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(403);
  });

  // ---------------------------
  // EXTRA: VALIDATION (Create/Update)
  // ---------------------------
  it('POST /topics → 400 invalid enum values (phase/difficulty)', async () => {
    await request(app.getHttpServer())
      .post('/topics')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        subjectLevelId: levelA_math_g5.id,
        catalogTopicId: catTopicGeometry.id,
        // záměrně nevalidní hodnoty
        phase: 'WRONG_PHASE',
        difficulty: 'NOT_A_LEVEL',
      })
      .expect(400);
  });

  it('PATCH /topics/:id → 400 invalid enum values (phase/difficulty)', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });

    await request(app.getHttpServer())
      .patch(`/topics/${topic.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        phase: 'WRONG_PHASE',
        difficulty: 'NOT_A_LEVEL',
      })
      .expect(400);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  // ---------------------------
  // EXTRA: DELETE cascades (assignments se odstraní)
  // ---------------------------
  it('DELETE /topics/:id → smaže i material/test assignments (CASCADE) [200]', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    // přiřadíme 1 materiál + 1 test
    await request(app.getHttpServer())
      .post(`/topics/${topic.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA1.id], replaceAll: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/topics/${topic.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA1.id], replaceAll: true })
      .expect(201);

    // smažeme topic
    await request(app.getHttpServer())
      .delete(`/topics/${topic.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // assignments by měly zmizet (cascading)
    const mats = await prisma.materialAssignment.findMany({
      where: { topicLevelId: topic.id },
    });
    const testsAsg = await prisma.testAssignment.findMany({
      where: { topicLevelId: topic.id },
    });

    expect(mats.length).toBe(0);
    expect(testsAsg.length).toBe(0);

    // úklid: catalog topic
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  // ---------------------------
  // EXTRA: GET /topics advanced filters + pagination edges
  // ---------------------------
  it('GET /topics → search také funguje na vlastním name [200]', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.EXTENSION,
    });

    // nastavíme vlastní jméno a ověříme search
    await prisma.topicLevel.update({
      where: { id: topic.id },
      data: { name: 'Speciální Pojem' },
    });

    const res = await request(app.getHttpServer())
      .get('/topics')
      .query({ search: 'pojem' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids = res.body.data.map((x: any) => x.id);
    expect(ids).toContain(topic.id);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('GET /topics → kombinace subjectId + subjectLevelId + stránkování [200]', async () => {
    // vytvoříme pár témat pro stránkování
    const { topic: t1, cat: c1 } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.INTRO,
    });
    const { topic: t2, cat: c2 } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.DEEPEN,
    });

    const res = await request(app.getHttpServer())
      .get('/topics')
      .query({
        subjectId: subjectA_math.id,
        subjectLevelId: levelA_math_g5.id,
        page: 1,
        limit: 1,
      })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    // second page
    const res2 = await request(app.getHttpServer())
      .get('/topics')
      .query({
        subjectId: subjectA_math.id,
        subjectLevelId: levelA_math_g5.id,
        page: 2,
        limit: 1,
      })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(res2.body.data.length).toBe(1);

    // cleanup
    await prisma.topicLevel.deleteMany({
      where: { id: { in: [t1.id, t2.id] } },
    });
    await prisma.catalogTopic.deleteMany({
      where: { id: { in: [c1.id, c2.id] } },
    });
  });

  // ---------------------------
  // EXTRA: RBAC/UUID edge cases pro ASSIGN endpoints
  // ---------------------------
  it('POST /topics/:id/materials → DIRECTOR stejné org může přiřadit [201]', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    const res = await request(app.getHttpServer())
      .post(`/topics/${topic.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: [matA1.id], replaceAll: true })
      .expect(201);

    const ids = res.body.LearningMaterial?.map?.((m: any) => m.id) ?? [];
    expect(ids).toEqual([matA1.id]);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/materials → 400 invalid UUID v body (materialIds)', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    await request(app.getHttpServer())
      .post(`/topics/${topic.id}/materials`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ materialIds: ['not-uuid'], replaceAll: false })
      .expect(400);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('DELETE /topics/:id/materials/:materialId → 400 invalid UUID v paramu', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    await request(app.getHttpServer())
      .delete(`/topics/${topic.id}/materials/not-a-uuid`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/tests → DIRECTOR stejné org může přiřadit [201]', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    const res = await request(app.getHttpServer())
      .post(`/topics/${topic.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: [testA1.id], replaceAll: true })
      .expect(201);

    const ids =
      res.body.assignments?.map?.((t: any) => t.testId) ??
      res.body.Tests?.map?.((t: any) => t.id) ??
      [];
    expect(ids).toEqual([testA1.id]);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('POST /topics/:id/tests → 400 invalid UUID v body (testIds)', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    await request(app.getHttpServer())
      .post(`/topics/${topic.id}/tests`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ testIds: ['not-uuid'], replaceAll: false })
      .expect(400);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });

  it('DELETE /topics/:id/tests/:testId → 400 invalid UUID v paramu', async () => {
    const { topic, cat } = await makeTempTopic(prisma, {
      levelId: levelA_math_g5.id,
      catSubjectId: catSubMath.id,
      phase: TopicPhase.RECAP,
    });

    await request(app.getHttpServer())
      .delete(`/topics/${topic.id}/tests/not-a-uuid`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);

    await prisma.topicLevel.delete({ where: { id: topic.id } });
    await prisma.catalogTopic.delete({ where: { id: cat.id } });
  });
});
