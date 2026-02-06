/**
 * E2E: Kontrakt mezi POST /auth/register a onboardingem (POST /organizations).
 *
 * Tyto testy NESMÍ projít, pokud:
 * - někdo přidá validaci organizationName do register (nebo ho začne vyžadovat),
 * - někdo začne vytvářet organization/membership v auth.service při mode=CREATE_ORG,
 * - POST /organizations přestane vyžadovat name nebo přestane vytvářet org + membership + AcademicYear.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditEntityType, OrganizationType } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';

describe('Register vs Onboarding contract (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const baseEmail = () =>
    `contract-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdUserIds.length || createdOrgIds.length) {
      await prisma.auditLog
        .deleteMany({
          where: {
            entityType: AuditEntityType.USER,
            OR: [
              { entityId: { in: createdUserIds } },
              { organizationId: { in: createdOrgIds } },
            ],
          },
        })
        .catch(() => {});

      await prisma.membership
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});

      await prisma.academicYear
        .deleteMany({ where: { orgId: { in: createdOrgIds } } })
        .catch(() => {});

      await prisma.organization
        .deleteMany({ where: { id: { in: createdOrgIds } } })
        .catch(() => {});

      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => {});
    }

    await prisma.$disconnect();
    await app.close();
  });

  const body = (res: request.Response) => res?.body?.data ?? res?.body;

  describe('POST /auth/register (CREATE_ORG)', () => {
    it('organizationName is optional – register without organizationName returns 201', async () => {
      const payload = {
        name: 'Owner No Org Name',
        email: baseEmail(),
        password: 'Password123!',
        username: 'owner_no_orgname',
        mode: RegisterMode.CREATE_ORG,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);

      const data = body(res);
      expect(data.user).toBeTruthy();
      expect(data.organization ?? null).toBeNull();
      expect(data.membership ?? null).toBeNull();

      const userId = data.user.id as string;
      createdUserIds.push(userId);

      const membershipCount = await prisma.membership.count({
        where: { userId },
      });
      expect(membershipCount).toBe(0);

      const logs = await prisma.auditLog.findMany({
        where: {
          action: 'REGISTER',
          entityType: AuditEntityType.USER,
          entityId: userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      expect(logs.length).toBe(1);
      const meta = (logs[0]!.metadata ?? {}) as Record<string, unknown>;
      expect(meta.onboardingState).toBe('CREATE_ORG_PENDING');
    });

    it('organizationName is ignored – register with organizationName still returns org null, membership null', async () => {
      const payload = {
        name: 'Owner With Org Name Field',
        email: baseEmail(),
        password: 'Password123!',
        username: 'owner_with_orgname',
        mode: RegisterMode.CREATE_ORG,
        organizationName: 'My School Should Be Ignored',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);

      const data = body(res);
      expect(data.user).toBeTruthy();
      expect(data.organization ?? null).toBeNull();
      expect(data.membership ?? null).toBeNull();

      const userId = data.user.id as string;
      createdUserIds.push(userId);

      const membershipCount = await prisma.membership.count({
        where: { userId },
      });
      expect(membershipCount).toBe(0);

      const orgCount = await prisma.organization.count({
        where: { ownerUserId: userId },
      });
      expect(orgCount).toBe(0);
    });
  });

  describe('POST /organizations (onboarding step)', () => {
    let token: string;

    beforeAll(async () => {
      const payload = {
        name: 'Onboarding User',
        email: baseEmail(),
        password: 'Password123!',
        username: 'onboarding_user',
        mode: RegisterMode.CREATE_ORG,
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);

      const data = body(res);
      createdUserIds.push(data.user.id);
      token = data.sessionToken;
      expect(token).toBeTruthy();
    });

    it('without name → 400', async () => {
      await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ type: OrganizationType.SCHOOL })
        .expect(400);
    });

    it('with valid name → 201, creates organization + membership + AcademicYear', async () => {
      const name = `Contract Org ${Date.now()}`;

      const res = await request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, type: OrganizationType.SCHOOL })
        .expect(201);

      const created = body(res);
      const orgId = created?.id ?? res.body?.id;
      expect(orgId).toBeTruthy();
      createdOrgIds.push(orgId);

      const [org, memberships, academicYears] = await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId } }),
        prisma.membership.findMany({ where: { organizationId: orgId } }),
        prisma.academicYear.findMany({ where: { orgId } }),
      ]);

      expect(org).toBeTruthy();
      expect(org!.name).toBe(name);
      expect(memberships.length).toBeGreaterThanOrEqual(1);
      expect(academicYears.length).toBeGreaterThanOrEqual(1);

      const activeYear = academicYears.find((y) => y.isCurrent);
      expect(activeYear).toBeTruthy();
    });
  });
});
