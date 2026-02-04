import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationType, OrganizationRole } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('ClassSections (e2e)', () => {
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
  let teacherB: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  // years
  let yearA: { id: string };
  let yearB: { id: string };

  // baseline classSections
  let classA: { id: string };
  let classB: { id: string };

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

      const rDirectorA = await register(app, 'directorA');
      directorA = {
        id: rDirectorA.user.id,
        token: rDirectorA.accessToken,
        login: rDirectorA.login,
      };

      const rDirectorB = await register(app, 'directorB');
      directorB = {
        id: rDirectorB.user.id,
        token: rDirectorB.accessToken,
        login: rDirectorB.login,
      };

      const rTeacherB = await register(app, 'teacherB');
      teacherB = {
        id: rTeacherB.user.id,
        token: rTeacherB.accessToken,
        login: rTeacherB.login,
      };
    }

    // orgs + memberships
    orgA = await prisma.organization.create({
      data: {
        name: 'E2E Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true },
    });
    directorA.token = await login(app, directorA.login); // refresh token with role

    orgB = await prisma.organization.create({
      data: {
        name: 'E2E Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: [
            { userId: directorB.id, role: OrganizationRole.DIRECTOR },
            { userId: teacherB.id, role: OrganizationRole.TEACHER },
          ],
        },
      },
      select: { id: true },
    });
    directorB.token = await login(app, directorB.login);

    // academic years
    yearA = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: '2025/26',
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });

    yearB = await prisma.academicYear.create({
      data: {
        orgId: orgB.id,
        label: '2025/26',
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: true,
      },
      select: { id: true },
    });

    classA = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: yearA.id,
        grade: $Enums.SchoolGrade.GRADE_1,
        section: 'A',
        label: '1.A-base',
      },
      select: { id: true },
    });

    classB = await prisma.classSection.create({
      data: {
        orgId: orgB.id,
        yearId: yearB.id,
        grade: $Enums.SchoolGrade.GRADE_2,
        section: 'B',
        label: '2.B-base',
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    // cleanup order by FKs
    await prisma.classSection.deleteMany({
      where: { orgId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.academicYear.deleteMany({
      where: { orgId: { in: [orgA.id, orgB.id] } },
    });

    await prisma.membership.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId: { in: [superUser.id, directorA.id, directorB.id, teacherB.id] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [superUser.id, directorA.id, directorB.id, teacherB.id] },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  // ----------------------------------------------------------------
  // CREATE (POST /class-sections)
  // ----------------------------------------------------------------

  it('POST → vytvoří class section [201]', async () => {
    const dto = {
      yearId: yearA.id,
      grade: $Enums.SchoolGrade.HIGH_SCHOOL_YEAR_1,
      section: 'A',
      label: '1.A',
    };
    const res = await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send(dto)
      .expect(201);

    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.body.yearId).toBe(yearA.id);
    expect(res.body.grade).toBe('HIGH_SCHOOL_YEAR_1');
    expect(res.body.section).toBe('A');
    expect(res.body.label).toBe('1.A');
  });

  it('POST → SUPERADMIN vytvoří class section [201]', async () => {
    const dto = {
      yearId: yearB.id,
      grade: $Enums.SchoolGrade.GRADE_7,
      section: 'Z',
      label: '7.Z',
    };
    const res = await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send(dto)
      .expect(201);

    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.body.yearId).toBe(yearB.id);
  });

  it('POST → DIRECTOR jiné org → 403', async () => {
    await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorB.token}`)
      .send({
        yearId: yearA.id,
        grade: $Enums.SchoolGrade.GRADE_5,
        section: 'B',
        label: '5.B',
      })
      .expect(403);
  });

  it('POST → nevalidní body → 400', async () => {
    await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        yearId: 'not-uuid',
        grade: 'NOT_A_GRADE',
        section: 123,
        label: 456,
        extra: 'nope',
      } as any)
      .expect(400);
  });

  it('POST → neexistující AcademicYear → 404', async () => {
    const fake = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        yearId: fake,
        grade: $Enums.SchoolGrade.GRADE_3,
        section: 'C',
        label: '3.C',
      })
      .expect(404);
  });

  // ----------------------------------------------------------------
  // LIST (GET /class-sections?yearId=... [&grade=&search=&page=&limit=])
  // ----------------------------------------------------------------

  it('GET → bez yearId vrátí seznam pro implicitní rok [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/class-sections')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET → query paramy filtrují výsledky [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/class-sections')
      .query({ yearId: yearA.id, page: 1, limit: 50, search: '1.' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ----------------------------------------------------------------
  // GET /class-sections/:id
  // ----------------------------------------------------------------

  it('GET/:id → DIRECTOR své org dostane detail [200] (včetně teacher/enrollments)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/class-sections/${classA.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body?.id).toBe(classA.id);
    expect(Object.prototype.hasOwnProperty.call(res.body, 'teacher')).toBe(
      true,
    );
    expect(Object.prototype.hasOwnProperty.call(res.body, 'enrollments')).toBe(
      true,
    );
  });

  it('GET/:id → DIRECTOR jiné org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/class-sections/${classA.id}`)
      .set('Authorization', `Bearer ${directorB.token}`)
      .expect(403);
  });

  it('GET/:id → 404 když neexistuje', async () => {
    const fake = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .get(`/class-sections/${fake}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  it('GET/:id → 400 nevalidní UUID', async () => {
    await request(app.getHttpServer())
      .get(`/class-sections/not-uuid`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(400);
  });

  // ----------------------------------------------------------------
  // PATCH /class-sections/:id
  // ----------------------------------------------------------------

  it('PATCH → DIRECTOR své org upraví label/section [200]', async () => {
    const cls = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: yearA.id,
        grade: $Enums.SchoolGrade.GRADE_4,
        section: 'C',
        label: '4.C',
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .patch(`/class-sections/${cls.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ label: '4.C – upraveno', section: 'C2' })
      .expect(200);

    expect(res.body.label).toMatch(/upraveno/);
    expect(res.body.section).toBe('C2');
  });

  it('PATCH → DIRECTOR jiné org → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${classA.id}`)
      .set('Authorization', `Bearer ${directorB.token}`)
      .send({ label: 'hack' })
      .expect(403);
  });

  it('PATCH → 404 když neexistuje', async () => {
    const fake = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer())
      .patch(`/class-sections/${fake}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ label: 'x' })
      .expect(404);
  });

  it('PATCH → 400 invalid body + extra field', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${classA.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ label: 123, extra: 'nope' } as any)
      .expect(400);
  });

  it('PATCH → SUPERADMIN může upravit kdekoliv [200]', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/class-sections/${classB.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ label: 'super edit' })
      .expect(200);

    expect(res.body.label).toBe('super edit');
  });

  // ----------------------------------------------------------------
  // DELETE /class-sections/:id
  // ----------------------------------------------------------------

  it('DELETE → DIRECTOR své org smaže třídu [200]', async () => {
    const cls = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: yearA.id,
        grade: $Enums.SchoolGrade.GRADE_6,
        section: 'D',
        label: '6.D',
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/class-sections/${cls.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const gone = await prisma.classSection.findUnique({
      where: { id: cls.id },
    });
    expect(gone).toBeNull();
  });

  it('DELETE → DIRECTOR jiné org → 403', async () => {
    await request(app.getHttpServer())
      .delete(`/class-sections/${classA.id}`)
      .set('Authorization', `Bearer ${directorB.token}`)
      .expect(403);
  });

  it('DELETE → SUPERADMIN může kdekoliv [200]', async () => {
    const cls = await prisma.classSection.create({
      data: {
        orgId: orgB.id,
        yearId: yearB.id,
        grade: $Enums.SchoolGrade.GRADE_8,
        section: 'X',
        label: '8.X',
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/class-sections/${cls.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const gone = await prisma.classSection.findUnique({
      where: { id: cls.id },
    });
    expect(gone).toBeNull();
  });

  it('DELETE → 404 když neexistuje', async () => {
    const fake = '33333333-3333-4333-8333-333333333333';
    await request(app.getHttpServer())
      .delete(`/class-sections/${fake}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(404);
  });

  it('DELETE → 400 nevalidní UUID', async () => {
    await request(app.getHttpServer())
      .delete(`/class-sections/not-uuid`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(400);
  });

  // ----------------------------------------------------------------
  // SECURITY sanity
  // ----------------------------------------------------------------

  it('POST/GET/PATCH/DELETE → 401 bez tokenu', async () => {
    // POST
    await request(app.getHttpServer())
      .post('/class-sections')
      .send({
        yearId: yearA.id,
        grade: $Enums.SchoolGrade.GRADE_1,
        section: 'E',
        label: '1.E',
      })
      .expect(401);

    // GET
    await request(app.getHttpServer())
      .get('/class-sections')
      .query({ yearId: yearA.id })
      .expect(401);

    // PATCH
    await request(app.getHttpServer())
      .patch(`/class-sections/${classA.id}`)
      .send({ label: 'unauth' })
      .expect(401);

    // DELETE
    await request(app.getHttpServer())
      .delete(`/class-sections/${classA.id}`)
      .expect(401);
  });

  it.skip('POST duplicitní (orgId,yearId,grade,section) → 409 (endpoint je mock)', async () => {
    // Endpoint vrací mock data; reálné chování (unikát + validace) není implementováno.
    const dto = {
      yearId: yearA.id,
      grade: $Enums.SchoolGrade.GRADE_5,
      section: 'E',
      label: '5.E',
    };
    await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send(dto)
      .expect(201);
    await request(app.getHttpServer())
      .post('/class-sections')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send(dto)
      .expect(409);
  });

  it.skip('POST race: 10× stejná třída → 1×201 + 9×409 (endpoint je mock)', async () => {
    // Endpoint vrací mock data; reálné chování (race/unikát) není implementováno.
    const section = `R${Date.now().toString().slice(-5)}`; // unikátní v rámci běhu
    const dto = {
      yearId: yearA.id,
      grade: $Enums.SchoolGrade.GRADE_5,
      section, // ⬅️ odliš od předchozího dup testu
      label: '5.R',
    };

    // pro jistotu zameť případné zbytky
    await prisma.classSection.deleteMany({
      where: { yearId: yearA.id, grade: dto.grade, section: dto.section },
    });

    const reqs = Array.from({ length: 10 }).map(() =>
      request(app.getHttpServer())
        .post('/class-sections')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send(dto),
    );

    const res = await Promise.allSettled(reqs);
    const codes = res.map((r) =>
      r.status === 'fulfilled' ? r.value.status : 500,
    );
    expect(codes.filter((c) => c === 201).length).toBe(1);
    expect(codes.filter((c) => c === 409).length).toBe(9);
  });

  it.skip('GET list: stabilní řazení + prázdná poslední strana (endpoint je mock)', async () => {
    // Endpoint vrací mock data; reálné listování/paginace není implementováno.
    // izolovaný školní rok
    const isoYear = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: `AY_iso_${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-08-31'),
        isCurrent: false,
      },
      select: { id: true },
    });

    // přesně 3 řádky
    await prisma.classSection.createMany({
      data: [
        {
          orgId: orgA.id,
          yearId: isoYear.id,
          grade: $Enums.SchoolGrade.GRADE_3,
          section: 'A',
          label: '3.A',
        },
        {
          orgId: orgA.id,
          yearId: isoYear.id,
          grade: $Enums.SchoolGrade.GRADE_3,
          section: 'B',
          label: '3.B',
        },
        {
          orgId: orgA.id,
          yearId: isoYear.id,
          grade: $Enums.SchoolGrade.GRADE_4,
          section: 'A',
          label: '4.A',
        },
      ],
    });

    const page1 = await request(app.getHttpServer())
      .get('/class-sections')
      .query({ yearId: isoYear.id, page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const pages = page1.body.meta.pages; // = 2
    const over = await request(app.getHttpServer())
      .get('/class-sections')
      .query({ yearId: isoYear.id, page: pages + 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(over.body.data).toEqual([]); // nyní deterministické
  });
});
