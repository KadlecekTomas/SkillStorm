/**
 * E2E: Enrollment integrity (I3 — one enrollment per student per year)
 *
 * - Second enrollment attempt (same student, same year, different class) → 409
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus, SchoolGrade } from '@prisma/client';
import { bootstrapOrg } from './helpers/bootstrap-org';

const PASSWORD = 'EnrollIntegrity123!';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Enrollments integrity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directorToken: string;
  let orgId: string;
  let yearId: string;
  let class1Id: string;
  let class2Id: string;
  let studentId: string;

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

    const org = await prisma.organization.create({
      data: {
        name: `Enroll Integrity Org ${Date.now()}`,
        status: OrganizationStatus.ACTIVE,
      },
      select: { id: true },
    });
    orgId = org.id;

    const boot = await bootstrapOrg(prisma, {
      orgId: org.id,
      grade: SchoolGrade.GRADE_5,
      section: 'A',
    });
    yearId = boot.academicYearId;
    class1Id = boot.classSectionId;

    const class2 = await prisma.classSection.create({
      data: {
        orgId: org.id,
        yearId,
        grade: SchoolGrade.GRADE_5,
        section: 'B',
        label: '5.B',
      },
      select: { id: true },
    });
    class2Id = class2.id;

    const pwHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `enroll_dir_${Date.now()}@example.com`,
        name: 'Director',
        passwordHash: pwHash,
      },
      select: { id: true, email: true },
    });
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveMembershipId: membership.id },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: PASSWORD })
      .expect(201);
    directorToken = (unwrap(loginRes) ?? loginRes.body)?.sessionToken ?? loginRes.body?.sessionToken;
    if (!directorToken) throw new Error('Missing token');

    const studentUser = await prisma.user.create({
      data: {
        email: `enroll_stu_${Date.now()}@example.com`,
        name: 'Student',
        passwordHash: 'x',
      },
      select: { id: true },
    });
    const studentMembership = await prisma.membership.create({
      data: {
        userId: studentUser.id,
        organizationId: org.id,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: {
        membershipId: studentMembership.id,
        orgId: org.id,
      },
      select: { id: true },
    });
    studentId = student.id;

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classSectionId: class1Id,
        yearId,
        orgId: org.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.student.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { organizationId: orgId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { orgId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'enroll_dir_',
        },
      },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { contains: 'enroll_stu_' } },
    }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('POST /enrollments second enrollment same student same year (different class) → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/enrollments')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        studentId,
        classSectionId: class2Id,
        yearId,
      })
      .expect(409);

    expect(res.body?.message ?? res.body?.error).toBeDefined();
  });
});
