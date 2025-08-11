// test/stats/stats.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  $Enums,
  OrganizationRole,
  OrganizationType,
  SubmissionStatus,
} from '@prisma/client';
import { login, register } from 'test/helpers';

describe('Stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // tokens & identities
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
  let studentA1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let studentB1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  }; // pro cross-org 403

  // orgs & memberships & ids
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };
  let mTeacherA1!: { id: string }; // Membership.id
  let mStudentA1!: { id: string };
  let mStudentB1!: { id: string };

  // tests & submissions (orgA)
  let tA1!: { id: string; title: string };
  let tA2!: { id: string; title: string };

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modRef.createNestApplication();
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

    // --- USERS ---
    const rSuper = await register(app, 'stats_super');
    await prisma.user.update({
      where: { id: rSuper.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: rSuper.user.id,
      token: await login(app, rSuper.login),
      login: rSuper.login,
    };

    const rDirA = await register(app, 'stats_dirA');
    directorA = {
      id: rDirA.user.id,
      token: rDirA.accessToken,
      login: rDirA.login,
    };

    const rTeacherA1 = await register(app, 'stats_teacherA1');
    teacherA1 = {
      id: rTeacherA1.user.id,
      token: rTeacherA1.accessToken,
      login: rTeacherA1.login,
    };

    const rStudentA1 = await register(app, 'stats_studentA1');
    studentA1 = {
      id: rStudentA1.user.id,
      token: rStudentA1.accessToken,
      login: rStudentA1.login,
    };

    const rStudentB1 = await register(app, 'stats_studentB1');
    studentB1 = {
      id: rStudentB1.user.id,
      token: rStudentB1.accessToken,
      login: rStudentB1.login,
    };

    // --- ORGS + MEMBERSHIPS ---
    orgA = await prisma.organization.create({
      data: {
        name: 'Stats Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true, name: true },
    });
    // obnov claims s orgId
    directorA.token = await login(app, directorA.login);

    orgB = await prisma.organization.create({
      data: {
        name: 'Stats Org B',
        type: OrganizationType.SCHOOL,
      },
      select: { id: true, name: true },
    });

    // teacher A1 v orgA
    mTeacherA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherA1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    // student A1 v orgA
    mStudentA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: studentA1.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    // student B1 v orgB (jiná organizace)
    mStudentB1 = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: studentB1.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    // Přiloguj učitele a studenty znovu, aby měli membershipId/organizationId v JWT (podle tvé auth implementace)
    teacherA1.token = await login(app, teacherA1.login);
    studentA1.token = await login(app, studentA1.login);
    studentB1.token = await login(app, studentB1.login);

    // --- TESTS (orgA) ---
    tA1 = await prisma.test.create({
      data: {
        organizationId: orgA.id,
        title: 'Algebra – Základy',
        creatorId: mTeacherA1.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true, title: true },
    });
    tA2 = await prisma.test.create({
      data: {
        organizationId: orgA.id,
        title: 'Geometrie – Trojúhelníky',
        creatorId: mTeacherA1.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true, title: true },
    });

    // --- SUBMISSIONS (orgA, studentA1) ---
    // tA1: 2x APPROVED (0.8, 0.9), 1x REJECTED (0.4), 1x PENDING
    await prisma.submission.createMany({
      data: [
        {
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: 0.8,
          status: SubmissionStatus.APPROVED,
        },
        {
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: 0.9,
          status: SubmissionStatus.APPROVED,
        },
        {
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: 0.4,
          status: SubmissionStatus.REJECTED,
        },
        {
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: null,
          status: SubmissionStatus.PENDING,
        },
      ],
    });
    // tA2: 1x REJECTED (0.3)
    await prisma.submission.create({
      data: {
        studentId: mStudentA1.id,
        testId: tA2.id,
        score: 0.3,
        status: SubmissionStatus.REJECTED,
      },
    });
  });

  afterAll(async () => {
    // best-effort cleanup (pořadí kvůli FK)
    await prisma.submission
      .deleteMany({
        where: {
          testId: { in: [tA1?.id, tA2?.id].filter(Boolean) as string[] },
        },
      })
      .catch(() => {});
    await prisma.test
      .deleteMany({
        where: { id: { in: [tA1?.id, tA2?.id].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    await prisma.membership
      .deleteMany({
        where: {
          id: {
            in: [mTeacherA1?.id, mStudentA1?.id, mStudentB1?.id].filter(
              Boolean,
            ) as string[],
          },
        },
      })
      .catch(() => {});
    await prisma.organization
      .deleteMany({
        where: { id: { in: [orgA?.id, orgB?.id].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    // refresh tokens + users
    await prisma.refreshToken
      .deleteMany({
        where: {
          userId: {
            in: [
              superUser.id,
              directorA.id,
              teacherA1.id,
              studentA1.id,
              studentB1.id,
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
              teacherA1.id,
              studentA1.id,
              studentB1.id,
            ],
          },
        },
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  // ------------------------------------------
  // /stats/overview (evaluated default)
  // ------------------------------------------
  it('GET /stats/overview → DIRECTOR (default evaluated) [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.scope).toBe('evaluated');
    expect(res.body.totalTests).toBe(2); // tA1, tA2
    // evaluated submissions: APPROVED (2) + REJECTED (2) = 4
    expect(res.body.totalSubmissions).toBe(4);
    // pending count: 1
    expect(res.body.pendingSubmissions).toBe(1);
    // passRate: 2/4 = 0.5
    expect(res.body.passRate).toBeCloseTo(0.5, 5);
    // avgScore: průměr jen ze score != null (0.8,0.9,0.4,0.3) = 2.4 / 4 = 0.6
    expect(res.body.avgScore).toBeCloseTo(0.6, 5);
  });

  it('GET /stats/overview?scope=all → DIRECTOR [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .query({ scope: 'all' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.scope).toBe('all');
    // all submissions: 5 (včetně pending)
    expect(res.body.totalSubmissions).toBe(5);
    // passRate: approved/all = 2/5 = 0.4
    expect(res.body.passRate).toBeCloseTo(0.4, 5);
    // pending: 1
    expect(res.body.pendingSubmissions).toBe(1);
  });

  it('GET /stats/overview → TEACHER má přístup [200]', async () => {
    await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);
  });

  it('GET /stats/overview → STUDENT nemá přístup [403]', async () => {
    await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${studentA1.token}`)
      .expect(403);
  });

  it('GET /stats/overview → SUPERADMIN (globální agregace) [200]', async () => {
    await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  // ------------------------------------------
  // /dashboards/student
  // ------------------------------------------
  it('GET /dashboards/student → STUDENT vidí vlastní dashboard [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${studentA1.token}`)
      .expect(200);

    expect(res.body?.member?.id).toBeTruthy();
    expect(typeof res.body.testsTaken).toBe('number');
    expect(res.body.lastSubmissions).toBeInstanceOf(Array);
    // byTest musí obsahovat oba testy (tA1, tA2) – víme, že má alespoň 1 submission k oběma
    const testIds = (res.body.byTest ?? []).map((x: any) => x.testId);
    expect(testIds).toEqual(expect.arrayContaining([tA1.id, tA2.id]));
  });

  it('GET /dashboards/student → student z jiné organizace dostane svůj dashboard (200) a nevidí testy orgA', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${studentB1.token}`)
      .expect(200);

    expect(res.body?.member?.id).toBeTruthy();
    // studentB1 je v orgB → byTest by nemělo obsahovat testy z orgA
    const byTestIds: string[] = (res.body.byTest ?? []).map(
      (x: any) => x.testId,
    );
    expect(byTestIds).not.toEqual(expect.arrayContaining([tA1.id, tA2.id]));
  });

  // ------------------------------------------
  // /dashboards/teacher
  // ------------------------------------------
  it('GET /dashboards/teacher → TEACHER vidí vlastní dashboard [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboards/teacher')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);

    // učitel vytvořil 2 testy
    expect(res.body.testsCreated).toBe(2);

    // submissions na jeho testy: 5 celkem, z toho 1 pending
    expect(res.body.pendingSubmissions).toBe(1);

    // průměr score na jeho testy: (0.8 + 0.9 + 0.4 + 0.3) / 4 = 0.6
    expect(res.body.avgScoreOnMyTests).toBeCloseTo(0.6, 5);

    // recentActivity je pole odevzdání
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
    expect(res.body.recentActivity.length).toBeGreaterThan(0);
    // musí obsahovat testTitle
    expect(res.body.recentActivity[0]).toHaveProperty('testTitle');
  });

  it('GET /dashboards/teacher → DIRECTOR má přístup [200]', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/teacher')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  it('GET /dashboards/teacher → STUDENT 403', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/teacher')
      .set('Authorization', `Bearer ${studentA1.token}`)
      .expect(403);
  });

  it('GET /dashboards/student → byTest má korektní latest & best a avgScore ignoruje null', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${studentA1.token}`)
      .expect(200);

    const byTest = res.body.byTest as Array<{
      testId: string;
      latest: any;
      best: any;
    }>;
    expect(Array.isArray(byTest)).toBe(true);

    const t1 = byTest.find((x) => x.testId === tA1.id);
    const t2 = byTest.find((x) => x.testId === tA2.id);
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();

    // pro tA1 jsme vytvořili: APPROVED (0.8), APPROVED (0.9), REJECTED (0.4), PENDING (null)
    // best.score = 0.9
    expect(t1!.best?.score).toBeCloseTo(0.9, 5);

    // latest = nejnovější submission pro test (řazení DESC by submittedAt) – u nás je to poslední z createMany
    expect(t1!.latest).toBeTruthy();
    // score latest může být null (PENDING) – otestujeme, že latest je jeden z našich 4 a má testId tA1
    expect(t1!.latest.testId).toBe(tA1.id);

    // avgScore by mělo být (0.8+0.9+0.4+0.3)/4 = 0.6 (null *ignorováno*)
    expect(res.body.avgScore).toBeCloseTo(0.6, 5);
  });

  it('GET /dashboards/student → student v orgB nemá byTest položky z orgA', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${studentB1.token}`)
      .expect(200);

    const byTestIds: string[] = (res.body.byTest ?? []).map(
      (x: any) => x.testId,
    );
    expect(byTestIds).toEqual(expect.not.arrayContaining([tA1.id, tA2.id]));
    // zároveň se ujistíme, že testsTaken je 0 (pro orgB jsme nezaseli submissions)
    expect(res.body.testsTaken).toBe(0);
  });

  it('GET /stats/overview → SUPERADMIN globální agregace odpovídá připraveným datům [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    // v testu jsme připravili submissions jen v orgA: total 5, evaluated 4, approved 2, pending 1
    // default scope = evaluated
    expect(res.body.scope).toBe('evaluated');
    expect(res.body.totalTests).toBeGreaterThanOrEqual(2);
    expect(res.body.totalSubmissions).toBe(4);
    expect(res.body.pendingSubmissions).toBe(1);
    expect(res.body.passRate).toBeCloseTo(0.5, 5);
    expect(res.body.avgScore).toBeCloseTo(0.6, 5);
  });

  it('GET /dashboards/teacher → neuvidí testy kolegy (počítá jen testy, které sám vytvořil)', async () => {
    // založ kolegu v orgA a jeho test
    const rTeacherA2 = await register(app, 'stats_teacherA2');
    const teacherA2 = {
      id: rTeacherA2.user.id,
      login: rTeacherA2.login,
      token: rTeacherA2.accessToken,
    };
    const mTeacherA2 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherA2.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    teacherA2.token = await login(app, teacherA2.login);

    const tOther = await prisma.test.create({
      data: {
        organizationId: orgA.id,
        title: 'Kolega – Test',
        creatorId: mTeacherA2.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .get('/dashboards/teacher')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);

    // TeacherA1 měl 2 vlastní testy; přítomnost cizího testu nesmí číslo navýšit
    expect(res.body.testsCreated).toBe(2);

    // úklid
    await prisma.test.delete({ where: { id: tOther.id } }).catch(() => {});
    await prisma.membership
      .delete({ where: { id: mTeacherA2.id } })
      .catch(() => {});
    await prisma.refreshToken
      .deleteMany({ where: { userId: teacherA2.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: teacherA2.id } }).catch(() => {});
  });

  it('GET /dashboards/student → uživatel bez membershipu v org vrací 403', async () => {
    // vytvoř usera bez membershipu v orgA
    const rLonely = await register(app, 'stats_lonely');
    const lonely = {
      id: rLonely.user.id,
      login: rLonely.login,
      token: rLonely.accessToken,
    };

    // Nemá žádný membership → jeho JWT pravděpodobně nemá orgId; očekáváme 403
    await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${lonely.token}`)
      .expect(403);

    await prisma.refreshToken
      .deleteMany({ where: { userId: lonely.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: lonely.id } }).catch(() => {});
  });

  it('GET /stats/overview?scope=all → počítá approved/all a pending sedí [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .query({ scope: 'all' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.scope).toBe('all');
    expect(res.body.totalSubmissions).toBe(5);
    expect(res.body.pendingSubmissions).toBe(1);
    expect(res.body.passRate).toBeCloseTo(0.4, 5); // 2/5
  });

  it('GET /stats/overview?scope=blabla → sanitizace na evaluated [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .query({ scope: 'blabla' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.scope).toBe('evaluated');
    expect(res.body.passRate).toBeCloseTo(0.5, 5); // pořád 2/4
  });

  it('GET /stats/overview (prázdná org) → zeros & nulls [200]', async () => {
    const rDirEmpty = await register(app, 'stats_dirEmpty');
    const dirEmpty = {
      id: rDirEmpty.user.id,
      login: rDirEmpty.login,
      token: rDirEmpty.accessToken,
    };
    const emptyOrg = await prisma.organization.create({
      data: {
        name: 'Stats Org EMPTY',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: dirEmpty.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true },
    });
    dirEmpty.token = await login(app, dirEmpty.login);

    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${dirEmpty.token}`)
      .expect(200);

    expect(res.body.totalTests).toBe(0);
    expect(res.body.totalSubmissions).toBe(0);
    expect(res.body.pendingSubmissions).toBe(0);
    expect(res.body.passRate).toBe(0);
    expect(res.body.avgScore).toBeNull();

    // cleanup
    await prisma.membership
      .deleteMany({ where: { organizationId: emptyOrg.id } })
      .catch(() => {});
    await prisma.organization
      .delete({ where: { id: emptyOrg.id } })
      .catch(() => {});
    await prisma.refreshToken
      .deleteMany({ where: { userId: dirEmpty.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: dirEmpty.id } }).catch(() => {});
  });

  it('GET /dashboards/student → lastSubmissions má max 5 a je řazeno desc', async () => {
    // přidej více submissionů pro studentA1/tA1
    await prisma.submission.createMany({
      data: Array.from({ length: 6 }).map((_, i) => ({
        studentId: mStudentA1.id,
        testId: tA1.id,
        score: 0.5,
        status: SubmissionStatus.APPROVED,
        submittedAt: new Date(Date.now() + i * 1000),
      })),
    });

    const res = await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${studentA1.token}`)
      .expect(200);

    const ls = res.body.lastSubmissions as Array<{ submittedAt: string }>;
    expect(ls.length).toBeLessThanOrEqual(5);
    const times = ls.map((x) => new Date(x.submittedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a)); // desc
  });

  it('GET /stats/overview → po nové APPROVED submission se passRate hned změní [200]', async () => {
    // warmup
    const first = await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(first.body.passRate).toBeCloseTo(0.5, 5);

    // přidej APPROVED do orgA → evaluated +1 approved, +1 total
    await prisma.submission.create({
      data: {
        studentId: mStudentA1.id,
        testId: tA2.id,
        score: 0.95,
        status: SubmissionStatus.APPROVED,
      },
    });

    const second = await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // původně 2/4 = 0.5 → nově 3/5 = 0.6
    expect(second.body.passRate).toBeCloseTo(0.6, 5);
  });
});
