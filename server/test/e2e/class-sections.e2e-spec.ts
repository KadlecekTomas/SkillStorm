import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, OrganizationType, OrganizationRole } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('ClassSections – homeroom (e2e)', () => {
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
  let teacherA1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let teacherA2: {
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

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  // school structure
  let ayA: { id: string; label: string };
  let clsA: { id: string };

  // teachers entities (link to membership)
  let teacherEntA1: { id: string };
  let teacherEntA2: { id: string };
  let teacherEntB1: { id: string };
  let teacherEntDeletedA: { id: string };

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

    // --- users
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

      const rTeacherA1 = await register(app, 'teacherA1');
      teacherA1 = {
        id: rTeacherA1.user.id,
        token: rTeacherA1.accessToken,
        login: rTeacherA1.login,
      };

      const rTeacherA2 = await register(app, 'teacherA2');
      teacherA2 = {
        id: rTeacherA2.user.id,
        token: rTeacherA2.accessToken,
        login: rTeacherA2.login,
      };

      const rTeacherB1 = await register(app, 'teacherB1');
      teacherB1 = {
        id: rTeacherB1.user.id,
        token: rTeacherB1.accessToken,
        login: rTeacherB1.login,
      };

      const rPlain = await register(app, 'plainUser');
      plainUser = {
        id: rPlain.user.id,
        token: rPlain.accessToken,
        login: rPlain.login,
      };
    }

    // --- orgs + memberships (director + teachers)
    orgA = await prisma.organization.create({
      data: {
        name: 'E2E Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: [
            { userId: directorA.id, role: OrganizationRole.DIRECTOR },
            { userId: teacherA1.id, role: OrganizationRole.TEACHER },
            { userId: teacherA2.id, role: OrganizationRole.TEACHER },
          ],
        },
      },
      select: { id: true },
    });
    directorA.token = await login(app, directorA.login); // role refresh in token

    orgB = await prisma.organization.create({
      data: {
        name: 'E2E Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: [
            { userId: directorB.id, role: OrganizationRole.DIRECTOR },
            { userId: teacherB1.id, role: OrganizationRole.TEACHER },
          ],
        },
      },
      select: { id: true },
    });
    directorB.token = await login(app, directorB.login);

    // --- teacher entities
    const mTA1 = await prisma.membership.findFirstOrThrow({
      where: { userId: teacherA1.id, organizationId: orgA.id },
    });
    const mTA2 = await prisma.membership.findFirstOrThrow({
      where: { userId: teacherA2.id, organizationId: orgA.id },
    });
    const mTB1 = await prisma.membership.findFirstOrThrow({
      where: { userId: teacherB1.id, organizationId: orgB.id },
    });

    teacherEntA1 = await prisma.teacher.create({
      data: { membershipId: mTA1.id, organizationId: orgA.id },
      select: { id: true },
    });
    teacherEntA2 = await prisma.teacher.create({
      data: { membershipId: mTA2.id, organizationId: orgA.id },
      select: { id: true },
    });
    teacherEntB1 = await prisma.teacher.create({
      data: { membershipId: mTB1.id, organizationId: orgB.id },
      select: { id: true },
    });

    // soft-deleted teacher in orgA
    const rDel = await register(app, 'teacherDelA');
    const mDel = await prisma.membership.create({
      data: {
        userId: rDel.user.id,
        organizationId: orgA.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    teacherEntDeletedA = await prisma.teacher.create({
      data: {
        membershipId: mDel.id,
        organizationId: orgA.id,
        deletedAt: new Date(),
      },
      select: { id: true },
    });

    // --- academic year + class section
    ayA = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: '2025/26',
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: true,
      },
      select: { id: true, label: true },
    });

    clsA = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: ayA.id,
        grade: $Enums.SchoolGrade.HIGH_SCHOOL_YEAR_1,
        section: 'A',
        label: '1.A',
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    // cleanup order (FKs)
    await prisma.classSection.deleteMany({
      where: { orgId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.academicYear.deleteMany({
      where: { orgId: { in: [orgA.id, orgB.id] } },
    });

    await prisma.teacher.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });

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
            directorB.id,
            teacherA1.id,
            teacherA2.id,
            teacherB1.id,
            plainUser.id,
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
            directorB.id,
            teacherA1.id,
            teacherA2.id,
            teacherB1.id,
            plainUser.id,
          ],
        },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  // ----------------------------------------------------------------
  // PATCH /class-sections/:id/homeroom
  // ----------------------------------------------------------------

  it('401 bez tokenu', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .send({ teacherId: teacherEntA1.id })
      .expect(401);
  });

  it('400 nevalidní UUID param id', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/not-a-uuid/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA1.id })
      .expect(400);
  });

  it('400 nevalidní UUID v body (teacherId)', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: 'not-uuid' })
      .expect(400);
  });

  it('400 extra pole v body (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA1.id, extra: 'nope' })
      .expect(400);
  });

  it('404 když třída neexistuje', async () => {
    const fake = '11111111-1111-4111-8111-111111111111';
    await request(app.getHttpServer())
      .patch(`/class-sections/${fake}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA1.id })
      .expect(404);
  });

  it('403 director jiné organizace nemůže nastavovat homeroom', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorB.token}`)
      .send({ teacherId: teacherEntA1.id })
      .expect(403);
  });

  it('403 director nemůže přiřadit učitele z jiné org', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntB1.id })
      .expect(403);
  });

  it('404 když učitel je soft-deleted', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntDeletedA.id })
      .expect(404);
  });

  it('403 TEACHER (stejná org) nemá oprávnění', async () => {
    // teacher token už máme (role v tokenu z registrace/loginu)
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({ teacherId: teacherEntA2.id })
      .expect(403);
  });

  it('200 SUPERADMIN může nastavit kohokoli', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ teacherId: teacherEntA1.id })
      .expect(200);

    expect(res.body.teacherId).toBe(teacherEntA1.id);
    expect(res.body.academicYear?.id).toBe(ayA.id); // include check
  });

  it('200 DIRECTOR (stejná org) může nastavit učitele + include vztahů', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA2.id })
      .expect(200);

    expect(res.body.teacherId).toBe(teacherEntA2.id);
    expect(res.body.teacher?.membership?.user?.id).toBeDefined();
  });

  it('200 nastavení null učitele zruší třídnictví', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: null })
      .expect(200);

    expect(res.body.teacherId).toBeNull();
  });

  it('200 idempotentní – opakované nastavení stejného učitele vrací stabilní výsledek', async () => {
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA1.id })
      .expect(200);

    const res2 = await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA1.id })
      .expect(200);

    expect(res2.body.teacherId).toBe(teacherEntA1.id);
  });

  it('200 paralelní požadavky dvou různých učitelů → poslední zápis viditelný (last write wins) a stav konzistentní', async () => {
    // připrav dva požadavky
    const r1 = request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA1.id });

    const r2 = request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: teacherEntA2.id });

    const [a, b] = await Promise.all([r1, r2]);
    expect([a.status, b.status]).toEqual(expect.arrayContaining([200, 200]));

    // finální stav v DB je jeden z těch dvou (žádný mix)
    const final = await prisma.classSection.findUniqueOrThrow({
      where: { id: clsA.id },
    });
    expect([teacherEntA1.id, teacherEntA2.id]).toContain(
      final.teacherId as string,
    );
  });

  it('404 když teacherId ukazuje na neexistujícího učitele', async () => {
    const fake = '22222222-2222-4222-8222-222222222222';
    await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ teacherId: fake })
      .expect(404);
  });

  it('200 SUPERADMIN může znovu přenastavit (stability check + include)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/class-sections/${clsA.id}/homeroom`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({ teacherId: teacherEntA2.id })
      .expect(200);

    expect(res.body.teacherId).toBe(teacherEntA2.id);
    expect(res.body.academicYear?.id).toBe(ayA.id);
  });
});
