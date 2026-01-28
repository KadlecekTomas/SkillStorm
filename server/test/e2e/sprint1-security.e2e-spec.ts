import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
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
  const email = `${seed}-${Date.now()}@example.com`;
  const password = 'Password123!';
  const reg = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      name: `E2E ${seed}`,
      email,
      username: `${seed}-${Date.now()}`,
      password,
      role,
      mode: RegisterMode.JOIN_ORG,
      joinCode: orgId,
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

    // Create teacher entity for teacherA
    const teacherRes = await request(app.getHttpServer())
      .post('/teachers')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        membershipId: teacherA.membershipId,
        organizationId: orgA.id,
      })
      .expect(201);
    teacherA.teacherId = teacherRes.body.id ?? teacherRes.body?.data?.id ?? teacherRes.body?.teacherId;

    // Academic year A
    const yearRes = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: '2025/26',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isActive: true,
      })
      .expect(201);
    yearA = { id: yearRes.body.id ?? yearRes.body?.data?.id };

    // Class sections for org A
    const class1 = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        academicYearId: yearA.id,
        grade: 'GRADE_1',
        section: 'A',
        label: '1.A',
        teacherId: teacherA.teacherId,
      })
      .expect(201);
    classA1 = { id: class1.body.id ?? class1.body?.data?.id };

    const class2 = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        academicYearId: yearA.id,
        grade: 'GRADE_1',
        section: 'B',
        label: '1.B',
      })
      .expect(201);
    classA2 = { id: class2.body.id ?? class2.body?.data?.id };

    // Create student entity + enrollment for classA1
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

    const yearBRes = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorB.token}`)
      .send({
        name: '2024/25',
        startDate: '2024-09-01',
        endDate: '2025-06-30',
        isActive: true,
      })
      .expect(201);
    yearB = { id: yearBRes.body.id ?? yearBRes.body?.data?.id };

    const classB = await request(app.getHttpServer())
      .post('/classrooms')
      .set('Authorization', `Bearer ${directorB.token}`)
      .send({
        academicYearId: yearB.id,
        grade: 'GRADE_2',
        section: 'C',
        label: '2.C',
      })
      .expect(201);
    classB1 = { id: classB.body.id ?? classB.body?.data?.id };
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
      .set('Authorization', `Bearer ${directorA.token}`)
      .expect(200);
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
    const conflict = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: '2026/27',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        isActive: true,
      })
      .expect(409);

    expect(conflict.body?.error ?? conflict.body?.message).toBeDefined();

    const passive = await request(app.getHttpServer())
      .post('/academic-years')
      .set('Authorization', `Bearer ${directorA.token}`)
      .send({
        name: '2026/27',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
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
