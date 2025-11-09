import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationType, OrganizationRole } from '@prisma/client';
import { login, register } from 'test/helpers';

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

    // users
    {
      const rSuper = await register(app, 'super');
      await prisma.user.update({
        where: { id: rSuper.user.id },
        data: { systemRole: $Enums.SystemRole.SUPERADMIN },
      });
      const superToken = await login(app, rSuper.login);
      superUser = {
        id: rSuper.user.id,
        token: superToken,
        login: rSuper.login,
      };

      const rDirector = await register(app, 'directorA');
      directorA = {
        id: rDirector.user.id,
        token: rDirector.accessToken,
        login: rDirector.login,
      };

      const rTeacherB = await register(app, 'teacherB');
      teacherB = {
        id: rTeacherB.user.id,
        token: rTeacherB.accessToken,
        login: rTeacherB.login,
      };

      const rPlain = await register(app, 'plainUser');
      plainUser = {
        id: rPlain.user.id,
        token: rPlain.accessToken,
        login: rPlain.login,
      };
    }

    // orgs
    orgA = await prisma.organization.create({
      data: {
        name: 'E2E Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: {
            userId: directorA.id,
            role: OrganizationRole.DIRECTOR,
          },
        },
      },
      select: { id: true },
    });

    // refresh director JWT so role is embedded (if your guard reads roles from token)
    directorA.token = await login(app, directorA.login);

    orgB = await prisma.organization.create({
      data: {
        name: 'E2E Org B',
        type: OrganizationType.PRIVATE,
        memberships: {
          create: {
            userId: teacherB.id,
            role: OrganizationRole.TEACHER,
          },
        },
      },
      select: { id: true },
    });

    // refresh teacherB token as well
    teacherB.token = await login(app, teacherB.login);
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
        userId: { in: [superUser.id, directorA.id, teacherB.id, plainUser.id] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [superUser.id, directorA.id, teacherB.id, plainUser.id] },
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
    const someone = await register(app, 'someoneB');
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
    const other = await register(app, 'otherDirector');
    const otherMembership = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: other.user.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });

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
    const tmpUser = await register(app, 'tmpB');
    const memberB = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: tmpUser.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

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
    const tmp = await register(app, 'toRemove');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const gone = await prisma.membership.findUnique({ where: { id: m.id } });
    expect(gone).toBeNull();

    // cleanup user
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('DELETE /memberships/:id → DIRECTOR nemůže mazat členství v cizí org (403)', async () => {
    const tmp = await register(app, 'toRemoveB');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

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
    const tmp = await register(app, 'superRemove');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const gone = await prisma.membership.findUnique({ where: { id: m.id } });
    expect(gone).toBeNull();

    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('POST /memberships → 400 invalid UUIDs', async () => {
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        organizationId: 'not-uuid',
        userId: 'not-uuid',
        role: OrganizationRole.STUDENT,
      })
      .expect(400);
  });

  it('POST /memberships → 404 když org/user neexistuje', async () => {
    // validní, ale neexistující UUID
    const fake = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({
        organizationId: fake,
        userId: plainUser.id,
        role: OrganizationRole.STUDENT,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${superUser.token}`)
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
    const x = await register(app, 'xInOrgB');
    const mb = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: x.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

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
    const tu = await register(app, 'teacherForCascade');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tu.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
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

    // smaž membership jako DIRECTOR v téže org
    await request(app.getHttpServer())
      .delete(`/memberships/${m.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // učitel i vazby pryč
    const tGone = await prisma.teacher.findUnique({
      where: { id: teacher.id },
    });
    expect(tGone).toBeNull();
    const links = await prisma.teacherSubject.findMany({
      where: { teacherId: teacher.id },
    });
    expect(links.length).toBe(0);

    // cleanup user + subject
    await prisma.refreshToken.deleteMany({ where: { userId: tu.user.id } });
    await prisma.user.delete({ where: { id: tu.user.id } });
    await prisma.subject.delete({ where: { id: subj.id } });
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

  it('GET /memberships → 400 when organizationId is not UUID', async () => {
    await request(app.getHttpServer())
      .get('/memberships')
      .query({ organizationId: 'not-uuid' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
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

  it('DELETE /memberships/:id → kaskádově smaže Student + Enrollment + StudentClassroom', async () => {
    // 1) Student membership v orgA
    const tmp = await register(app, 'studentCascade');
    const m = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    // 2) Student entity
    const student = await prisma.student.create({
      data: { membershipId: m.id, orgId: orgA.id },
      select: { id: true },
    });

    // 3) AcademicYear + ClassSection (minimální)
    const label = `AY_${Date.now()}`;
    const ay = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
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

    // 4) Enrollment + StudentClassroom (TopicLevel je volitelný)
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classSectionId: cs.id,
        yearId: ay.id,
      },
    });

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

    // 6) vše kaskádově pryč
    const sGone = await prisma.student.findUnique({
      where: { id: student.id },
    });
    expect(sGone).toBeNull();

    const enrCount = await prisma.enrollment.count({
      where: { studentId: student.id },
    });
    expect(enrCount).toBe(0);

    const scCount = await prisma.studentClassroom.count({
      where: { studentId: student.id },
    });
    expect(scCount).toBe(0);

    // 7) cleanup zbytků (year/section) + user
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
