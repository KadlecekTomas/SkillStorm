import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { $Enums, OrganizationRole, OrganizationType } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('Users (e2e)', () => {
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
  let plainUser: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs & memberships
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };

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
    const rSuper = await register(app, 'users_super');
    await prisma.user.update({
      where: { id: rSuper.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: rSuper.user.id,
      token: await login(app, rSuper.login),
      login: rSuper.login,
    };

    const rDirA = await register(app, 'users_dirA');
    directorA = {
      id: rDirA.user.id,
      token: rDirA.accessToken,
      login: rDirA.login,
    };

    const rDirB = await register(app, 'users_dirB');
    directorB = {
      id: rDirB.user.id,
      token: rDirB.accessToken,
      login: rDirB.login,
    };

    const rTeachA1 = await register(app, 'users_teacherA1');
    teacherA1 = {
      id: rTeachA1.user.id,
      token: rTeachA1.accessToken,
      login: rTeachA1.login,
    };

    const rTeachB1 = await register(app, 'users_teacherB1');
    teacherB1 = {
      id: rTeachB1.user.id,
      token: rTeachB1.accessToken,
      login: rTeachB1.login,
    };

    const rPlain = await register(app, 'users_plain');
    plainUser = {
      id: rPlain.user.id,
      token: rPlain.accessToken,
      login: rPlain.login,
    };

    // --- ORGS + MEMBERSHIPS ---
    orgA = await prisma.organization.create({
      data: {
        name: 'Users Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true, name: true },
    });
    directorA.token = await login(app, directorA.login); // refresh claims with org

    orgB = await prisma.organization.create({
      data: {
        name: 'Users Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorB.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true, name: true },
    });
    directorB.token = await login(app, directorB.login);

    // teachers
    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherA1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: teacherB1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    // directors (their memberships were created with org)
    await prisma.membership.findFirstOrThrow({
      where: {
        userId: directorA.id,
        organizationId: orgA.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
    await prisma.membership.findFirstOrThrow({
      where: {
        userId: directorB.id,
        organizationId: orgB.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    // best-effort cleanup
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
              plainUser.id,
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
              plainUser.id,
            ],
          },
        },
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------
  // LIST
  // ---------------------------
  it('GET /users → SUPERADMIN vidí všechny, stránkování/řazení/search [200]', async () => {
    // vytvoříme pár userů pro pořadí a search
    const extra1 = await prisma.user.create({
      data: {
        email: 'adam.zima@example.com',
        name: 'Adam Zima',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const extra2 = await prisma.user.create({
      data: {
        email: 'berta.nova@example.com',
        name: 'Berta Nová',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    const page1 = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ page: 1, limit: 2, orderBy: 'name', orderDir: 'asc' })
      .expect(200);

    expect(page1.body.meta.page).toBe(1);
    expect(page1.body.meta.limit).toBe(2);
    expect(Array.isArray(page1.body.data)).toBe(true);
    expect(page1.body.data.length).toBeLessThanOrEqual(2);

    const over = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ page: (page1.body.meta.pages ?? 1) + 1, limit: 2 })
      .expect(200);
    expect(over.body.data).toEqual([]);

    // search podle name/email/username
    const searchRes = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ search: 'berta' })
      .expect(200);
    const names = searchRes.body.data.map((u: any) =>
      (u.name ?? '').toLowerCase(),
    );
    expect(names.join(' ')).toContain('berta');

    // cleanup
    await prisma.user.deleteMany({
      where: { id: { in: [extra1.id, extra2.id] } },
    });
  });

  it('GET /users → DIRECTOR vidí jen svou organizaci [200]', async () => {
    // teacherA1 je v orgA; teacherB1 v orgB
    const resA = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ hasOrgRole: 'TEACHER', orderBy: 'name', orderDir: 'asc' })
      .expect(200);

    const idsA: string[] = resA.body.data.map((u: any) => u.id);
    expect(idsA).toContain(teacherA1.id);
    expect(idsA).not.toContain(teacherB1.id);
  });

  it('GET /users → 401 bez tokenu', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  // ---------------------------
  // DETAIL
  // ---------------------------
  it('GET /users/:id → SUPERADMIN může kohokoliv [200]', async () => {
    await request(app.getHttpServer())
      .get(`/users/${teacherA1.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('GET /users/:id → self může sám sebe [200]', async () => {
    await request(app.getHttpServer())
      .get(`/users/${teacherA1.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);
  });

  it('GET /users/:id → cizí bez superadmin → 403', async () => {
    await request(app.getHttpServer())
      .get(`/users/${teacherA1.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('GET /users/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .get('/users/not-a-uuid')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(400);
  });

  it('GET /users/:id → 404 neexistuje', async () => {
    await request(app.getHttpServer())
      .get('/users/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(404);
  });

  // ---------------------------
  // CREATE (SUPERADMIN only)
  // ---------------------------
  it('POST /users → SUPERADMIN vytvoří [201]', async () => {
    const payload = {
      email: `created.${Date.now()}@example.com`,
      name: 'Created User',
      password: 'ChangeMe123',
      username: 'created_user',
      preferredLang: 'cs-CZ',
    };

    const res = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send(payload)
      .expect(201);

    expect(res.body?.user?.id).toBeTruthy();
    expect(res.body?.user?.email).toBe(payload.email);

    // cleanup
    await prisma.user.delete({ where: { id: res.body.user.id } });
  });

  it('POST /users → DIRECTOR 403', async () => {
    const payload = {
      email: `nope.${Date.now()}@example.com`,
      name: 'Nope',
      password: 'ChangeMe123',
    };
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send(payload)
      .expect(403);
  });

  it('POST /users → 400 invalid body', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ email: 'not-email', password: 'x', name: '' })
      .expect(400);
  });

  // ---------------------------
  // UPDATE (self or SUPERADMIN)
  // ---------------------------
  it('PATCH /users/:id → self upraví name/email [200]', async () => {
    const newName = 'Teacher A1 Renamed';
    const res = await request(app.getHttpServer())
      .patch(`/users/${teacherA1.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({ name: newName })
      .expect(200);

    expect(res.body?.user?.name).toBe(newName);
  });

  it('PATCH /users/:id → SUPERADMIN změní systemRole [200]', async () => {
    const payload = { systemRole: $Enums.SystemRole.SUPERADMIN };
    const tmp = await prisma.user.create({
      data: {
        email: `role.${Date.now()}@ex.com`,
        name: 'Role Target',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .patch(`/users/${tmp.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send(payload)
      .expect(200);

    expect(res.body?.user?.systemRole).toBe('SUPERADMIN');

    await prisma.user.delete({ where: { id: tmp.id } });
  });

  it('PATCH /users/:id → cizí bez superadmin 403', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${teacherA1.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ name: 'Nope' })
      .expect(403);
  });

  it('PATCH /users/:id → non-superadmin nesmí měnit systemRole [403]', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${teacherA1.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({ systemRole: $Enums.SystemRole.SUPERADMIN })
      .expect(403);
  });

  it('PATCH /users/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .patch('/users/not-a-uuid')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'X' })
      .expect(400);
  });

  it('PATCH /users/:id → 404 neexistuje', async () => {
    await request(app.getHttpServer())
      .patch('/users/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'X' })
      .expect(404);
  });

  // ---------------------------
  // DELETE / anonymize
  // ---------------------------
  it('DELETE /users/:id → SUPERADMIN může kohokoliv (soft delete/anonymize) [200]', async () => {
    const tmp = await prisma.user.create({
      data: {
        email: `del.${Date.now()}@ex.com`,
        name: 'Delete Me',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .delete(`/users/${tmp.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    expect(res.body?.user?.isAnonymized).toBe(true);
  });

  it('DELETE /users/:id → DIRECTOR může uživatele své org, ale ne mimo [200/403]', async () => {
    // uživatel v orgA
    const orgAUser = await prisma.user.create({
      data: {
        email: `orga.${Date.now()}@ex.com`,
        name: 'OrgA Guy',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    await prisma.membership.create({
      data: {
        userId: orgAUser.id,
        organizationId: orgA.id,
        role: OrganizationRole.STUDENT,
      },
    });

    await request(app.getHttpServer())
      .delete(`/users/${orgAUser.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    // uživatel v orgB – directorA nemůže
    const orgBUser = await prisma.user.create({
      data: {
        email: `orgb.${Date.now()}@ex.com`,
        name: 'OrgB Guy',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    await prisma.membership.create({
      data: {
        userId: orgBUser.id,
        organizationId: orgB.id,
        role: OrganizationRole.STUDENT,
      },
    });

    await request(app.getHttpServer())
      .delete(`/users/${orgBUser.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(403);

    // cleanup leftovers (orgBUser might not be anonymized on 403)
    await prisma.membership
      .deleteMany({ where: { userId: orgBUser.id } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [orgBUser.id] } } })
      .catch(() => {});
  });

  it('DELETE /users/:id → 400 invalid UUID', async () => {
    await request(app.getHttpServer())
      .delete('/users/not-a-uuid')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(400);
  });

  it('DELETE /users/:id → 404 neexistuje', async () => {
    await request(app.getHttpServer())
      .delete('/users/33333333-3333-4333-8333-333333333333')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(404);
  });

  // ---------------------------
  // LIST – kombinace filtrů
  // ---------------------------
  it('GET /users → kombinované filtry: org + role + search + order [200]', async () => {
    // vytvoříme 2 usery do orgA s různými rolemi a jmény
    const u1 = await prisma.user.create({
      data: {
        email: `comb1.${Date.now()}@ex.com`,
        name: 'Karel Nova',
        passwordHash: 'x',
      },
      select: { id: true, name: true },
    });
    const u2 = await prisma.user.create({
      data: {
        email: `comb2.${Date.now()}@ex.com`,
        name: 'Petr Zima',
        passwordHash: 'x',
      },
      select: { id: true, name: true },
    });
    await prisma.membership.create({
      data: {
        userId: u1.id,
        organizationId: orgA.id,
        role: OrganizationRole.TEACHER,
      },
    });
    await prisma.membership.create({
      data: {
        userId: u2.id,
        organizationId: orgA.id,
        role: OrganizationRole.STUDENT,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({
        organizationId: orgA.id,
        hasOrgRole: 'TEACHER',
        search: 'Karel',
        orderBy: 'name',
        orderDir: 'asc',
      })
      .expect(200);

    const returnedNames: string[] = res.body.data.map((x: any) => x.name);
    expect(returnedNames).toEqual(expect.arrayContaining(['Karel Nova']));
    expect(returnedNames).not.toEqual(expect.arrayContaining(['Petr Zima']));

    // cleanup
    await prisma.membership.deleteMany({
      where: { userId: { in: [u1.id, u2.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  });

  // ---------------------------
  // RBAC – TEACHER restrikce
  // ---------------------------
  it('GET /users → TEACHER nemá přístup k listu [403]', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(403);
  });

  it('DELETE /users/:id → TEACHER nemůže mazat [403]', async () => {
    const tmp = await prisma.user.create({
      data: {
        email: `t-no-del.${Date.now()}@ex.com`,
        name: 'Nope',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    await request(app.getHttpServer())
      .delete(`/users/${tmp.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(403);

    // cleanup
    await prisma.user.delete({ where: { id: tmp.id } });
  });

  // ---------------------------
  // SUPERADMIN self-protection
  // ---------------------------
  it('PATCH /users/:id → SUPERADMIN nesmí sám sobě odebrat SUPERADMIN [403]', async () => {
    await request(app.getHttpServer())
      .patch(`/users/${superUser.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ systemRole: null })
      .expect(403);
  });

  // ---------------------------
  // Unikátní constrainty (email/username) – create + update
  // ---------------------------
  it('POST /users → 409 při duplicitním emailu', async () => {
    const email = `dup.${Date.now()}@ex.com`;
    const u = await prisma.user.create({
      data: { email, name: 'Dup', passwordHash: 'x' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ email, name: 'Another', password: 'ChangeMe123' })
      .expect(409);

    await prisma.user.delete({ where: { id: u.id } });
  });

  it('PATCH /users/:id → 409 při duplicitním username', async () => {
    const u1 = await prisma.user.create({
      data: {
        email: `u1.${Date.now()}@ex.com`,
        name: 'U1',
        passwordHash: 'x',
        username: 'dupuser',
      },
      select: { id: true },
    });
    const u2 = await prisma.user.create({
      data: { email: `u2.${Date.now()}@ex.com`, name: 'U2', passwordHash: 'x' },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .patch(`/users/${u2.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ username: 'dupuser' })
      .expect(409);

    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  });

  // ---------------------------
  // Delete -> detail 404 (anonymizace)
  // ---------------------------
  it('DELETE /users/:id → po anonymizaci vrací detail 404', async () => {
    const tmp = await prisma.user.create({
      data: {
        email: `anon.${Date.now()}@ex.com`,
        name: 'Anon Me',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/users/${tmp.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/users/${tmp.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(404);
  });

  // ---------------------------
  // Cache invalidace (list + detail)
  // ---------------------------
  it('GET /users (DIRECTOR) → po vytvoření a přiřazení do jeho org se nový user hned objeví (global ver bump)', async () => {
    // 1) První načtení listu (cache warmup)
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({ hasOrgRole: 'STUDENT', orderBy: 'name', orderDir: 'asc' })
      .expect(200);

    // 2) Vytvoř usera a přiřaď ho do orgA jako STUDENT
    const u = await prisma.user.create({
      data: {
        email: `newA.${Date.now()}@ex.com`,
        name: 'New OrgA Student',
        passwordHash: 'x',
      },
      select: { id: true, name: true },
    });
    await prisma.membership.create({
      data: {
        userId: u.id,
        organizationId: orgA.id,
        role: OrganizationRole.STUDENT,
      },
    });

    // 3) Znovu načti list → díky bumpGlobal() už by měl být vidět
    const second = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${directorA.token}`)
      .query({
        hasOrgRole: 'STUDENT',
        search: 'New OrgA',
        orderBy: 'name',
        orderDir: 'asc',
      })
      .expect(200);

    const names = second.body.data.map((x: any) => x.name);
    expect(names.join('|')).toContain('New OrgA Student');

    // cleanup
    await prisma.membership.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  });

  it('GET /users/:id → detail se po updatu hned projeví (user ver bump)', async () => {
    const u = await prisma.user.create({
      data: {
        email: `bump.${Date.now()}@ex.com`,
        name: 'Before',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    // warm detail
    await request(app.getHttpServer())
      .get(`/users/${u.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    // update jména (service bumpne user ver + global ver)
    await request(app.getHttpServer())
      .patch(`/users/${u.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ name: 'After' })
      .expect(200);

    // detail by měl mít už nové jméno
    const res = await request(app.getHttpServer())
      .get(`/users/${u.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    expect(res.body.name).toBe('After');

    await prisma.user.delete({ where: { id: u.id } });
  });

  // ---------------------------
  // Stabilní řazení/paginace – deterministic order
  // ---------------------------
  it('GET /users → stabilní pořadí (orderBy=name asc) a over-page prázdno [200]', async () => {
    const uA = await prisma.user.create({
      data: {
        email: `aa.${Date.now()}@ex.com`,
        name: 'Aaa',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const uB = await prisma.user.create({
      data: {
        email: `bb.${Date.now()}@ex.com`,
        name: 'Bbb',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const uC = await prisma.user.create({
      data: {
        email: `cc.${Date.now()}@ex.com`,
        name: 'Ccc',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    const page1 = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ page: 1, limit: 2, orderBy: 'name', orderDir: 'asc' })
      .expect(200);

    const page1Again = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ page: 1, limit: 2, orderBy: 'name', orderDir: 'asc' })
      .expect(200);

    expect(page1.body.data).toEqual(page1Again.body.data);

    const over = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({ page: (page1.body.meta.pages ?? 1) + 1, limit: 2 })
      .expect(200);

    expect(over.body.data).toEqual([]);

    await prisma.user.deleteMany({
      where: { id: { in: [uA.id, uB.id, uC.id] } },
    });
  });

  // ---------------------------
  // Kombinace filtrů – org + role + search + order (rozšířená verze)
  // ---------------------------
  it('GET /users → superadmin: org + role + search + orderBy=username desc [200]', async () => {
    const u1 = await prisma.user.create({
      data: {
        email: `combo1.${Date.now()}@ex.com`,
        name: 'Combo Teach',
        username: 'zz_top',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const u2 = await prisma.user.create({
      data: {
        email: `combo2.${Date.now()}@ex.com`,
        name: 'Combo Teach',
        username: 'aa_low',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    await prisma.membership.create({
      data: {
        userId: u1.id,
        organizationId: orgA.id,
        role: OrganizationRole.TEACHER,
      },
    });
    await prisma.membership.create({
      data: {
        userId: u2.id,
        organizationId: orgA.id,
        role: OrganizationRole.TEACHER,
      },
    });

    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${superUser.token}`)
      .query({
        organizationId: orgA.id,
        hasOrgRole: 'TEACHER',
        search: 'Combo',
        orderBy: 'username',
        orderDir: 'desc',
      })
      .expect(200);

    const usernames = res.body.data.map((x: any) => x.username).filter(Boolean);
    // v desc by měl být 'zz_top' před 'aa_low'
    const iZZ = usernames.indexOf('zz_top');
    const iAA = usernames.indexOf('aa_low');
    expect(iZZ).toBeGreaterThanOrEqual(0);
    expect(iAA).toBeGreaterThanOrEqual(0);
    expect(iZZ).toBeLessThan(iAA);

    await prisma.membership.deleteMany({
      where: { userId: { in: [u1.id, u2.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  });
});
