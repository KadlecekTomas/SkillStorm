import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationRole, SystemRole } from '@prisma/client';
import { createSystemUser, setupOrgContext } from 'test/helpers';

describe('Memberships (e2e)', () => {
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
  let teacherB: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let plainUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  let ctxA: Awaited<ReturnType<typeof setupOrgContext>>;
  let ctxB: Awaited<ReturnType<typeof setupOrgContext>>;

  // existing memberships to mutate
  let memberA_student: { id: string }; // plainUser as STUDENT in orgA (created during tests)

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

    ctxA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: 'membershipsA',
    });
    ctxB = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: 'membershipsB',
    });

    orgA = { id: ctxA.organization.id };
    orgB = { id: ctxB.organization.id };

    directorA = {
      id: ctxA.owner.user.id,
      token: ctxA.owner.accessToken,
      login: ctxA.owner.login,
    };
    teacherB = {
      id: ctxB.actor.user.id,
      token: ctxB.actor.accessToken,
      login: ctxB.actor.login,
    };

    const plain = await ctxA.createUser('plainUser');
    plainUser = {
      id: plain.user.id,
      token: plain.accessToken,
      login: plain.login,
    };

    const superUserAuth = await createSystemUser(
      app,
      prisma,
      SystemRole.SUPERADMIN,
      'memberships_super',
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
  });

  afterAll(async () => {
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
            teacherB.id,
            plainUser.id,
            ctxB.owner.user.id,
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
            teacherB.id,
            plainUser.id,
            ctxB.owner.user.id,
          ],
        },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  // ----------------------------------------------------------------
  // CREATE (POST /memberships)
  // ----------------------------------------------------------------

  it('POST /memberships → DIRECTOR své organizace přidá člena (STUDENT) [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgA.id,
        userId: plainUser.id,
        role: OrganizationRole.STUDENT,
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.organizationId).toBe(orgA.id);
    expect(res.body.userId).toBe(plainUser.id);
    expect(res.body.role).toBe('STUDENT');

    memberA_student = { id: res.body.id };
  });

  it('POST /memberships → DIRECTOR NENÍ členem jiné org → 403 (assertSameOrganization)', async () => {
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgB.id,
        userId: plainUser.id,
        role: OrganizationRole.STUDENT,
      })
      .expect(403);
  });

  it('POST /memberships → SUPERADMIN může přidat člena do libovolné org [201]', async () => {
    const someone = await ctxB.createUser('someoneB');
    const res = await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({
        organizationId: orgB.id,
        userId: someone.user.id,
        role: OrganizationRole.STUDENT,
      })
      .expect(201);

    // cleanup that membership
    await prisma.membership.delete({ where: { id: res.body.id } });
    // also cleanup that user
    await prisma.refreshToken.deleteMany({
      where: { userId: someone.user.id },
    });
    await prisma.user.delete({ where: { id: someone.user.id } });
  });

  it('POST /memberships → TEACHER (orgB) NEMÁ oprávnění (RolesGuard) → 403', async () => {
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${teacherB.token}`)
      .send({
        organizationId: orgB.id,
        userId: plainUser.id,
        role: OrganizationRole.STUDENT,
      })
      .expect(403);
  });

  // ----------------------------------------------------------------
  // LIST (GET /memberships?organizationId=...)
  // ----------------------------------------------------------------

  it('GET /memberships?organizationId=orgA → DIRECTOR vidí členy své org [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgA.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // tolerantně – očekáváme pole nebo payload s items
    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    expect(Array.isArray(items)).toBe(true);
    // v seznamu by měl být i director a přidaný student
    const ids = items.map((m: any) => m.userId);
    expect(ids).toContain(directorA.id);
    expect(ids).toContain(plainUser.id);
  });

  it('GET /memberships?organizationId=orgB → DIRECTOR z orgA nesmí (403)', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgB.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);
  });

  it('GET /memberships bez organizationId → 400 (validation)', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  // ----------------------------------------------------------------
  // UPDATE (PATCH /memberships/:id)
  // ----------------------------------------------------------------

  it('PATCH /memberships/:id → DIRECTOR nemůže měnit ředitele (403)', async () => {
    // vytvoříme dalšího ředitele v orgA
    const other = await ctxA.addMember(OrganizationRole.DIRECTOR, 'otherDirector');
    const otherMembership = other.membership;

    await request(app.getHttpServer())
      .patch(`/memberships/${otherMembership.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(403);

    // cleanup
    await prisma.membership.delete({ where: { id: otherMembership.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: other.user.id } });
    await prisma.user.delete({ where: { id: other.user.id } });
  });

  it('PATCH /memberships/:id → DIRECTOR nemůže měnit své vlastní členství (403)', async () => {
    const selfMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: directorA.id },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .patch(`/memberships/${selfMembership.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(403);
  });

  it('PATCH /memberships/:id → DIRECTOR může povýšit STUDENTA na TEACHERA v rámci své org [200]', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/memberships/${memberA_student.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(200);

    expect(res.body.role).toBe('TEACHER');
  });

  it('PATCH /memberships/:id → DIRECTOR nemůže upravit členství v cizí org (403)', async () => {
    // vytvoř v orgB dočasné členství
    const tmpUser = await ctxB.addMember(OrganizationRole.STUDENT, 'tmpB');
    const memberB = tmpUser.membership;

    await request(app.getHttpServer())
      .patch(`/memberships/${memberB.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(403);

    // cleanup
    await prisma.membership.delete({ where: { id: memberB.id } });
    await prisma.refreshToken.deleteMany({
      where: { userId: tmpUser.user.id },
    });
    await prisma.user.delete({ where: { id: tmpUser.user.id } });
  });

  it('PATCH /memberships/:id → SUPERADMIN může měnit libovolné členství [200]', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/memberships/${memberA_student.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ role: OrganizationRole.STUDENT })
      .expect(200);

    expect(res.body.role).toBe('STUDENT');
  });

  // ----------------------------------------------------------------
  // DELETE (DELETE /memberships/:id)
  // ----------------------------------------------------------------

  it('DELETE /memberships/:id → DIRECTOR nesmí smazat ředitele (403)', async () => {
    const directorMembership = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: orgA.id,
        userId: directorA.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/memberships/${directorMembership.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);
  });

  it('DELETE /memberships/:id → DIRECTOR nesmí smazat vlastní členství (403)', async () => {
    const directorMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: directorA.id },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/memberships/${directorMembership.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);
  });

  it('DELETE /memberships/:id → DIRECTOR může smazat člena (STUDENT/TEACHER) ze své org [200]', async () => {
    const tmp = await ctxA.addMember(OrganizationRole.STUDENT, 'toRemove');
    const m = tmp.membership;

    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const gone = await prisma.membership.findUnique({ where: { id: m.id } });
    expect(gone?.deletedAt).toBeTruthy();

    // cleanup user
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('DELETE /memberships/:id → DIRECTOR nemůže mazat členství v cizí org (403)', async () => {
    const tmp = await ctxB.addMember(OrganizationRole.STUDENT, 'toRemoveB');
    const m = tmp.membership;

    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);

    // cleanup
    await prisma.membership.delete({ where: { id: m.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('DELETE /memberships/:id → SUPERADMIN může mazat kdekoliv [200]', async () => {
    const tmp = await ctxB.addMember(OrganizationRole.STUDENT, 'superRemove');
    const m = tmp.membership;

    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const gone = await prisma.membership.findUnique({ where: { id: m.id } });
    expect(gone?.deletedAt).toBeTruthy();

    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('POST /memberships → 400 invalid userId UUID', async () => {
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgA.id,
        userId: 'not-uuid',
        role: OrganizationRole.STUDENT,
      })
      .expect(400);
  });

  it('POST /memberships → 404 když user neexistuje', async () => {
    const fake = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgA.id,
        userId: fake,
        role: OrganizationRole.STUDENT,
      })
      .expect(404);
  });

  it('POST /memberships → 409 když už je user členem této organizace', async () => {
    // už máme memberA_student v orgA → pokus o duplikát
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgA.id,
        userId: plainUser.id,
        role: OrganizationRole.STUDENT,
      })
      .expect(409);
  });

  it('GET /memberships → 403 TEACHER nemá přístup k listu', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgB.id })
      .set('Authorization', `Bearer ${teacherB.token}`)
      .expect(403);
  });

  it('GET /memberships → 401 bez tokenu', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgA.id })
      .expect(401);
  });

  it('PATCH /memberships/:id → DIRECTOR nemůže měnit členství v cizí org (assertSameOrganization → 403)', async () => {
    // vytvoř člena v orgB
    const x = await ctxB.addMember(OrganizationRole.STUDENT, 'xInOrgB');
    const mb = x.membership;

    await request(app.getHttpServer())
      .patch(`/memberships/${mb.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(403);

    // cleanup
    await prisma.membership.delete({ where: { id: mb.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: x.user.id } });
    await prisma.user.delete({ where: { id: x.user.id } });
  });

  it('GET /memberships?organizationId=orgB → SUPERADMIN vidí členy libovolné org [200]', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgB.id })
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('PATCH /memberships/:id → SUPERADMIN může změnit roli ředitele [200]', async () => {
    const dirMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: directorA.id },
      select: { id: true },
    });
    const res = await request(app.getHttpServer())
      .patch(`/memberships/${dirMembership.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(200);
    expect(res.body.role).toBe('TEACHER');

    // vrať zpět (aby další testy počítaly s DIRECTORem)
    await prisma.membership.update({
      where: { id: dirMembership.id },
      data: { role: OrganizationRole.DIRECTOR },
    });
  });

  it('DELETE /memberships/:id → kaskádově smaže Teacher a jeho vazby', async () => {
    // připrav učitele v orgA
    const tu = await ctxA.addMember(OrganizationRole.TEACHER, 'teacherForCascade');
    const m = tu.membership;
    // vytvoř Teacher entitu (použij nějaký existující endpoint /teachers nebo přímo přes Prisma)
    const teacher = await prisma.teacher.create({
      data: { membershipId: m.id, organizationId: orgA.id },
      select: { id: true },
    });
    // a jednu vazbu TeacherSubject pro jistotu
    const subj = await prisma.subject.create({
      data: { organizationId: orgA.id, name: 'Cascade Probe' },
      select: { id: true },
    });
    await prisma.teacherSubject.create({
      data: { teacherId: teacher.id, subjectId: subj.id },
    });
    // a homeroom vazbu (třída ukazuje na učitele)
    const ay = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: `AY_${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: false,
      },
      select: { id: true },
    });
    const cs = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: ay.id,
        grade: $Enums.SchoolGrade.GRADE_1,
        section: 'X',
        label: 'Homeroom',
        teacherId: teacher.id,
      },
      select: { id: true },
    });

    // smaž membership jako DIRECTOR v téže org
    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // učitel je soft-deleted, vazby jsou odpojené
    const tGone = await prisma.teacher.findUnique({
      where: { id: teacher.id },
    });
    expect(tGone?.deletedAt).toBeTruthy();
    const links = await prisma.teacherSubject.findMany({
      where: { teacherId: teacher.id },
    });
    expect(links.length).toBe(0);
    const csAfter = await prisma.classSection.findUnique({
      where: { id: cs.id },
      select: { teacherId: true },
    });
    expect(csAfter?.teacherId).toBeNull();

    // cleanup user + subject + class section
    await prisma.refreshToken.deleteMany({ where: { userId: tu.user.id } });
    await prisma.user.delete({ where: { id: tu.user.id } });
    await prisma.subject.delete({ where: { id: subj.id } });
    await prisma.classSection.delete({ where: { id: cs.id } }).catch(() => {});
    await prisma.academicYear.delete({ where: { id: ay.id } }).catch(() => {});
  });

  it('GET /memberships → payload obsahuje embedded user a teacher/student části', async () => {
    const res = await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgA.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? []);
    expect(items.length).toBeGreaterThan(0);
    const one = items.find((m: any) => m.userId === directorA.id);
    expect(one?.user?.id).toBeDefined(); // embednutý user
    // teacher/student jsou volitelné – jen ověř, že klíče existují (null/obj)
    expect(Object.prototype.hasOwnProperty.call(one, 'teacher')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(one, 'student')).toBe(true);
  });

  it('POST /memberships → 400 invalid role enum', async () => {
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgA.id,
        userId: plainUser.id,
        // schválně mimo enum
        role: 'HACKER' as any,
      })
      .expect(400);
  });

  it('GET /memberships → 403 when organizationId is invalid (scope check wins)', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: 'not-uuid' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);
  });

  it('PATCH /memberships/:id → 400 when id is not UUID', async () => {
    await request(app.getHttpServer())
      .patch('/memberships/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(400);
  });

  it('DELETE /memberships/:id → 400 when id is not UUID', async () => {
    await request(app.getHttpServer())
      .delete('/memberships/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  it('PATCH /memberships/:id → 404 when membership does not exist', async () => {
    const fake = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .patch(`/memberships/${fake}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(404);
  });

  it('DELETE /memberships/:id → 404 when membership does not exist', async () => {
    const fake = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer())
      .delete(`/memberships/${fake}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(404);
  });

  it('POST /memberships → 409 for duplicate membership even with different role', async () => {
    // memberA_student už existuje (plainUser v orgA)
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: orgA.id,
        userId: plainUser.id,
        role: OrganizationRole.TEACHER, // jiná role, ale stejná (user, org)
      })
      .expect(409);
  });

  it('GET /memberships?organizationId=orgA → SUPERADMIN OK [200]', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgA.id })
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('GET /memberships?organizationId=orgB → SUPERADMIN OK [200]', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgB.id })
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('PATCH /memberships/:id → SUPERADMIN může změnit roli ředitele [200] (a revert)', async () => {
    const dirMembership = await prisma.membership.findFirstOrThrow({
      where: { organizationId: orgA.id, userId: directorA.id },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .patch(`/memberships/${dirMembership.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(200);
    expect(res.body.role).toBe('TEACHER');

    // revert, aby ostatní testy stále měly ředitele
    await prisma.membership.update({
      where: { id: dirMembership.id },
      data: { role: OrganizationRole.DIRECTOR },
    });
  });

  it('DELETE /memberships/:id → soft delete studenta, vazby zůstávají pro audit', async () => {
    // 1) Student membership v orgA
    const tmp = await ctxA.addMember(OrganizationRole.STUDENT, 'studentCascade');
    const m = tmp.membership;

    // 2) AcademicYear + ClassSection (minimální)
    const label = `AY_${Date.now()}`;
    const ay = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: false,
      },
      select: { id: true },
    });

    const cs = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: ay.id,
        grade: $Enums.SchoolGrade.GRADE_1,
        section: 'Z',
        label: 'Zkušební',
      },
      select: { id: true },
    });

    // 3) Student entity + Enrollment
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: { membershipId: m.id, orgId: orgA.id },
        select: { id: true },
      });
      await tx.enrollment.create({
        data: {
          studentId: created.id,
          classSectionId: cs.id,
          yearId: ay.id,
          orgId: orgA.id,
        },
      });
      return created;
    });

    // 4) Enrollment + StudentClassroom (TopicLevel je volitelný)

    await prisma.studentClassroom.create({
      data: {
        studentId: student.id,
        classSectionId: cs.id,
        schoolYear: label,
      },
    });

    // 5) DELETE membership (DIRECTOR své org)
    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // 6) student je soft-deleted, vazby zůstávají
    const sGone = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(sGone?.deletedAt).toBeTruthy();

    const enrCount = await prisma.enrollment.count({
      where: { studentId: student.id },
    });
    expect(enrCount).toBe(1);

    const scCount = await prisma.studentClassroom.count({
      where: { studentId: student.id },
    });
    expect(scCount).toBe(1);

    // 7) cleanup zbytků (year/section) + user + vazby
    await prisma.enrollment.deleteMany({ where: { studentId: student.id } });
    await prisma.studentClassroom.deleteMany({
      where: { studentId: student.id },
    });
    await prisma.classSection.delete({ where: { id: cs.id } }).catch(() => {});
    await prisma.academicYear.delete({ where: { id: ay.id } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('GET /memberships → 403 TEACHER nemá přístup k listu', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgB.id })
      .set('Authorization', `Bearer ${teacherB.token}`)
      .expect(403);
  });

  it('GET /memberships → 401 když chybí token', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: orgA.id })
      .expect(401);
  });
});
