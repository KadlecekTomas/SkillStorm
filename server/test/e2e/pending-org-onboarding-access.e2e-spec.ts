import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus, OrganizationType } from '@prisma/client';
import { login } from 'test/helpers';

describe('Pending Org Onboarding Access (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function createPendingOwnerContext() {
    const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const password = 'PendingOwner123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: `pending_owner_${tag}@example.com`,
        name: `Pending Owner ${tag}`,
        username: `pendingowner${tag}`.slice(0, 32),
        passwordHash,
      },
      select: { id: true, email: true },
    });

    const org = await prisma.organization.create({
      data: {
        name: `Pending School ${tag}`,
        type: OrganizationType.SCHOOL,
        status: OrganizationStatus.PENDING,
        ownerUserId: user.id,
      },
      select: { id: true },
    });

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: OrganizationRole.OWNER,
      },
      select: { id: true },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveMembershipId: membership.id },
    });

    const year = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: '2025/2026',
        startsAt: new Date('2025-09-01T00:00:00.000Z'),
        endsAt: new Date('2026-08-31T23:59:59.999Z'),
        isCurrent: true,
      },
      select: { id: true },
    });

    const token = await login(app, {
      email: user.email!,
      password,
      organizationId: org.id,
    });

    return {
      userId: user.id,
      orgId: org.id,
      yearId: year.id,
      token,
    };
  }

  async function cleanupContext(userId: string, orgId: string) {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }

  it('PENDING org can create first class and transitions to ACTIVE', async () => {
    const ctx = await createPendingOwnerContext();
    try {
      const res = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({
          yearId: ctx.yearId,
          grade: 'GRADE_5',
          section: 'A',
          label: '5.A',
        })
        .expect(201);

      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeDefined();
      expect(body?.yearId).toBe(ctx.yearId);

      const org = await prisma.organization.findUnique({
        where: { id: ctx.orgId },
        select: { status: true },
      });
      expect(org?.status).toBe(OrganizationStatus.ACTIVE);
    } finally {
      await cleanupContext(ctx.userId, ctx.orgId);
    }
  });

  it('PENDING org cannot access non-whitelisted execution routes', async () => {
    const ctx = await createPendingOwnerContext();
    try {
      const res = await request(app.getHttpServer())
        .get('/stats/overview')
        .set('Authorization', `Bearer ${ctx.token}`)
        .expect(409);

      const code =
        res.body?.meta?.code ??
        res.body?.code ??
        res.body?.message?.meta?.code;
      expect(code).toBe('ORG_PENDING');
    } finally {
      await cleanupContext(ctx.userId, ctx.orgId);
    }
  });

  it('@AllowPendingOrg routes bypass all global readiness/status guards', async () => {
    const ctx = await createPendingOwnerContext();
    try {
      const yearRes = await request(app.getHttpServer())
        .get('/academic-years/current')
        .set('Authorization', `Bearer ${ctx.token}`)
        .expect(200);

      const yearBody = yearRes.body?.data ?? yearRes.body;
      expect(yearBody?.id).toBe(ctx.yearId);

      const classRes = await request(app.getHttpServer())
        .post('/classrooms')
        .set('Authorization', `Bearer ${ctx.token}`)
        .send({
          yearId: ctx.yearId,
          grade: 'GRADE_6',
          section: 'B',
          label: '6.B',
        })
        .expect(201);

      const classBody = classRes.body?.data ?? classRes.body;
      expect(classBody?.id).toBeDefined();
    } finally {
      await cleanupContext(ctx.userId, ctx.orgId);
    }
  });
});
