import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { authAs } from 'test/helpers';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Active academic year gate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let director: { token: string; orgId: string };
  let studentMembershipId: string;
  let classSectionId: string;
  let academicYearId: string;

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

    const auth = await authAs(app, OrganizationRole.DIRECTOR, { seed: 'gate_dir' });
    // must be ACTIVE — otherwise ORG_PENDING masks the year-gate under test
    await prisma.organization.update({
      where: { id: auth.organization.id },
      data: { status: 'ACTIVE' },
    });
    director = { token: auth.accessToken, orgId: auth.organization.id };

    const studentUser = await prisma.user.create({
      data: {
        email: `gate_student_${Date.now()}@example.com`,
        name: 'Gate Student',
        passwordHash: 'x',
      },
      select: { id: true },
    });

    const membership = await prisma.membership.create({
      data: {
        userId: studentUser.id,
        organizationId: director.orgId,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    studentMembershipId = membership.id;

    // the org bootstrap created a current year — the gate under test needs
    // an org with NO current year at all
    await prisma.academicYear.updateMany({
      where: { orgId: director.orgId },
      data: { isCurrent: false },
    });
    const year = await prisma.academicYear.create({
      data: {
        orgId: director.orgId,
        label: 'Gate 2026/27',
        startsAt: new Date('2026-09-01'),
        endsAt: new Date('2027-08-31'),
        isCurrent: false,
      },
      select: { id: true },
    });
    academicYearId = year.id;

    const cls = await prisma.classSection.create({
      data: {
        orgId: director.orgId,
        yearId: academicYearId,
        grade: 'GRADE_1',
        section: 'A',
        label: '1.A',
      },
      select: { id: true },
    });
    classSectionId = cls.id;
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { classSectionId } }).catch(() => {});
    await prisma.classSection.deleteMany({ where: { id: classSectionId } }).catch(() => {});
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { id: studentMembershipId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { contains: 'gate_student_' } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: director.orgId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('blocks year-scoped endpoints when there is no active year', async () => {
    const res = await request(app.getHttpServer())
      .post('/students')
      .set('Authorization', `Bearer ${director.token}`)
      .send({
        membershipId: studentMembershipId,
        orgId: director.orgId,
        academicYearId,
        classSectionId,
      })
      .expect(409);

    const body = unwrap(res);
    expect(body?.meta?.code).toBe('NO_CURRENT_ACADEMIC_YEAR');
  });

  // MULTIPLE_ACTIVE_ACADEMIC_YEARS is covered by unit test; DB unique index prevents it in e2e.
});
