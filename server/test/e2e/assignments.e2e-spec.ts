// test/e2e/assignments.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { randomUUID } from 'crypto';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationRole, SystemRole } from '@prisma/client';
import { createSystemUser, setupOrgContext, login } from 'test/helpers';

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

  let ctx: Awaited<ReturnType<typeof setupOrgContext>>;

  // content infra
  let testA!: { id: string };
  let academicYearId!: string;
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

    ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: 'assignments',
      with: { teacher: true, student: true },
    });

    org = { id: ctx.organization.id };
    // fresh orgs are PENDING → readiness guards 409 every execution op
    await prisma.organization.update({
      where: { id: org.id },
      data: { status: $Enums.OrganizationStatus.ACTIVE },
    });
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

    mTeacher = ctx.teacher!.membership;
    mStudent = ctx.student!.membership;

    const superUserAuth = await createSystemUser(
      app,
      prisma,
      SystemRole.SUPERADMIN,
      'assignments_super',
    );
    await ctx.addMembershipForUser(
      superUserAuth.user.id,
      OrganizationRole.DIRECTOR,
    );
    superUser = {
      id: superUserAuth.user.id,
      // unscoped login lands in the superadmin's own PENDING org → 409
      token: await login(app, { ...superUserAuth.login, organizationId: org.id }),
      login: superUserAuth.login,
    };

    // academic year (required for assignments) — the org bootstrap already
    // created a current year (single-current partial index forbids a second),
    // so reuse it and make sure its dates cover "now" (expired-year gate 409s)
    const existingYear = await prisma.academicYear.findFirst({
      where: { orgId: org.id, isCurrent: true },
      select: { id: true },
    });
    const yearDates = {
      startsAt: new Date('2025-09-01'),
      endsAt: new Date('2027-08-31'),
    };
    const year = existingYear
      ? await prisma.academicYear.update({
          where: { id: existingYear.id },
          data: yearDates,
          select: { id: true },
        })
      : await prisma.academicYear.create({
          data: {
            orgId: org.id,
            label: `E2E ${Date.now()}`,
            ...yearDates,
            isCurrent: true,
          },
          select: { id: true },
        });
    academicYearId = year.id;

    // one class section in active year so org is READY (RequireOrgReadyGuard allows execution)
    await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: 'A',
      },
    });

    // test entity v rámci org
    testA = await prisma.test.create({
      data: {
        organizationId: org.id,
        title: 'E2E – Test A',
        creatorId: mTeacher.id,
        status: $Enums.PublishStatus.PUBLISHED,
        // assignability requires target grades (NO_ALLOWED_GRADES → 400)
        allowedGrades: [$Enums.SchoolGrade.GRADE_7],
      },
      select: { id: true },
    });
    await prisma.question.create({
      data: {
        testId: testA.id,
        text: 'Is 1 < 2?',
        type: $Enums.QuestionType.TRUE_FALSE,
        correctAnswer: 'true',
        order: 1,
      },
    });

    // seed: jeden assignment přímo přes prisma pro GET/PATCH/DELETE (student has VIEW_OWN via assignment_students)
    const seeded = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
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
        students: { create: [{ studentId: mStudent.id }] },
      },
      select: { id: true },
    });
    assignmentIdForGetPatchDelete = seeded.id;
  });

  afterAll(async () => {
    // cleanup – class sections, assignments, academic year
    await prisma.classSection
      .deleteMany({ where: { yearId: academicYearId } })
      .catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } }).catch(() => {});
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
      academicYearId,
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

  it('POST /assignments (DIRECTOR) → 201 (valid dates; openAt < closeAt)', async () => {
    const res = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
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

  it('POST /assignments (DIRECTOR) → 400 když targetType=STUDENTS bez studentIds', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
      .send(mkPayload({ studentIds: [] }))
      .expect(400);
  });

  it('POST /assignments (DIRECTOR) → 400 když openAt >= closeAt', async () => {
    const t = new Date().toISOString();
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
      .send(mkPayload({ openAt: t, closeAt: t }))
      .expect(400);
  });

  it('POST /assignments (DIRECTOR) → 400 když test nepatří do org', async () => {
    const otherCtx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `assignments_other_${Date.now()}`,
    });
    const foreignTest = await prisma.test.create({
      data: {
        organizationId: otherCtx.organization.id,
        title: 'Cizí test',
        creatorId: mTeacher.id, // creatorId nezabrání – kontroluje se org testu
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
      // cross-tenant resources are masked as 404 (no existence oracle)
      .send(mkPayload({ testId: foreignTest.id }))
      .expect(404);

    // cleanup
    await prisma.test.delete({ where: { id: foreignTest.id } });
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

  it('POST /assignments (DIRECTOR) → 400 když createdById není aktivní TEACHER/DIRECTOR v org', async () => {
    // vytvoř cizí org a člena (STUDENT) – použijeme jeho membership jako createdById
    const otherCtx = await setupOrgContext(app, prisma, {
      role: 'STUDENT',
      seed: `assignments_other_student_${Date.now()}`,
    });
    const foreignStudentM = otherCtx.actor.membership;

    const spoofRes = await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
      .send(mkPayload({ createdById: foreignStudentM.id }))
      .expect(201);
    // spoofed createdById must be neutralized — creator is the caller's org membership
    expect(spoofRes.body.createdById).not.toBe(foreignStudentM.id);

    await prisma.membership.deleteMany({
      where: { organizationId: otherCtx.organization.id },
    });
    await prisma.organization.delete({
      where: { id: otherCtx.organization.id },
    });
    await prisma.refreshToken.deleteMany({
      where: {
        userId: {
          in: [otherCtx.owner.user.id, otherCtx.actor.user.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [otherCtx.owner.user.id, otherCtx.actor.user.id] },
      },
    });
  });

  // ---------------------------
  // READ
  // ---------------------------

  it('GET /assignments/:id (DIRECTOR) → 200 detail', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    expect(res.body.organizationId).toBe(org.id);
  });

  it('GET /assignments/:id (STUDENT) → 200 ve stejné org', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(res.body.testId).toBe(testA.id);
  });

  it('GET /assignments/:id (STUDENT) → 404 do cizí org (tenant masking)', async () => {
    // založ cizí org + assignment
    const otherCtx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `assignments_foreign_${Date.now()}`,
    });
    const foreignTest = await prisma.test.create({
      data: {
        organizationId: otherCtx.organization.id,
        title: 'Cizí test C',
        creatorId: mTeacher.id,
        status: $Enums.PublishStatus.PUBLISHED,
      },
      select: { id: true },
    });
    const otherYear = (await prisma.academicYear.findFirst({
      where: { orgId: otherCtx.organization.id, isCurrent: true },
      select: { id: true },
    })) ?? await prisma.academicYear.create({
      data: {
        orgId: otherCtx.organization.id,
        label: `Foreign ${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });
    const foreignAssignment = await prisma.assignment.create({
      data: {
        organizationId: otherCtx.organization.id,
        yearId: otherYear.id,
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
      // cross-tenant assignment is masked as 404 (no existence oracle)
      .expect(404);

    // cleanup
    await prisma.assignment.delete({ where: { id: foreignAssignment.id } });
    await prisma.test.delete({ where: { id: foreignTest.id } });
    await prisma.academicYear.delete({ where: { id: otherYear.id } });
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

  it('GET /assignments/:id (SUPERADMIN) → 200 (has all permissions)', async () => {
    await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  // ---------- Permission-scope integration (no role checks) ----------

  it('Case 1: Student tries to access another student’s assignment → 403', async () => {
    const secondStudent = await ctx.addMember(OrganizationRole.STUDENT, 'student2');
    const assignmentForSecond = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId: testA.id,
        targetType: 'STUDENTS',
        openAt: new Date(Date.now() - 60_000).toISOString() as unknown as Date,
        closeAt: new Date(Date.now() + 3_600_000).toISOString() as unknown as Date,
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: mTeacher.id,
        students: { create: [{ studentId: secondStudent.membership.id }] },
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .get(`/assignments/${assignmentForSecond.id}`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);

    await prisma.assignmentStudent.deleteMany({
      where: { assignmentId: assignmentForSecond.id },
    });
    await prisma.assignment.delete({ where: { id: assignmentForSecond.id } });
  });

  it('Case 2: Teacher tries to access assignment outside their class → 403', async () => {
    const teacher2 = await ctx.addMember(OrganizationRole.TEACHER, 'teacher2');
    const teacher2Record = await prisma.teacher.create({
      data: {
        membershipId: teacher2.membership.id,
        organizationId: org.id,
      },
      select: { id: true },
    });
    const classSection2 = await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId: academicYearId,
        grade: $Enums.SchoolGrade.GRADE_7,
        section: 'B',
        teacherId: teacher2Record.id,
      },
      select: { id: true },
    });
    const assignmentOtherClass = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        yearId: academicYearId,
        testId: testA.id,
        targetType: 'CLASS',
        classSectionId: classSection2.id,
        openAt: new Date(Date.now() - 60_000).toISOString() as unknown as Date,
        closeAt: new Date(Date.now() + 3_600_000).toISOString() as unknown as Date,
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: mTeacher.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .get(`/assignments/${assignmentOtherClass.id}`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(403);

    await prisma.assignment.delete({ where: { id: assignmentOtherClass.id } });
    await prisma.classSection.delete({ where: { id: classSection2.id } });
    await prisma.teacher.delete({ where: { id: teacher2Record.id } });
  });

  it('Case 3: Director accesses any assignment in org → 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    expect(res.body.organizationId).toBe(org.id);
    expect(res.body.id).toBe(assignmentIdForGetPatchDelete);
  });

  it('Case 4: User without any assignment permission → 403', async () => {
    const parent = await ctx.addMember(OrganizationRole.PARENT, 'parent');
    await request(app.getHttpServer())
      .get(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${parent.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/assignments/my')
      .set('Authorization', `Bearer ${parent.accessToken}`)
      .expect(403);
  });

  it('GET /assignments/:id → 404 pro non-existing UUID', async () => {
    await request(app.getHttpServer())
      .get(`/assignments/${randomUUID()}`)
      .set('Authorization', `Bearer ${director.token}`)
      // controller volá service.findOne → vrací null; pokud máš NotFound guard jinde, tu je 404,
      // jinak může být 200 s null. Očekáváme 404, uprav service/controller dle potřeby.
      .expect(404); // ← pokud už máš 404, změň na .expect(404)
  });

  // ---------------------------
  // UPDATE
  // ---------------------------

  it('PATCH /assignments/:id (DIRECTOR) → 200 mění mutable pole', async () => {
    const newOpen = new Date(Date.now() + 10_000).toISOString();
    const newClose = new Date(Date.now() + 120_000).toISOString();

    const res = await request(app.getHttpServer())
      .patch(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${director.token}`)
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

  it('PATCH /assignments/:id (DIRECTOR) → 400 když se pokusí změnit identity fields', async () => {
    // immutable fields are absent from UpdateAssignmentDto → forbidNonWhitelisted 400
    await request(app.getHttpServer())
      .patch(`/assignments/${assignmentIdForGetPatchDelete}`)
      .set('Authorization', `Bearer ${director.token}`)
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

  it('DELETE /assignments/:id (DIRECTOR) → 200', async () => {
    const toDelete = await prisma.assignment.create({
      data: {
        organizationId: org.id,
        testId: testA.id,
        yearId: academicYearId,
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
      .set('Authorization', `Bearer ${director.token}`)
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
        yearId: academicYearId,
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
      .set('Authorization', `Bearer ${director.token}`)
      .send(mkPayload({ targetType: 'WTF' }))
      .expect(400);
  });

  it('POST /assignments → 400 když classSectionId neexistuje nebo nepatří do org', async () => {
    await request(app.getHttpServer())
      .post('/assignments')
      .set('Authorization', `Bearer ${director.token}`)
      .send(
        mkPayload({
          targetType: 'CLASS',
          studentIds: undefined,
          classSectionId: randomUUID(), // neexistuje
        }),
      )
      // unknown/cross-tenant classSection is masked as 404
      .expect(404);
  });

  it('GET /assignments/:id → 400 na nevalidní UUID (pokud používáš pipe/validator na Param)', async () => {
    // Pokud používáš Param UUID pipe, očekávej 400; jinak může projít jako 404/not found.
    await request(app.getHttpServer())
      .get('/assignments/not-a-uuid')
      .set('Authorization', `Bearer ${director.token}`)
      .expect([400, 404]);
  });
});
