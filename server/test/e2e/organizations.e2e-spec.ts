import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, OrganizationType, OrganizationRole } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('Organizations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let normalUser: { id: string; token: string };
  let superUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let directorUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let teacherOther: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  let orgA: { id: string };
  let orgB: { id: string };

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
      const r1 = await register(app, 'normal');
      normalUser = { id: r1.user.id, token: r1.accessToken };

      const r2 = await register(app, 'super');
      await prisma.user.update({
        where: { id: r2.user.id },
        data: { systemRole: $Enums.SystemRole.SUPERADMIN },
      });
      // re-login, aby se systemRole propsala do JWT
      const superToken = await login(app, r2.login);
      superUser = { id: r2.user.id, token: superToken, login: r2.login };

      const r3 = await register(app, 'director');
      directorUser = { id: r3.user.id, token: r3.accessToken, login: r3.login };

      const rT = await register(app, 'teacherOther');
      teacherOther = { id: rT.user.id, token: rT.accessToken, login: rT.login };
    }

    // orgA – SCHOOL, kde bude directorUser jako DIRECTOR
    orgA = await prisma.organization.create({
      data: {
        name: 'E2E Org A (School)',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: {
            userId: directorUser.id,
            role: OrganizationRole.DIRECTOR,
          },
        },
      },
      select: { id: true },
    });

    // re-login director, aby měl roli v JWT
    directorUser.token = await login(app, directorUser.login);

    // orgB – jiná org; teacherOther bude TEACHER tady
    orgB = await prisma.organization.create({
      data: {
        name: 'E2E Org B',
        type: OrganizationType.PRIVATE,
        memberships: {
          create: {
            userId: teacherOther.id,
            role: OrganizationRole.TEACHER,
          },
        },
      },
      select: { id: true },
    });

    // re-login teacherOther, aby měl roli v JWT
    teacherOther.token = await login(app, teacherOther.login);
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
          in: [normalUser.id, superUser.id, directorUser.id, teacherOther.id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [normalUser.id, superUser.id, directorUser.id, teacherOther.id],
        },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  // --- CREATE ---
  it('POST /organizations (PRIVATE) → může vytvořit libovolný uživatel', async () => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${normalUser.token}`)
      .send({ name: 'User Private Org', type: OrganizationType.PRIVATE })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.type).toBe('PRIVATE');

    await prisma.organization.delete({ where: { id: res.body.id } });
  });

  it('POST /organizations (SCHOOL) → non-super, non-director dostane 403', async () => {
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${normalUser.token}`)
      .send({ name: 'ShouldFail SCHOOL', type: OrganizationType.SCHOOL })
      .expect(403);
  });

  it('POST /organizations (SCHOOL) → user který je už DIRECTOR někde (ve SCHOOL) může', async () => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${directorUser.token}`)
      .send({
        name: 'Director-created School',
        type: OrganizationType.SCHOOL,
      })
      .expect(201);

    expect(res.body.type).toBe('SCHOOL');
    await prisma.organization.delete({ where: { id: res.body.id } });
  });

  it('POST /organizations (SCHOOL) → SUPERADMIN může', async () => {
    const res = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'Super School', type: OrganizationType.SCHOOL })
      .expect(201);

    expect(res.body.type).toBe('SCHOOL');
    await prisma.organization.delete({ where: { id: res.body.id } });
  });

  // --- FIND ALL (only SUPERADMIN) ---
  it('GET /organizations → jen SUPERADMIN (ostatní 403)', async () => {
    await request(app.getHttpServer())
      .get('/organizations')
      .set('Authorization', `Bearer ${normalUser.token}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get('/organizations')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    expect(Array.isArray(res.body) || Array.isArray(res.body.items)).toBe(true);
  });

  // --- FIND ONE (SchoolAccessGuard + role) ---
  it('GET /organizations/:id → člen org (DIRECTOR) má přístup', async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${directorUser.token}`)
      .expect(200);

    expect(res.body.id).toBe(orgA.id);
  });

  it('GET /organizations/:id → cizí org → 403/404', async () => {
    await request(app.getHttpServer())
      .get(`/organizations/${orgB.id}`)
      .set('Authorization', `Bearer ${directorUser.token}`)
      .expect((r) => {
        if (![403, 404].includes(r.status)) {
          throw new Error(`Expected 403/404, got ${r.status}`);
        }
      });
  });

  // --- UPDATE (director or superadmin) ---
  it('PATCH /organizations/:id → DIRECTOR může updatnout svou org (např. city)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${directorUser.token}`)
      .send({ city: 'Brno' })
      .expect(200);

    expect(res.body.city).toBe('Brno');
  });

  it('PATCH /organizations/:id (type→SCHOOL) → může změnit jen SUPERADMIN (jinak 403)', async () => {
    await request(app.getHttpServer())
      .patch(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${directorUser.token}`)
      .send({ type: OrganizationType.SCHOOL })
      .expect(403);

    const res = await request(app.getHttpServer())
      .patch(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ type: OrganizationType.SCHOOL })
      .expect(200);

    expect(res.body.type).toBe('SCHOOL');
  });

  // --- NEGATIVE RBAC MATRIX ---
  it('PATCH /organizations/:id → TEACHER (jiná org) nemá právo (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${teacherOther.token}`)
      .send({ city: 'Ostrava' })
      .expect(403);
  });

  it('DELETE /organizations/:id → DIRECTOR nemá právo (403)', async () => {
    const tmp = await prisma.organization.create({
      data: { name: 'NoDeleteByDirector', type: OrganizationType.PRIVATE },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/organizations/${tmp.id}`)
      .set('Authorization', `Bearer ${directorUser.token}`)
      .expect(403);

    await prisma.organization.delete({ where: { id: tmp.id } });
  });

  // --- SchoolAccessGuard – cizí člen ---
  it('GET /organizations/:id → TEACHER z jiné org nemá přístup (403/404)', async () => {
    await request(app.getHttpServer())
      .get(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${teacherOther.token}`)
      .expect((r) => {
        if (![403, 404].includes(r.status)) {
          throw new Error(`Expected 403/404, got ${r.status}`);
        }
      });
  });

  it('PATCH /organizations/:id → TEACHER z jiné org nemá přístup (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${teacherOther.token}`)
      .send({ city: 'Plzeň' })
      .expect(403);
  });

  // --- Validation edge cases ---
  it('POST /organizations → validation: neplatný type (400)', async () => {
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'Bad Type Org', type: 'NOT_A_REAL_TYPE' })
      .expect(400);
  });

  it('POST /organizations → validation: krátké name (400)', async () => {
    await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'AB', type: OrganizationType.PRIVATE })
      .expect(400);
  });

  // --- DELETE (only SUPERADMIN, soft-delete aware) ---
  it('DELETE /organizations/:id → jen SUPERADMIN a po smazání GET vrací 404', async () => {
    const tmp = await prisma.organization.create({
      data: { name: 'ToDelete2', type: OrganizationType.PRIVATE },
      select: { id: true },
    });

    // director nemůže
    await request(app.getHttpServer())
      .delete(`/organizations/${tmp.id}`)
      .set('Authorization', `Bearer ${directorUser.token}`)
      .expect(403);

    // superadmin může
    await request(app.getHttpServer())
      .delete(`/organizations/${tmp.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    // API po soft-delete vrátí 404 (pokud filtruješ deletedAt)
    await request(app.getHttpServer())
      .get(`/organizations/${tmp.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(404);

    // interní kontrola soft-delete
    const gone = await prisma.organization.findUnique({
      where: { id: tmp.id },
    });
    expect(gone?.deletedAt).toBeTruthy();
  });
});
