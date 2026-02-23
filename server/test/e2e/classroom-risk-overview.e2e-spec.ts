/**
 * E2E: GET /classrooms/:id/risk-overview (Early Warning Panel)
 * - Deterministic risk: LOW_AVERAGE (<60%), INACTIVE (>14d), DECLINING (>10% drop)
 * - MEDIUM = 1 flag, HIGH = 2+ flags, NONE = 0
 * - Student role → 403, response has no PII
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import {
  $Enums,
  OrganizationRole,
  OrganizationType,
  EnrollmentStatus,
  SubmissionStatus,
} from '@prisma/client';
import { login, register, uniqueEmail } from 'test/helpers';
import { bootstrapOrg } from './helpers/bootstrap-org';

describe('Classroom Risk Overview (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let director: { id: string; token: string; login: { login: string; password: string } };
  let teacher: { id: string; token: string; membershipId: string; login: { login: string; password: string } };
  let studentUser: { id: string; token: string; login: { login: string; password: string } };
  let studentUserStudentId: string | undefined;

  let orgId: string;
  let yearId: string;
  let classSectionId: string;
  let teacherEntityId: string;
  let testId: string;
  let assignmentId: string;

  // Students in class (student entity id, membership id, userId, display name)
  const students: Array<{ studentId: string; membershipId: string; userId: string; name: string }> = [];

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

    const boot = await bootstrapOrg(prisma, {
      grade: $Enums.SchoolGrade.GRADE_6,
      section: 'A',
      classLabel: '6.A',
    });
    orgId = boot.orgId;
    yearId = boot.academicYearId;
    classSectionId = boot.classSectionId;

    const dirEmail = uniqueEmail('risk_dir');
    const dirPw = 'Password123!';
    const dirUser = await prisma.user.create({
      data: {
        email: dirEmail,
        username: `risk_dir_${Date.now()}`,
        name: 'E2E Director',
        passwordHash: await bcrypt.hash(dirPw, 10),
      },
      select: { id: true },
    });
    await prisma.membership.create({
      data: { userId: dirUser.id, organizationId: orgId, role: OrganizationRole.DIRECTOR },
    });
    director = {
      id: dirUser.id,
      token: await login(app, { email: dirEmail, password: dirPw, organizationId: orgId }),
      login: { login: dirEmail, password: dirPw },
    };

    const teachEmail = uniqueEmail('risk_teach');
    const teachPw = 'Password123!';
    const teachUser = await prisma.user.create({
      data: {
        email: teachEmail,
        username: `risk_teach_${Date.now()}`,
        name: 'E2E Teacher',
        passwordHash: await bcrypt.hash(teachPw, 10),
      },
      select: { id: true },
    });
    const teachMembership = await prisma.membership.create({
      data: { userId: teachUser.id, organizationId: orgId, role: OrganizationRole.TEACHER },
      select: { id: true },
    });
    teacherEntityId = (
      await prisma.teacher.create({
        data: { membershipId: teachMembership.id, organizationId: orgId },
        select: { id: true },
      })
    ).id;
    await prisma.classSection.update({
      where: { id: classSectionId },
      data: { teacherId: teacherEntityId },
    });
    teacher = {
      id: teachUser.id,
      token: await login(app, { email: teachEmail, password: teachPw, organizationId: orgId }),
      membershipId: teachMembership.id,
      login: { login: teachEmail, password: teachPw },
    };

    const studentEmail = uniqueEmail('risk_student');
    const studentPw = 'Password123!';
    const studentUserRow = await prisma.user.create({
      data: {
        email: studentEmail,
        username: `risk_stud_${Date.now()}`,
        name: 'E2E Student',
        passwordHash: await bcrypt.hash(studentPw, 10),
      },
      select: { id: true },
    });
    const studentMembership = await prisma.membership.create({
      data: { userId: studentUserRow.id, organizationId: orgId, role: OrganizationRole.STUDENT },
      select: { id: true },
    });
    const studentEntity = await prisma.student.create({
      data: { membershipId: studentMembership.id, orgId: orgId, studentNumber: 'R001' },
      select: { id: true },
    });
    studentUserStudentId = studentEntity.id;
    await prisma.enrollment.create({
      data: {
        studentId: studentEntity.id,
        classSectionId,
        yearId,
        orgId: orgId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    studentUser = {
      id: studentUserRow.id,
      token: await login(app, { email: studentEmail, password: studentPw, organizationId: orgId }),
      login: { login: studentEmail, password: studentPw },
    };

    const names: string[] = ['LowAvg', 'Inactive', 'Declining', 'HighRisk'];
    for (let i = 0; i < 4; i++) {
      const name = names[i]!;
      const u = await prisma.user.create({
        data: {
          email: uniqueEmail(`risk_s${i}`),
          username: `risk_s${i}_${Date.now()}`,
          name,
          passwordHash: await bcrypt.hash('Password123!', 10),
        },
        select: { id: true },
      });
      const m = await prisma.membership.create({
        data: { userId: u.id, organizationId: orgId, role: OrganizationRole.STUDENT },
        select: { id: true },
      });
      const st = await prisma.student.create({
        data: { membershipId: m.id, orgId: orgId, studentNumber: `R${100 + i}` },
        select: { id: true },
      });
      await prisma.enrollment.create({
        data: {
          studentId: st.id,
          classSectionId,
          yearId,
          orgId: orgId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      students.push({ studentId: st.id, membershipId: m.id, userId: u.id, name });
    }

    testId = (
      await prisma.test.create({
        data: {
          organizationId: orgId,
          title: 'Risk E2E Test',
          creatorId: teacher.membershipId,
          status: $Enums.PublishStatus.PUBLISHED,
        },
        select: { id: true },
      })
    ).id;

    assignmentId = (
      await prisma.assignment.create({
        data: {
          organizationId: orgId,
          yearId,
          testId,
          targetType: 'STUDENTS',
          openAt: new Date(Date.now() - 86400 * 30 * 1000),
          closeAt: new Date(Date.now() + 86400 * 365 * 1000),
          maxAttempts: 10,
          createdById: teacher.membershipId,
          students: {
            create: students.map((s) => ({ studentId: s.membershipId })),
          },
        },
        select: { id: true },
      })
    ).id;

    const now = new Date();
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400 * 1000);

    const s0 = students[0]!;
    const s1 = students[1]!;
    const s2 = students[2]!;
    const s3 = students[3]!;
    await prisma.submission.createMany({
      data: [
        { assignmentId, studentId: s0.membershipId, testId, score: 0.5, status: SubmissionStatus.APPROVED, submittedAt: new Date(now.getTime() - 60000), attemptNo: 1 },
        { assignmentId, studentId: s0.membershipId, testId, score: 0.5, status: SubmissionStatus.APPROVED, submittedAt: new Date(now.getTime() - 30000), attemptNo: 2 },
      ],
    });
    await prisma.submission.createMany({
      data: [
        { assignmentId, studentId: s1.membershipId, testId, score: 0.8, status: SubmissionStatus.APPROVED, submittedAt: twentyDaysAgo, attemptNo: 1 },
      ],
    });
    await prisma.submission.createMany({
      data: [
        { assignmentId, studentId: s2.membershipId, testId, score: 0.7, status: SubmissionStatus.APPROVED, submittedAt: new Date(now.getTime() - 120000), attemptNo: 1 },
        { assignmentId, studentId: s2.membershipId, testId, score: 0.7, status: SubmissionStatus.APPROVED, submittedAt: new Date(now.getTime() - 90000), attemptNo: 2 },
        { assignmentId, studentId: s2.membershipId, testId, score: 0.4, status: SubmissionStatus.APPROVED, submittedAt: new Date(now.getTime() - 60000), attemptNo: 3 },
        { assignmentId, studentId: s2.membershipId, testId, score: 0.4, status: SubmissionStatus.APPROVED, submittedAt: new Date(now.getTime() - 30000), attemptNo: 4 },
      ],
    });
    await prisma.submission.createMany({
      data: [
        { assignmentId, studentId: s3.membershipId, testId, score: 0.5, status: SubmissionStatus.APPROVED, submittedAt: twentyDaysAgo, attemptNo: 1 },
        { assignmentId, studentId: s3.membershipId, testId, score: 0.5, status: SubmissionStatus.APPROVED, submittedAt: new Date(twentyDaysAgo.getTime() + 60000), attemptNo: 2 },
      ],
    });
  });

  afterAll(async () => {
    if (assignmentId) await prisma.submission.deleteMany({ where: { assignmentId } }).catch(() => {});
    if (assignmentId) await prisma.assignment.deleteMany({ where: { id: assignmentId } }).catch(() => {});
    if (testId) await prisma.test.deleteMany({ where: { id: testId } }).catch(() => {});
    if (classSectionId) await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    const studentIds = [...students.map((s) => s.studentId), studentUserStudentId].filter((id): id is string => !!id);
    if (studentIds.length) await prisma.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {});
    const allUserIds = [director?.id, teacher?.id, studentUser?.id, ...students.map((s) => s.userId)].filter(Boolean) as string[];
    if (allUserIds.length) await prisma.refreshToken.deleteMany({ where: { userId: { in: allUserIds } } }).catch(() => {});
    if (orgId) await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    if (teacherEntityId) await prisma.teacher.deleteMany({ where: { id: teacherEntityId } }).catch(() => {});
    if (classSectionId) await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    if (yearId) await prisma.academicYear.deleteMany({ where: { id: yearId } }).catch(() => {});
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    if (allUserIds.length) await prisma.user.deleteMany({ where: { id: { in: allUserIds } } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('1) Student with low average (<60%) → MEDIUM', async () => {
    const res = await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    const body = res.body?.data ?? res.body;
    expect(body.classroomId).toBe(classSectionId);
    const lowAvg = body.students?.find((s: any) => s.displayName === 'LowAvg');
    expect(lowAvg).toBeDefined();
    expect(lowAvg.riskLevel).toBe('MEDIUM');
    expect(lowAvg.riskFlags).toContain('LOW_AVERAGE');
  });

  it('2) Student with inactivity >14 days → MEDIUM', async () => {
    const res = await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    const body = res.body?.data ?? res.body;
    const inactive = body.students?.find((s: any) => s.displayName === 'Inactive');
    expect(inactive).toBeDefined();
    expect(inactive.riskLevel).toBe('MEDIUM');
    expect(inactive.riskFlags).toContain('INACTIVE');
  });

  it('3) Student with decline >10% → MEDIUM', async () => {
    const res = await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    const body = res.body?.data ?? res.body;
    const declining = body.students?.find((s: any) => s.displayName === 'Declining');
    expect(declining).toBeDefined();
    expect(declining.riskLevel).toBe('MEDIUM');
    expect(declining.riskFlags).toContain('DECLINING');
  });

  it('4) Student with 2+ conditions → HIGH', async () => {
    const res = await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    const body = res.body?.data ?? res.body;
    const highRisk = body.students?.find((s: any) => s.displayName === 'HighRisk');
    expect(highRisk).toBeDefined();
    expect(highRisk.riskLevel).toBe('HIGH');
    expect(highRisk.riskFlags.length).toBeGreaterThanOrEqual(2);
  });

  it('5) Student role → 403', async () => {
    await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${studentUser.token}`)
      .expect(403);
  });

  it('6) Response contains no PII', async () => {
    const res = await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${director.token}`)
      .expect(200);
    const body = res.body?.data ?? res.body;
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('username');
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('systemRole');
    expect(body).not.toHaveProperty('audit');
    expect(body).not.toHaveProperty('membership');
    if (Array.isArray(body.students)) {
      for (const s of body.students) {
        expect(s).not.toHaveProperty('email');
        expect(s).not.toHaveProperty('username');
        expect(s).not.toHaveProperty('password');
        expect(s).not.toHaveProperty('systemRole');
        expect(s).not.toHaveProperty('tokenVersion');
        expect(s).toHaveProperty('studentId');
        expect(s).toHaveProperty('displayName');
        expect(s).toHaveProperty('averageScorePercent');
        expect(s).toHaveProperty('lastActivityAt');
        expect(s).toHaveProperty('trend');
        expect(s).toHaveProperty('riskLevel');
        expect(s).toHaveProperty('riskFlags');
      }
    }
  });

  it('7) Risk overview → student detail: teacher can open detail, response has no PII', async () => {
    const riskRes = await request(app.getHttpServer())
      .get(`/classrooms/${classSectionId}/risk-overview`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(200);
    const riskBody = riskRes.body?.data ?? riskRes.body;
    const first = riskBody?.students?.[0];
    expect(first?.studentId).toBeDefined();
    const studentId = first.studentId;

    const detailRes = await request(app.getHttpServer())
      .get(`/students/${studentId}/detail`)
      .set('Authorization', `Bearer ${teacher.token}`)
      .expect(200);
    const detail = detailRes.body?.data ?? detailRes.body;
    expect(detail).toHaveProperty('id', studentId);
    expect(detail).toHaveProperty('displayName');
    expect(detail).toHaveProperty('classroomLabel');
    expect(detail).toHaveProperty('performanceSummary');
    expect(detail).toHaveProperty('progressByTopic');
    expect(detail).toHaveProperty('recentTests');
    expect(detail).not.toHaveProperty('email');
    expect(detail).not.toHaveProperty('username');
    expect(detail).not.toHaveProperty('password');
    expect(detail).not.toHaveProperty('systemRole');
    expect(detail).not.toHaveProperty('tokenVersion');
  });
});
