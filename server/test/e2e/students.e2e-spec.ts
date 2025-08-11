// test/e2e/students.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums, OrganizationRole, OrganizationType } from '@prisma/client';
import { login, register } from 'test/helpers';

describe('Students (e2e)', () => {
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
  let studentUser1: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };
  let studentUser2: {
    id: string;
    token: string;
    login: { login: string; password: string };
  };

  // orgs + school structure
  let orgA: { id: string };
  let orgB: { id: string };
  let yearA_current: { id: string; label: string };
  let yearA_past: { id: string; label: string };
  let classA1: { id: string };
  let classA2: { id: string };

  // teacher entities
  let teacherEntA1: { id: string };
  let teacherEntB1: { id: string };

  // student memberships/entities created during tests
  let memberA_student1: { id: string }; // for studentUser1
  let studentA1: { id: string };
  let memberA_student2: { id: string };
  let studentA2: { id: string };

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
      const rSuper = await register(app, 'students_super');
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

      const rDirA = await register(app, 'students_dirA');
      directorA = {
        id: rDirA.user.id,
        token: rDirA.accessToken,
        login: rDirA.login,
      };

      const rTeachA1 = await register(app, 'students_teacherA1');
      teacherA1 = {
        id: rTeachA1.user.id,
        token: rTeachA1.accessToken,
        login: rTeachA1.login,
      };

      const rTeachB1 = await register(app, 'students_teacherB1');
      teacherB1 = {
        id: rTeachB1.user.id,
        token: rTeachB1.accessToken,
        login: rTeachB1.login,
      };

      const rStud1 = await register(app, 'students_student1');
      studentUser1 = {
        id: rStud1.user.id,
        token: rStud1.accessToken,
        login: rStud1.login,
      };

      const rStud2 = await register(app, 'students_student2');
      studentUser2 = {
        id: rStud2.user.id,
        token: rStud2.accessToken,
        login: rStud2.login,
      };
    }

    // orgs + memberships
    orgA = await prisma.organization.create({
      data: {
        name: 'Students Org A',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: directorA.id, role: OrganizationRole.DIRECTOR },
        },
      },
      select: { id: true },
    });
    directorA.token = await login(app, directorA.login);

    orgB = await prisma.organization.create({
      data: {
        name: 'Students Org B',
        type: OrganizationType.SCHOOL,
        memberships: {
          create: { userId: teacherB1.id, role: OrganizationRole.TEACHER },
        },
      },
      select: { id: true },
    });
    teacherB1.token = await login(app, teacherB1.login);

    // teacher entities
    // teacherA1 in orgA
    const mbTeachA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: teacherA1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    teacherEntA1 = await prisma.teacher.create({
      data: { membershipId: mbTeachA1.id, organizationId: orgA.id },
      select: { id: true },
    });
    teacherA1.token = await login(app, teacherA1.login);

    // teacherB1 is already member of orgB (above). Create Teacher entity:
    const mbTeachB1 = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: orgB.id,
        userId: teacherB1.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    teacherEntB1 = await prisma.teacher.create({
      data: { membershipId: mbTeachB1.id, organizationId: orgB.id },
      select: { id: true },
    });

    // academic years
    yearA_current = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: `AY_${Date.now()}_current`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: true,
      },
      select: { id: true, label: true },
    });
    yearA_past = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: `AY_${Date.now()}_past`,
        startsAt: new Date('2024-09-01'),
        endsAt: new Date('2025-06-30'),
        isCurrent: false,
      },
      select: { id: true, label: true },
    });

    // classes in orgA, current year
    classA1 = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: yearA_current.id,
        grade: $Enums.SchoolGrade.GRADE_5,
        section: 'A',
        label: '5.A',
        teacherId: teacherEntA1.id, // homeroom of teacherA1
      },
      select: { id: true },
    });
    classA2 = await prisma.classSection.create({
      data: {
        orgId: orgA.id,
        yearId: yearA_current.id,
        grade: $Enums.SchoolGrade.GRADE_5,
        section: 'B',
        label: '5.B',
        teacherId: null,
      },
      select: { id: true },
    });

    // create student memberships in orgA for studentUser1 + studentUser2
    const mbA1 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: studentUser1.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    memberA_student1 = { id: mbA1.id };

    studentUser1.token = await login(app, studentUser1.login);

    const mbA2 = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: studentUser2.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    memberA_student2 = { id: mbA2.id };

    studentUser2.token = await login(app, studentUser2.login);

    // create student entities via service endpoint (we test create too, but here we need baseline)
    const s1 = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        membershipId: memberA_student1.id,
        orgId: orgA.id,
        studentNumber: '2025-00001',
        externalId: 'EXT-1',
      })
      .expect(201);
    studentA1 = { id: s1.body.id };

    const s2 = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        membershipId: memberA_student2.id,
        orgId: orgA.id,
        studentNumber: '2025-00002',
        externalId: 'EXT-2',
      })
      .expect(201);
    studentA2 = { id: s2.body.id };

    // enroll studentA1 into classA1 in current year (so teacherA1 gets access)
    await prisma.enrollment.create({
      data: {
        studentId: studentA1.id,
        classSectionId: classA1.id,
        yearId: yearA_current.id,
      },
    });
    // also one old enrollment (past year homeroom should NOT give access)
    await prisma.enrollment.create({
      data: {
        studentId: studentA1.id,
        yearId: yearA_past.id,
        classSectionId: classA2.id,
      },
    });
  });

  afterAll(async () => {
    // Best-effort cleanup
    await prisma.enrollment
      .deleteMany({
        where: { studentId: { in: [studentA1.id, studentA2.id] } },
      })
      .catch(() => {});
    await prisma.student
      .deleteMany({ where: { id: { in: [studentA1.id, studentA2.id] } } })
      .catch(() => {});
    await prisma.membership
      .deleteMany({
        where: { id: { in: [memberA_student1.id, memberA_student2.id] } },
      })
      .catch(() => {});
    await prisma.teacherSubject
      .deleteMany({
        where: { teacherId: { in: [teacherEntA1.id, teacherEntB1.id] } },
      })
      .catch(() => {});
    await prisma.teacher
      .deleteMany({ where: { id: { in: [teacherEntA1.id, teacherEntB1.id] } } })
      .catch(() => {});
    await prisma.classSection
      .deleteMany({ where: { id: { in: [classA1.id, classA2.id] } } })
      .catch(() => {});
    await prisma.academicYear
      .deleteMany({ where: { id: { in: [yearA_current.id, yearA_past.id] } } })
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
              studentUser1.id,
              studentUser2.id,
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
              studentUser1.id,
              studentUser2.id,
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
  it('POST /students → DIRECTOR vytvoří studenta [201]', async () => {
    const tmpUser = await register(app, 'stud_create_ok');
    const mb = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmpUser.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        membershipId: mb.id,
        orgId: orgA.id,
        studentNumber: '2025-00999',
      })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.orgId).toBe(orgA.id);

    // cleanup created
    await prisma.student.delete({ where: { id: res.body.id } });
    await prisma.membership.delete({ where: { id: mb.id } });
    await prisma.refreshToken.deleteMany({
      where: { userId: tmpUser.user.id },
    });
    await prisma.user.delete({ where: { id: tmpUser.user.id } });
  });

  it('POST /students → 403 když membership není STUDENT', async () => {
    const tmp = await register(app, 'stud_create_role');
    const mb = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: mb.id, orgId: orgA.id })
      .expect(403);

    await prisma.membership.delete({ where: { id: mb.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('POST /students → 403 membership org != orgId', async () => {
    const tmp = await register(app, 'stud_create_org_mismatch');
    const mb = await prisma.membership.create({
      data: {
        organizationId: orgB.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: mb.id, orgId: orgA.id })
      .expect(403);

    await prisma.membership.delete({ where: { id: mb.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('POST /students → 403 DIRECTOR jiné organizace', async () => {
    const tmp = await register(app, 'stud_create_other_org');
    const mb = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });

    // teacherB1 je v orgB (DIRECTOR není, ale testujeme restrikci na org)
    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ membershipId: mb.id, orgId: orgA.id })
      .expect(403);

    await prisma.membership.delete({ where: { id: mb.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('POST /students → 403 když membership už má studenta (dup)', async () => {
    // memberA_student1 už má studentA1
    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: memberA_student1.id, orgId: orgA.id })
      .expect(403);
  });

  it('POST /students → 400 invalid UUIDs', async () => {
    await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ membershipId: 'not-uuid', orgId: 'not-uuid' })
      .expect(400);
  });

  // ---------------------------
  // DETAIL (RBAC přes canAccessStudent)
  // ---------------------------
  it('GET /students/:id → SUPERADMIN vidí kohokoli [200]', async () => {
    await request(app.getHttpServer())
      .get(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${superUser.token}`)
      .expect(200);
  });

  it('GET /students/:id → DIRECTOR stejné org vidí [200]', async () => {
    await request(app.getHttpServer())
      .get(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
  });

  it('GET /students/:id → TEACHER třídní v current roce vidí [200]', async () => {
    await request(app.getHttpServer())
      .get(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(200);
  });

  it('GET /students/:id → TEACHER cizí org nebo netřídní → 403', async () => {
    await request(app.getHttpServer())
      .get(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });

  it('GET /students/:id → STUDENT vidí sám sebe [200] a nevidí cizího [403]', async () => {
    // sám sebe
    await request(app.getHttpServer())
      .get(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${studentUser1.token}`)
      .expect(200);
    // cizího
    await request(app.getHttpServer())
      .get(`/students/${studentA2.id}`)
      .set('Authorization', `Bearer ${studentUser1.token}`)
      .expect(403);
  });

  it('GET /students/:id → 404 když neexistuje', async () => {
    await request(app.getHttpServer())
      .get('/students/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  // ---------------------------
  // UPDATE
  // ---------------------------
  it('PATCH /students/:id → DIRECTOR upraví číslo/externalId [200]', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/students/${studentA2.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ studentNumber: '2025-55555', externalId: 'X-55555' })
      .expect(200);
    expect(res.body.studentNumber).toBe('2025-55555');
    expect(res.body.externalId).toBe('X-55555');
  });

  it('PATCH /students/:id → TEACHER třídní v current roce může [200]', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .send({ studentNumber: '2025-EDIT' })
      .expect(200);
    expect(res.body.studentNumber).toBe('2025-EDIT');
  });

  it('PATCH /students/:id → TEACHER z jiné org → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .send({ externalId: 'NOPE' })
      .expect(403);
  });

  it('PATCH /students/:id → STUDENT sám sebe nesmí měnit → 403', async () => {
    await request(app.getHttpServer())
      .patch(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${studentUser1.token}`)
      .send({ externalId: 'NOPE' })
      .expect(403);
  });

  it('PATCH /students/:id → 400 invalid id', async () => {
    await request(app.getHttpServer())
      .patch('/students/not-a-uuid')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({ externalId: 'NOPE' })
      .expect(400);
  });

  // ---------------------------
  // DELETE (soft)
  // ---------------------------
  it('DELETE /students/:id → DIRECTOR své org smaže (soft) [200]', async () => {
    const tmp = await register(app, 'stud_soft_del');
    const mb = await prisma.membership.create({
      data: {
        organizationId: orgA.id,
        userId: tmp.user.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    const created = await prisma.student.create({
      data: { membershipId: mb.id, orgId: orgA.id, studentNumber: 'DEL-1' },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .delete(`/students/${created.id}`)
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(res.body.id).toBe(created.id);

    const check = await prisma.student.findUnique({
      where: { id: created.id },
    });
    expect(check?.deletedAt).not.toBeNull();

    // cleanup
    await prisma.membership.delete({ where: { id: mb.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: tmp.user.id } });
    await prisma.user.delete({ where: { id: tmp.user.id } });
  });

  it('DELETE /students/:id → TEACHER nesmí (403), STUDENT nesmí (403)', async () => {
    await request(app.getHttpServer())
      .delete(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${teacherA1.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/students/${studentA1.id}`)
      .set('Authorization', `Bearer ${studentUser1.token}`)
      .expect(403);
  });

  it('DELETE /students/:id → 404 neexistuje', async () => {
    await request(app.getHttpServer())
      .delete('/students/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(404);
  });

  // ---------------------------
  // LIST (pagination + filters + search)
  // ---------------------------
  it('GET /students → paginace a stabilní pořadí + over-page prázdno', async () => {
    // izolovaný rok, 3 studenti
    const isoYear = await prisma.academicYear.create({
      data: {
        orgId: orgA.id,
        label: `AY_iso_${Date.now()}`,
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: false,
      },
      select: { id: true },
    });

    // vytvoř 3 fresh students (jména přes user)
    const regs = await Promise.all([
      register(app, 'stud_list_a'),
      register(app, 'stud_list_b'),
      register(app, 'stud_list_c'),
    ]);
    const mbs = await Promise.all(
      regs.map((r) =>
        prisma.membership.create({
          data: {
            organizationId: orgA.id,
            userId: r.user.id,
            role: OrganizationRole.STUDENT,
          },
          select: { id: true, userId: true },
        }),
      ),
    );
    const studs = await Promise.all(
      mbs.map((m, i) =>
        prisma.student.create({
          data: {
            membershipId: m.id,
            orgId: orgA.id,
            studentNumber: `SN-${i + 1}`,
            externalId: `EX-${i + 1}`,
          },
          select: { id: true },
        }),
      ),
    );

    // enroll je do isoYear / classA2
    await Promise.all(
      studs.map((s) =>
        prisma.enrollment.create({
          data: {
            studentId: s.id,
            classSectionId: classA2.id,
            yearId: isoYear.id,
          },
        }),
      ),
    );

    const page1 = await request(app.getHttpServer())
      .get('/students')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const again = await request(app.getHttpServer())
      .get('/students')
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    expect(page1.body.data).toEqual(again.body.data);

    const pages = page1.body.meta.pages;
    const over = await request(app.getHttpServer())
      .get('/students')
      .query({ page: pages + 1, limit: 2 })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(over.body.data).toEqual([]);

    // cleanup those users
    await prisma.enrollment.deleteMany({
      where: { studentId: { in: studs.map((s) => s.id) } },
    });
    await prisma.student.deleteMany({
      where: { id: { in: studs.map((s) => s.id) } },
    });
    await prisma.membership.deleteMany({
      where: { id: { in: mbs.map((m) => m.id) } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: regs.map((r) => r.user.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: regs.map((r) => r.user.id) } },
    });
    await prisma.academicYear.delete({ where: { id: isoYear.id } });
  });

  it('GET /students → search by name/studentNumber/externalId', async () => {
    // jméno je na userovi studentA2 → načítáno přes membership
    const byName = await request(app.getHttpServer())
      .get('/students')
      .query({
        search:
          (
            await prisma.user.findUnique({ where: { id: studentUser2.id } })
          )?.name?.slice(0, 3) ?? 'stud',
      })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    expect(Array.isArray(byName.body.data)).toBe(true);

    const fresh = await prisma.student.findUnique({
      where: { id: studentA2.id },
    });
    const byNumber = await request(app.getHttpServer())
      .get('/students')
      .query({ search: fresh!.studentNumber! })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);

    const ids2 = byNumber.body.data.map((x: any) => x.id);
    expect(ids2).toContain(studentA2.id);

    const byExternal = await request(app.getHttpServer())
      .get('/students')
      .query({ search: 'EXT-1' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    const ids1 = byExternal.body.data.map((x: any) => x.id);
    expect(ids1).toContain(studentA1.id);
  });

  it('GET /students → filter by yearId / classSectionId', async () => {
    const byYear = await request(app.getHttpServer())
      .get('/students')
      .query({ yearId: yearA_current.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    const idsY = byYear.body.data.map((x: any) => x.id);
    expect(idsY).toContain(studentA1.id);

    const byClass = await request(app.getHttpServer())
      .get('/students')
      .query({ classSectionId: classA1.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
    const idsC = byClass.body.data.map((x: any) => x.id);
    expect(idsC).toContain(studentA1.id);
  });

  it('GET /students → 401 bez tokenu, 403 TEACHER jiné organizace na list', async () => {
    await request(app.getHttpServer()).get('/students').expect(401);

    await request(app.getHttpServer())
      .get('/students')
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403); // teacher v orgB nemá mít přístup k orgA datům
  });

  // ---------------------------
  // EXPORT
  // ---------------------------
  it('GET /students/export → XLSX (template=reditel) [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/students/export')
      .query({ template: 'reditel', format: 'xlsx', yearId: yearA_current.id })
      .set('Authorization', `Bearer ${directorA.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Uint8Array[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.header['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.header['content-disposition']).toContain(
      'attachment; filename=',
    );
    expect(Buffer.isBuffer(res.body)).toBe(true); // teď to projde
  });

  it('GET /students/export → CSV (template=kontakty) [200]', async () => {
    const res = await request(app.getHttpServer())
      .get('/students/export')
      .query({ template: 'kontakty', format: 'csv' })
      .set('Authorization', `Bearer ${directorA.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Uint8Array[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.header['content-type']).toContain('text/csv');
    const csv = (res.body as Buffer).toString('utf8');
    expect(csv.split('\n')[0]).toBeTruthy(); // header line exists
  });

  it('GET /students/export → 403 TEACHER jiné organizace', async () => {
    await request(app.getHttpServer())
      .get('/students/export')
      .query({ template: 'kontakty' })
      .set('Authorization', `Bearer ${teacherB1.token}`)
      .expect(403);
  });
});
