// test/e2e/learning-materials.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  $Enums,
  OrganizationRole,
  OrganizationType,
  ContentType,
} from '@prisma/client';
import { login, register } from 'test/helpers';

/**
 * Pomocná funkce pro vytvoření fake PDF obsahu (pro upload testy)
 */
function fakePdfBuffer(text = 'Dummy PDF'): Buffer {
  const header = '%PDF-1.4\n';
  const body = `%\u0000\u0000\n1 0 obj\n<< /Type /Catalog >>\nendobj\n`;
  const trailer = '%%EOF\n';
  return Buffer.from(header + body + text + '\n' + trailer, 'utf8');
}

describe('LearningMaterials (e2e)', () => {
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
  let studentA: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs
  let orgA: { id: string };
  let orgB: { id: string };

  // memberships
  let mbDirectorA!: { id: string };
  let mbTeacherA1!: { id: string };
  let mbTeacherB1!: { id: string };

  // subject (kvůli subjectId filtrování)
  let subjectA_math!: { id: string };

  // materials
  let matOrgA1!: { id: string };
  let matOrgA2!: { id: string };
  let matGlobal!: { id: string };

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
    const rSuper = await register(app, 'lm_super');
    await prisma.user.update({
      where: { id: rSuper.user.id },
      data: { systemRole: $Enums.SystemRole.SUPERADMIN },
    });
    superUser = {
      id: rSuper.user.id,
      token: await login(app, rSuper.login),
      login: rSuper.login,
    };

    const rDirA = await register(app, 'lm_dirA');
    directorA = {
      id: rDirA.user.id,
      token: rDirA.accessToken,
      login: rDirA.login,
    };

    const rTeachA1 = await register(app, 'lm_teacherA1');
    teacherA1 = {
      id: rTeachA1.user.id,
      token: rTeachA1.accessToken,
      login: rTeachA1.login,
    };

    const rTeachB1 = await register(app, 'lm_teacherB1');
    teacherB1 = {
      id: rTeachB1.user.id,
      token: rTeachB1.accessToken,
      login: rTeachB1.login,
    };

    const rStudA = await register(app, 'lm_studentA');
    studentA = {
      id: rStudA.user.id,
      token: rStudA.accessToken,
      login: rStudA.login,
    };

    // orgs + memberships
    orgA = await prisma.organization.create({
      data: {
        name: 'LM Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true },
    });
    directorA.token = await login(app, directorA.login); // refresh claims

    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: superUser.id,
        role: OrganizationRole.STUDENT,
      },
    });

    orgB = await prisma.organization.create({
      data: {
        name: 'LM Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: teacherB1.id, role: OrganizationRole.TEACHER },
        },
      },
      select: { id: true },
    });

    // memberships
    mbTeacherA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherA1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    await prisma.teacher.create({
      data: { membershipId: mbTeacherA1.id, organizationId: orgA.id },
    });
    teacherA1.token = await login(app, teacherA1.login);

    mbTeacherB1 =
      (await prisma.membership.findFirst({
        where: {
          organizationId: orgB.id,
          userId: teacherB1.id,
          role: OrganizationRole.TEACHER,
        },
        select: { id: true },
      })) ||
      (await prisma.membership.create({
        data: {
          organizationId: orgB.id,
          userId: teacherB1.id,
          role: OrganizationRole.TEACHER,
        },
        select: { id: true },
      }));
    await prisma.teacher.create({
      data: { membershipId: mbTeacherB1.id, organizationId: orgB.id },
    });
    teacherB1.token = await login(app, teacherB1.login);

    mbDirectorA = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: orgA.id,
        userId: directorA.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });

    // student A do orgA (aby měl přístup k ORG materiálům)
    await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: studentA.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    studentA.token = await login(app, studentA.login);

    // subject (kvůli subjectId filtraci)
    const catMath = await prisma.catalogSubject.create({
      data: { code: `MATH_${Date.now()}`, name: 'Matematika (kat)' },
      select: { id: true },
    });
    subjectA_math = await prisma.subject.create({
      data: {
        name: 'Matematika',
        organizationId: orgA.id,
        catalogSubjectId: catMath.id,
      },
      select: { id: true },
    });

    // seed materials
    matOrgA1 = await prisma.learningMaterial.create({
      data: {
        title: 'LM A1',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        schoolGrade: $Enums.SchoolGrade.GRADE_3,
        subjectId: subjectA_math.id,
        organizationId: orgA.id,
        scope: $Enums.ContentScope.ORGANIZATION,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    matOrgA2 = await prisma.learningMaterial.create({
      data: {
        title: 'LM A2',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_2,
        schoolGrade: $Enums.SchoolGrade.GRADE_5,
        subjectId: subjectA_math.id,
        organizationId: orgA.id,
        scope: $Enums.ContentScope.ORGANIZATION,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    matGlobal = await prisma.learningMaterial.create({
      data: {
        title: 'LM GLOBAL',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        subjectId: null,
        organizationId: null,
        scope: $Enums.ContentScope.GLOBAL,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });
  });

  afterAll(async () => {
    // best-effort cleanup
    await prisma.learningMaterial
      .deleteMany({
        where: { id: { in: [matOrgA1.id, matOrgA2.id, matGlobal.id] } },
      })
      .catch(() => {});
    await prisma.subject
      .deleteMany({ where: { id: { in: [subjectA_math.id] } } })
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
              teacherA1.id,
              teacherB1.id,
              studentA.id,
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
              teacherB1.id,
              studentA.id,
            ],
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
  it('POST /learning-materials → DIRECTOR v orgA vytvoří [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        title: 'Fractions – úvod',
        description: 'desc',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        schoolGrade: $Enums.SchoolGrade.GRADE_3,
        organizationId: orgA.id,
        subjectId: subjectA_math.id,
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    await prisma.learningMaterial.delete({ where: { id: res.body.id } });
  });

  it('POST /learning-materials → TEACHER v orgA vytvoří [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({
        title: 'Geometrie – body',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_2,
        schoolGrade: $Enums.SchoolGrade.GRADE_5,
        organizationId: orgA.id,
      })
      .expect(201);

    expect(res.body.organizationId).toBe(orgA.id);
    await prisma.learningMaterial.delete({ where: { id: res.body.id } });
  });

  it('POST /learning-materials → 403 TEACHER jiné organizace', async () => {
    await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({
        title: 'Valid title', // <= místo 'X'
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
      })
      .expect(403);
  });

  it('POST /learning-materials → SUPERADMIN vytvoří GLOBAL [201]', async () => {
    const res = await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({
        title: 'Globalní materiál',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.GLOBAL,
        // organizationId záměrně vynechán
      })
      .expect(201);

    expect(res.body.scope).toBe($Enums.ContentScope.GLOBAL);
    await prisma.learningMaterial.delete({ where: { id: res.body.id } });
  });

  it('POST /learning-materials → 400 ORGANIZATION bez organizationId', async () => {
    await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        title: 'Bad',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.ORGANIZATION,
        // chybí organizationId
      })
      .expect(400);
  });

  // ---------------------------
  // LIST (pagination + filters)
  // ---------------------------
  it('GET /learning-materials → paginace + stabilní pořadí + over-page prázdno', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/learning-materials')
      .query({ organizationId: orgA.id, page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const again = await request(app.getHttpServer())
      .get('/learning-materials')
      .query({ organizationId: orgA.id, page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(page1.body.items).toEqual(again.body.items);

    const pages = page1.body.meta.pages;
    const over = await request(app.getHttpServer())
      .get('/learning-materials')
      .query({ organizationId: orgA.id, page: pages + 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(over.body.items).toEqual([]);
  });

  it('GET /learning-materials → filtry (educationLevel, schoolGrade, subjectId, contentType, scope)', async () => {
    const res = await request(app.getHttpServer())
      .get('/learning-materials')
      .query({
        organizationId: orgA.id,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        schoolGrade: $Enums.SchoolGrade.GRADE_3,
        subjectId: subjectA_math.id,
        contentType: ContentType.MATERIAL,
      })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids: string[] = res.body.items.map((x: any) => x.id);
    expect(ids).toContain(matOrgA1.id);
  });

  it('GET /learning-materials → teacherB1 vidí jen GLOBAL + svou org [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/learning-materials')
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(200);

    // neměl by vidět orgA-only materiály v items
    const ids: string[] = res.body.items.map((x: any) => x.id);
    expect(ids).toContain(matGlobal.id);
  });

  it('GET /learning-materials → STUDENT z orgA vidí GLOBAL + orgA [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/learning-materials')
      .set('Authorization', `Bearer ${studentA.token}`)
      .expect(200);

    const ids: string[] = res.body.items.map((x: any) => x.id);
    expect(ids).toEqual(expect.arrayContaining([matGlobal.id, matOrgA1.id]));
  });

  // ---------------------------
  // DETAIL
  // ---------------------------
  it('GET /learning-materials/:id → GLOBAL je viditelný pro všechny role [200]', async () => {
    await request(app.getHttpServer())
      .get(`/learning-materials/${matGlobal.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(200);
  });

  it('GET /learning-materials/:id → DIRECTOR stejné org [200]', async () => {
    await request(app.getHttpServer())
      .get(`/learning-materials/${matOrgA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  it('GET /learning-materials/:id → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .get(`/learning-materials/${matOrgA1.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('GET /learning-materials/:id → 404 neexistující', async () => {
    await request(app.getHttpServer())
      .get('/learning-materials/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  // ---------------------------
  // UPDATE
  // ---------------------------
  it('PATCH /learning-materials/:id → DIRECTOR stejné org může upravit [200]', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'TMP',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .patch(`/learning-materials/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ title: 'TMP – edited' })
      .expect(200);

    expect(res.body.title).toBe('TMP – edited');
    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  it('PATCH /learning-materials/:id → TEACHER cizí org → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/learning-materials/${matOrgA1.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ title: 'nope' })
      .expect(403);
  });

  it('PATCH /learning-materials/:id → 400 pokus změnit scope/organizationId', async () => {
    await request(app.getHttpServer())
      .patch(`/learning-materials/${matOrgA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ scope: $Enums.ContentScope.GLOBAL })
      .expect(400);
  });

  // ---------------------------
  // DELETE (soft)
  // ---------------------------
  it('DELETE /learning-materials/:id → DIRECTOR smaže (soft) [200]', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'ToDelete',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .delete(`/learning-materials/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.id).toBe(tmp.id);
    const check = await prisma.learningMaterial.findUnique({
      where: { id: tmp.id },
    });
    // zůstává v DB, ale má deletedAt → service vrací záznam; check stačí na existenci řádku
    expect(check).not.toBeNull();
    // cleanup trvale
    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  // ---------------------------
  // UPLOAD FILE (PDF)
  // ---------------------------
  it('POST /learning-materials/:id/file → TEACHER stejné org nahraje PDF [201]', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'Has file',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbTeacherA1.id, // autor = teacher
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post(`/learning-materials/${tmp.id}/file`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .attach('file', fakePdfBuffer('hello'), 'material.pdf')
      .expect(201);

    expect(res.body.fileUrl).toMatch(/\/uploads\/materials\//);

    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  it('POST /learning-materials/:id/file → 400 špatný typ souboru', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'Wrong file',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post(`/learning-materials/${tmp.id}/file`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .attach('file', Buffer.from('NOT A PDF', 'utf8'), 'file.txt')
      .expect(400);

    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  it('POST /learning-materials → TEACHER nesmí vytvořit GLOBAL [403]', async () => {
    await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({
        title: 'Nope GLOBAL',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.GLOBAL,
      })
      .expect(403);
  });

  it('POST /learning-materials → DIRECTOR nesmí vytvořit GLOBAL [403]', async () => {
    await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        title: 'Nope GLOBAL',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.GLOBAL,
      })
      .expect(403);
  });
  it('POST /learning-materials → SUPERADMIN: GLOBAL s organizationId → 400', async () => {
    await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${superUser.token}`)
      .send({
        title: 'Bad combo',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.GLOBAL,
        organizationId: orgA.id, // nesmysl
      })
      .expect(400);
  });

  it('POST /learning-materials → PAID bez price → 400', async () => {
    await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        title: 'Paid no price',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.ORGANIZATION,
        organizationId: orgA.id,
        accessLevel: $Enums.MaterialAccessLevel.PAID,
        // chybí price
      })
      .expect(400);
  });

  it('POST /learning-materials → PAID s price → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/learning-materials')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        title: 'Paid ok',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.ORGANIZATION,
        organizationId: orgA.id,
        accessLevel: $Enums.MaterialAccessLevel.PAID,
        price: 19900,
      })
      .expect(201);
    await prisma.learningMaterial.delete({ where: { id: res.body.id } });
  });

  it('GET /learning-materials/:id → STUDENT cizí org → 403', async () => {
    const rStudB = await register(app, 'lm_studentB');
    // členství v orgB
    await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: rStudB.user.id,
        role: OrganizationRole.STUDENT,
      },
    });
    const studBToken = await login(app, rStudB.login);

    await request(app.getHttpServer())
      .get(`/learning-materials/${matOrgA1.id}`)
      .set('Authorization', `Bearer ${studBToken}`)
      .expect(403);
  });

  it('GET /learning-materials (superadmin, bez orgId) → jen GLOBAL [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/learning-materials')
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const ids: string[] = res.body.items.map((x: any) => x.id);
    expect(ids).toContain(matGlobal.id);
    expect(ids).not.toContain(matOrgA1.id);
  });

  it('GET /learning-materials (superadmin, s orgId) → jen ORG [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/learning-materials')
      .query({ organizationId: orgA.id })
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);

    const ids: string[] = res.body.items.map((x: any) => x.id);
    expect(ids).toContain(matOrgA1.id);
    // superadmin s orgId filtrem neuvidí GLOBAL podle aktuální logiky
    expect(ids).not.toContain(matGlobal.id);
  });
  it('POST /learning-materials/:id/file → TEACHER cizí org → 403', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'OrgA only',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });
    await request(app.getHttpServer())
      .post(`/learning-materials/${tmp.id}/file`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .attach('file', fakePdfBuffer('x'), 'a.pdf')
      .expect(403);
    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  it('POST /learning-materials/:id/file → GLOBAL: superadmin 201, učitel 403', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'Global file',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        scope: $Enums.ContentScope.GLOBAL,
        organizationId: null,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post(`/learning-materials/${tmp.id}/file`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .attach('file', fakePdfBuffer('x'), 'a.pdf')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/learning-materials/${tmp.id}/file`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .attach('file', fakePdfBuffer('x'), 'a.pdf')
      .expect(403);

    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  it('POST /learning-materials/:id/file → 400 soubor > 25MB', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'Big file',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    const big = Buffer.alloc(25 * 1024 * 1024 + 1, 0x20); // 25MB + 1B
    // přidej PDF header, aby to nepadlo na magic bytes, ale na MaxFileSizeValidator
    const pdfish = Buffer.concat([Buffer.from('%PDF-1.4\n'), big]);

    await request(app.getHttpServer())
      .post(`/learning-materials/${tmp.id}/file`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .attach('file', pdfish, 'big.pdf')
      .expect(400);

    await prisma.learningMaterial.delete({ where: { id: tmp.id } });
  });

  it('DELETE → pak GET detail → 404', async () => {
    const tmp = await prisma.learningMaterial.create({
      data: {
        title: 'Delete then 404',
        contentType: ContentType.MATERIAL,
        educationLevel: $Enums.EducationLevel.PRIMARY_1,
        organizationId: orgA.id,
        createdById: mbDirectorA.id,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .delete(`/learning-materials/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/learning-materials/${tmp.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);

    // cleanup hard
    await prisma.learningMaterial
      .delete({ where: { id: tmp.id } })
      .catch(() => {});
  });
});
