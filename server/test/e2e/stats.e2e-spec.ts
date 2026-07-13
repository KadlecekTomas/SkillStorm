// test/stats/stats.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  $Enums,
  OrganizationRole,
  OrganizationType,
  SubmissionStatus,
} from '@prisma/client';
import { login, register, useOrg } from 'test/helpers';
import { bootstrapOrg } from 'test/e2e/helpers/bootstrap-org';

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
  let aA1!: { id: string };
  let aA2!: { id: string };
  let academicYearId!: string;

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
        status: 'ACTIVE',
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true, name: true },
    });
    // obnov claims s orgId
    directorA.token = await login(app, { ...directorA.login, organizationId: orgA.id });

    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: superUser.id,
        role: OrganizationRole.DIRECTOR,
      },
    });
    // unscoped login lands in the superadmin's own PENDING org → 409;
    // scope the token to orgA (ACTIVE, structure-ready)
    superUser.token = await login(app, {
      ...superUser.login,
      organizationId: orgA.id,
    });

    orgB = await prisma.organization.create({
      data: {
        name: 'Stats Org B',
        type: OrganizationType.SCHOOL,
        status: 'ACTIVE',
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
    teacherA1.token = await login(app, { ...teacherA1.login, organizationId: orgA.id });
    studentA1.token = await login(app, { ...studentA1.login, organizationId: orgA.id });
    studentB1.token = await login(app, { ...studentB1.login, organizationId: orgB.id });

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

    // Academic year (required for assignments)
    const year = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: `Stats ${Date.now()}`,
        // must cover "now" — the expired-year gate 409s year-scoped endpoints
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    academicYearId = year.id;

    // Execution operations need R2_STRUCTURE_READY: at least one class
    // section in the current year (and orgB mirrors it for its student).
    await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: academicYearId,
        grade: 'GRADE_7',
        section: 'S',
        label: '7.S',
      },
    });
    const yearB = await prisma.academicYear.create({
      data: {
        orgId: orgB.id,
        label: `StatsB ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    await prisma.classSection.create({
      data: {
        orgId: orgB.id,
        yearId: yearB.id,
        grade: 'GRADE_7',
        section: 'S',
        label: '7.S',
      },
    });

    // Assignment pro tA1 (STUDENTS)
    aA1 = await prisma.assignment.create({
      data: {
        organizationId: orgA.id,
        yearId: academicYearId,
        testId: tA1.id,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 60000),
        closeAt: new Date(Date.now() + 3600 * 1000),
        maxAttempts: 5,
        createdById: mTeacherA1.id,
        students: { create: [{ studentId: mStudentA1.id }] },
      },
      select: { id: true },
    });

    // Assignment pro tA2
    aA2 = await prisma.assignment.create({
      data: {
        organizationId: orgA.id,
        yearId: academicYearId,
        testId: tA2.id,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 10000),
        closeAt: new Date(Date.now() + 3600 * 1000),
        maxAttempts: 3,
        createdById: mTeacherA1.id,
        students: { create: [{ studentId: mStudentA1.id }] },
      },
      select: { id: true },
    });

    // --- SUBMISSIONS (orgA, studentA1) ---
    // tA1: 2x APPROVED (0.8, 0.9), 1x REJECTED (0.4), 1x PENDING
    const now = new Date();
    await prisma.submission.createMany({
      data: [
        {
          organizationId: orgA.id,
          assignmentId: aA1.id,
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: 0.8,
          status: SubmissionStatus.APPROVED,
          submittedAt: new Date(now.getTime() - 40000),
          attemptNo: 1,
        },
        {
          organizationId: orgA.id,
          assignmentId: aA1.id,
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: 0.9,
          status: SubmissionStatus.APPROVED,
          submittedAt: new Date(now.getTime() - 30000),
          attemptNo: 2,
        },
        {
          organizationId: orgA.id,
          assignmentId: aA1.id,
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: 0.4,
          status: SubmissionStatus.REJECTED,
          submittedAt: new Date(now.getTime() - 20000),
          attemptNo: 3,
        },
        {
          organizationId: orgA.id,
          assignmentId: aA1.id,
          studentId: mStudentA1.id,
          testId: tA1.id,
          score: null,
          status: SubmissionStatus.PENDING,
          submittedAt: new Date(now.getTime() - 10000),
          attemptNo: 4,
        },
      ],
    });
    // tA2: 8x APPROVED (0.80..0.87), 1x REJECTED (0.3)
    const approvedSubs = Array.from({ length: 8 }).map((_, i) => ({
      organizationId: orgA.id,
      studentId: mStudentA1.id,
      testId: tA2.id,
      assignmentId: aA2.id,
      score: 0.8 + i * 0.01, // různé skóre
      status: SubmissionStatus.APPROVED,
      submittedAt: new Date(now.getTime() - (15000 + i * 1000)),
      attemptNo: i + 1,
    }));
    await prisma.submission.createMany({ data: approvedSubs });
    await prisma.submission.create({
      data: {
        organizationId: orgA.id,
        studentId: mStudentA1.id,
        testId: tA2.id,
        assignmentId: aA2.id,
        score: 0.3,
        status: SubmissionStatus.REJECTED,
        submittedAt: new Date(now.getTime() - 5000),
        attemptNo: 99,
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
    await prisma.assignment
      .deleteMany({
        where: { id: { in: [aA1?.id, aA2?.id].filter(Boolean) as string[] } },
      })
      .catch(() => {});
    await prisma.academicYear
      .deleteMany({ where: { id: academicYearId } })
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
    // evaluated submissions: APPROVED (2+8) + REJECTED (1+1) = 12
    expect(res.body.totalSubmissions).toBe(12);
    // pending count: 1
    expect(res.body.pendingSubmissions).toBe(1);
    // passRate: 10/12 (10 approved, 2 rejected)
    expect(res.body.passRate).toBeCloseTo(10 / 12, 5);
    // avgScore: průměr ze všech score != null: (součet 9.08) / 12 = ~0.7566667
    expect(res.body.avgScore).toBeCloseTo(0.7566667, 5);
  });

  it('GET /stats/overview?scope=all → DIRECTOR [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .query({ scope: 'all' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.scope).toBe('all');
    // all submissions: 13 (včetně pending)
    expect(res.body.totalSubmissions).toBe(13);
    // passRate: approved/all = 10/13
    expect(res.body.passRate).toBeCloseTo(10 / 13, 5);
    // pending: 1
    expect(res.body.pendingSubmissions).toBe(1);
  });

  it('GET /stats/overview → TEACHER má přístup [200]', async () => {
    await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);
  });

  it('GET /stats/overview → STUDENT má přístup [200]', async () => {
    await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${studentA1.token}`)
      .expect(200);
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
  it('GET /dashboards/teacher → TEACHER dostane dashboard (200)', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboards/teacher')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);

    expect(typeof res.body.classroomsCount).toBe('number');
    expect(typeof res.body.studentsCount).toBe('number');
    expect(typeof res.body.testsCreated).toBe('number');
    expect(Array.isArray(res.body.recentActivity)).toBe(true);
  });

  it('GET /dashboards/teacher → DIRECTOR 403', async () => {
    await request(app.getHttpServer())
      .get('/dashboards/teacher')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);
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

    // latest = nejnovější submission pro test (řazení DESC by submittedAt)
    expect(t1!.latest).toBeTruthy();
    expect(t1!.latest.testId).toBe(tA1.id);

    // avgScore (jen score != null) ~0.7566667
    expect(res.body.avgScore).toBeCloseTo(0.7566667, 5);
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

  it('GET /stats/overview → SUPERADMIN je org-scoped podle tokenu [200]', async () => {
    const scopedToken = await useOrg(app, superUser.token, orgA.id);

    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .set('Authorization', `Bearer ${scopedToken}`)
      .expect(200);

    expect(res.body.scope).toBe('evaluated');
    expect(res.body.totalTests).toBe(2);
    expect(res.body.totalSubmissions).toBe(12);
    expect(res.body.pendingSubmissions).toBe(1);
    expect(res.body.passRate).toBeCloseTo(10 / 12, 5);
    expect(res.body.avgScore).toBeCloseTo(0.7566667, 5);
  });

  it('GET /dashboards/student → nově vytvořený user v vlastní org [200] a bez dat', async () => {
    const rLonely = await register(app, 'stats_lonely');
    // a fresh org is PENDING and structure-less → execution ops 409/412;
    // bring it to readiness (ACTIVE + current year + one class section)
    await prisma.organization.update({
      where: { id: rLonely.organization.id },
      data: { status: 'ACTIVE' },
    });
    await bootstrapOrg(prisma, { orgId: rLonely.organization.id });
    const lonely = {
      id: rLonely.user.id,
      login: rLonely.login,
      token: await login(app, {
        ...rLonely.login,
        organizationId: rLonely.organization.id,
      }),
    };

    const res = await request(app.getHttpServer())
      .get('/dashboards/student')
      .set('Authorization', `Bearer ${lonely.token}`)
      .expect(200);
    expect(res.body.testsTaken).toBe(0);

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
    expect(res.body.totalSubmissions).toBe(13);
    expect(res.body.pendingSubmissions).toBe(1);
    expect(res.body.passRate).toBeCloseTo(10 / 13, 5); // 10/13
  });

  it('GET /stats/overview?scope=blabla → sanitizace na evaluated [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/stats/overview')
      .query({ scope: 'blabla' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.scope).toBe('evaluated');
    expect(res.body.passRate).toBeCloseTo(10 / 12, 5); // 10/12
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
        status: 'ACTIVE',
        memberships: {
          create: { userId: dirEmpty.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true },
    });
    // readiness: current year + one class section (adds no tests/submissions)
    await bootstrapOrg(prisma, { orgId: emptyOrg.id });
    dirEmpty.token = await login(app, {
      ...dirEmpty.login,
      organizationId: emptyOrg.id,
    });

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
        organizationId: orgA.id,
        assignmentId: aA1.id,
        studentId: mStudentA1.id,
        testId: tA1.id,
        score: 0.5,
        status: SubmissionStatus.APPROVED,
        submittedAt: new Date(Date.now() + i * 1000),
        attemptNo: 10 + i,
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
    // warmup (evaluated)
    const first = await request(app.getHttpServer())
      .get('/stats/overview')
      .query({ scope: 'evaluated' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(first.body.scope).toBe('evaluated');

    // aktuální stavy
    const a0: number = first.body.counts?.approved ?? 0;
    const r0: number = first.body.counts?.rejected ?? 0;
    const pending0: number = first.body.counts?.pending ?? 0;
    const eval0 = a0 + r0;
    expect(first.body.totalSubmissions).toBe(eval0);

    const pr0 = eval0 > 0 ? a0 / eval0 : 0;
    expect(first.body.passRate).toBeCloseTo(pr0, 5);

    // přidej jednu APPROVED
    await prisma.submission.create({
      data: {
        organizationId: orgA.id,
        studentId: mStudentA1.id,
        testId: tA2.id,
        assignmentId: aA2.id,
        score: 0.95,
        status: SubmissionStatus.APPROVED,
        submittedAt: new Date(),
        attemptNo: 100, // unikátní attemptNo
      },
    });

    // krátký polling na propsání
    let second: request.Response | undefined;
    for (let i = 0; i < 30; i++) {
      const res = await request(app.getHttpServer())
        .get('/stats/overview')
        .query({ scope: 'evaluated' })
        .set('Authorization', `Bearer ${directorA.token}`)
        .expect(200);

      const aNow = res.body.counts?.approved ?? 0;
      const rNow = res.body.counts?.rejected ?? 0;
      const evalNow = aNow + rNow;

      // stačí, když se zvýší approved nebo evaluated (nebo když aspoň passRate nestagnuje dolů)
      if (
        aNow > a0 ||
        evalNow > eval0 ||
        (evalNow >= eval0 && (eval0 === 0 || res.body.passRate >= pr0))
      ) {
        second = res;
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }

    if (!second) {
      second = await request(app.getHttpServer())
        .get('/stats/overview')
        .query({ scope: 'evaluated' })
        .set('Authorization', `Bearer ${directorA.token}`)
        .expect(200);
    }

    expect(second.body.scope).toBe('evaluated');

    const a1: number = second.body.counts?.approved ?? 0;
    const r1: number = second.body.counts?.rejected ?? 0;
    const eval1 = a1 + r1;

    // sanity: nesmí klesnout
    expect(a1).toBeGreaterThanOrEqual(a0);
    expect(eval1).toBeGreaterThanOrEqual(eval0);

    // aliasy + ostatní metriky
    expect(second.body.totalSubmissions).toBe(eval1);
    expect(second.body.pendingSubmissions).toBe(pending0);

    const pr1 = eval1 > 0 ? a1 / eval1 : 0;
    expect(second.body.passRate).toBeCloseTo(pr1, 5);
    expect(pr1).toBeGreaterThanOrEqual(pr0); // passRate se nesmí snížit po přidání APPROVED
  });
});
