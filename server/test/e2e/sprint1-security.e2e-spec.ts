import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';
import { authAs, login } from 'test/helpers';
import { RegisterMode } from '@/auth/dto/register.dto';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

type JoinResult = {
  userId: string;
  membershipId: string;
  accessToken: string;
};

async function registerJoinOrg(
  app: INestApplication,
  orgId: string,
  role: OrganizationRole,
  seed: string,
): Promise<JoinResult> {
  const prisma = app.get(PrismaService);
  const invite = await prisma.invite.create({
    data: {
      organizationId: orgId,
      token: `invite_${seed}_${Date.now()}`,
      code: `code_${seed}_${Date.now()}`,
      role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: { token: true },
  });
  const email = `${seed}-${Date.now()}@example.com`;
  const password = 'Password123!';
  const reg = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      name: `E2E ${seed}`,
      email,
      username: `${seed}-${Date.now()}`,
      password,
      mode: RegisterMode.JOIN_ORG,
      inviteToken: invite.token,
    })
    .expect(201);

  const regData = unwrapBody(reg);
  const accessToken = await login(app, { email, password });

  return {
    userId: regData?.user?.id,
    membershipId: regData?.membership?.id,
    accessToken,
  };
}

describe('Sprint 1 security hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgA: { id: string };
  let orgB: { id: string };

  let directorA: { token: string; userId: string };
  let directorB: { token: string; userId: string };
  let teacherA: { token: string; userId: string; membershipId: string; teacherId: string };
  let studentA: { token: string; userId: string; membershipId: string; studentId: string };

  let yearA: { id: string };
  let classA1: { id: string };
  let classA2: { id: string };
  let enrollmentA1: { id: string };

  let yearB: { id: string };
  let classB1: { id: string };

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

    // Director creates org A
    const directorAuth = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'sprint1_dirA',
      mode: RegisterMode.CREATE_ORG,
    });
    directorA = { token: directorAuth.accessToken, userId: directorAuth.user.id };
    orgA = { id: directorAuth.organization.id };

    // Teacher + student join org A
    const teacherJoin = await registerJoinOrg(app, orgA.id, OrganizationRole.TEACHER, 'sprint1_teacherA');
    teacherA = {
      token: teacherJoin.accessToken,
      userId: teacherJoin.userId,
      membershipId: teacherJoin.membershipId,
      teacherId: '',
    };

    const studentJoin = await registerJoinOrg(app, orgA.id, OrganizationRole.STUDENT, 'sprint1_studentA');
    studentA = {
      token: studentJoin.accessToken,
      userId: studentJoin.userId,
      membershipId: studentJoin.membershipId,
      studentId: '',
    };

    // Ensure teacher entity exists for teacherA (join via invite may have created it)
    const existingTeacher = await prisma.teacher.findUnique({
      where: { membershipId: teacherA.membershipId },
      select: { id: true },
    });
    if (existingTeacher) {
      teacherA.teacherId = existingTeacher.id;
    } else {
      const teacherRes = await request(app.getHttpServer())
        .post('/teachers')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({
          membershipId: teacherA.membershipId,
          organizationId: orgA.id,
        })
        .expect(201);
      teacherA.teacherId = teacherRes.body.id ?? teacherRes.body?.data?.id ?? teacherRes.body?.teacherId;
    }

    // Academic year A (organization create may auto-create current year)
    const existingYearA = await prisma.academicYear.findFirst({
      where: { orgId: orgA.id, isCurrent: true },
      select: { id: true },
    });
    if (existingYearA) {
      yearA = { id: existingYearA.id };
    } else {
      const yearRes = await request(app.getHttpServer())
        .post('/academic-years')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({
          startYear: 2025,
          isActive: true,
        })
        .expect(201);
      yearA = { id: yearRes.body.id ?? yearRes.body?.data?.id };
    }
    await prisma.academicYear.updateMany({
      where: { orgId: orgA.id, id: { not: yearA.id } },
      data: { isCurrent: false },
    });
    await prisma.academicYear.update({
      where: { id: yearA.id },
      data: { isCurrent: true },
    });
    await prisma.academicYear.deleteMany({
      where: { orgId: orgA.id, id: { not: yearA.id } },
    });
    const currentCountA = await prisma.academicYear.count({
      where: { orgId: orgA.id, isCurrent: true },
    });
    if (currentCountA !== 1) {
      throw new Error(`Expected exactly one current year for orgA, got ${currentCountA}`);
    }

    // Class sections for org A (use existing if auto-created)
    const existingSectionsAYear = await prisma.classSection.findMany({
      where: { orgId: orgA.id, yearId: yearA.id },
      select: { id: true, grade: true, section: true },
      orderBy: { createdAt: 'asc' },
    });
    const usedSectionsA = await prisma.classSection.findMany({
      where: { orgId: orgA.id, grade: 'GRADE_1' },
      select: { section: true },
    });
    if (existingSectionsAYear.length >= 2) {
      const [first, second] = existingSectionsAYear;
      if (first && second) {
        classA1 = { id: first.id };
        classA2 = { id: second.id };
      }
    } else {
      const usedSections = new Set(
        usedSectionsA.map((s) => s.section),
      );
      const candidates = ['A', 'B', 'C', 'D', 'E', 'F'];
      const nextSection = () =>
        candidates.find((s) => !usedSections.has(s)) ?? `X${Date.now()}`;
      const ensureClassSection = async (
        section: string,
        label: string,
        teacherId?: string,
      ) => {
        const existing = await prisma.classSection.findFirst({
          where: { orgId: orgA.id, yearId: yearA.id, grade: 'GRADE_1', section },
          select: { id: true },
        });
        if (existing) return existing.id;
        const created = await prisma.classSection.create({
          data: {
            orgId: orgA.id,
            yearId: yearA.id,
            grade: 'GRADE_1',
            section,
            label,
            teacherId: teacherId ?? null,
          },
          select: { id: true },
        });
        return created.id;
      };

      if (existingSectionsAYear.length === 1) {
        const first = existingSectionsAYear[0];
        if (first) {
          classA1 = { id: first.id };
        }
      } else {
        const section = nextSection();
        usedSections.add(section);
        classA1 = {
          id: await ensureClassSection(section, `1.${section}`, teacherA.teacherId),
        };
      }

      const section2 = nextSection();
      classA2 = {
        id: await ensureClassSection(section2, `1.${section2}`),
      };
    }
    await prisma.classSection.deleteMany({
      where: {
        orgId: orgA.id,
        yearId: yearA.id,
        id: { notIn: [classA1.id, classA2.id] },
      },
    });
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // Ensure student entity exists + enrollment for classA1
    const existingStudent = await prisma.student.findUnique({
      where: { membershipId: studentA.membershipId },
      select: { id: true },
    });
    if (existingStudent) {
      studentA.studentId = existingStudent.id;
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { studentId: existingStudent.id, yearId: yearA.id },
        select: { id: true },
      });
      if (!existingEnrollment) {
        await prisma.enrollment.create({
          data: {
            studentId: existingStudent.id,
            classSectionId: classA1.id,
            yearId: yearA.id,
            orgId: orgA.id,
            status: 'ACTIVE',
          },
        });
      }
    } else {
      const studentRes = await request(app.getHttpServer())
        .post('/students')
        .set('Authorization', `Bearer ${directorA.token}`)
        .send({
          membershipId: studentA.membershipId,
          orgId: orgA.id,
          academicYearId: yearA.id,
          classSectionId: classA1.id,
        })
        .expect(201);
      studentA.studentId = studentRes.body.id ?? studentRes.body?.data?.id;
    }

    enrollmentA1 = await prisma.enrollment.findFirstOrThrow({
      where: { studentId: studentA.studentId, yearId: yearA.id },
      select: { id: true },
    });

    // Org B for cross-org tests
    const directorBAuth = await authAs(app, OrganizationRole.DIRECTOR, {
      seed: 'sprint1_dirB',
      mode: RegisterMode.CREATE_ORG,
    });
    directorB = { token: directorBAuth.accessToken, userId: directorBAuth.user.id };
    orgB = { id: directorBAuth.organization.id };

    const existingYearB = await prisma.academicYear.findFirst({
      where: { orgId: orgB.id, isCurrent: true },
      select: { id: true },
    });
    if (existingYearB) {
      yearB = { id: existingYearB.id };
    } else {
      const yearBRes = await request(app.getHttpServer())
        .post('/academic-years')
        .set('Authorization', `Bearer ${directorB.token}`)
        .send({
          startYear: 2024,
          isActive: true,
        })
        .expect(201);
      yearB = { id: yearBRes.body.id ?? yearBRes.body?.data?.id };
    }
    await prisma.academicYear.updateMany({
      where: { orgId: orgB.id, id: { not: yearB.id } },
      data: { isCurrent: false },
    });
    await prisma.academicYear.update({
      where: { id: yearB.id },
      data: { isCurrent: true },
    });
    await prisma.academicYear.deleteMany({
      where: { orgId: orgB.id, id: { not: yearB.id } },
    });
    const currentCountB = await prisma.academicYear.count({
      where: { orgId: orgB.id, isCurrent: true },
    });
    if (currentCountB !== 1) {
      throw new Error(`Expected exactly one current year for orgB, got ${currentCountB}`);
    }

    const existingSectionB = await prisma.classSection.findFirst({
      where: { orgId: orgB.id, yearId: yearB.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existingSectionB) {
      classB1 = { id: existingSectionB.id };
    } else {
      const usedSectionsB = await prisma.classSection.findMany({
        where: { orgId: orgB.id, grade: 'GRADE_2' },
        select: { section: true },
      });
      const usedB = new Set(usedSectionsB.map((s) => s.section));
      const candidatesB = ['C', 'D', 'E', 'F', 'G'];
      const sectionB =
        candidatesB.find((s) => !usedB.has(s)) ?? `Y${Date.now()}`;
      const createdB = await prisma.classSection.create({
        data: {
          orgId: orgB.id,
          yearId: yearB.id,
          grade: 'GRADE_2',
          section: sectionB,
          label: `2.${sectionB}`,
        },
        select: { id: true },
      });
      classB1 = { id: createdB.id };
    }
    await prisma.organization.update({
      where: { id: orgB.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { studentId: studentA?.studentId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { id: studentA?.studentId } }).catch(() => {});
    await prisma.teacher.deleteMany({ where: { id: teacherA?.teacherId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: { in: [classA1?.id, classA2?.id, classB1?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: { in: [yearA?.id, yearB?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { userId: { in: [directorA?.userId, directorB?.userId, teacherA?.userId, studentA?.userId].filter(Boolean) } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [directorA?.userId, directorB?.userId, teacherA?.userId, studentA?.userId].filter(Boolean) } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgA?.id, orgB?.id].filter(Boolean) } } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('RBAC cache cannot leak director list to teacher/student', async () => {
    // Warm cache with director (full list)
    const warm = await request(app.getHttpServer())
      .get('/classrooms')
      .query({ academicYearId: yearA.id })
      .set('Authorization', `Bearer ${directorA.token}`);
    if (warm.status !== 200) {
      const currentCount = await prisma.academicYear.count({
        where: { orgId: orgA.id, isCurrent: true },
      });
      throw new Error(
        `Warm /classrooms failed: status=${warm.status} body=${JSON.stringify(
          warm.body,
        )} currentYears=${currentCount}`,
      );
    }
    expect(warm.body.data?.length ?? warm.body?.length).toBe(2);

    const teacherList = await request(app.getHttpServer())
      .get('/classrooms')
      .query({ academicYearId: yearA.id })
      .set('Authorization', `Bearer ${teacherA.token}`)
      .expect(200);
    const teacherData = teacherList.body.data ?? teacherList.body;
    expect(teacherData).toHaveLength(1);
    expect(teacherData[0].id).toBe(classA1.id);

    const studentList = await request(app.getHttpServer())
      .get('/classrooms')
      .query({ academicYearId: yearA.id })
      .set('Authorization', `Bearer ${studentA.token}`)
      .expect(200);
    const studentData = studentList.body.data ?? studentList.body;
    expect(studentData).toHaveLength(1);
    expect(studentData[0].id).toBe(classA1.id);
  });

  it('DB rejects cross-org enrollments on insert + update', async () => {
    await expect(
      prisma.enrollment.create({
        data: {
          studentId: studentA.studentId,
          classSectionId: classB1.id,
          yearId: yearB.id,
          orgId: orgB.id,
          status: 'ACTIVE',
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.enrollment.update({
        where: { id: enrollmentA1.id },
        data: {
          classSectionId: classB1.id,
          yearId: yearB.id,
          orgId: orgB.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('API blocks creating second active academic year (409), DB prevents direct SQL', async () => {
    const secondActive = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        startYear: 2026,
        isActive: true,
      })
      .expect(201);

    const activeCount = await prisma.academicYear.count({
      where: { orgId: orgA.id, isCurrent: true },
    });
    expect(activeCount).toBe(1);

    const passive = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        startYear: 2027,
        isActive: false,
      })
      .expect(201);

    const passiveId = passive.body.id ?? passive.body?.data?.id;

    await expect(
      prisma.academicYear.update({
        where: { id: passiveId },
        data: { isCurrent: true },
      }),
    ).rejects.toThrow();
  });
});
