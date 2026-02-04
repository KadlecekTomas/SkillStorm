/**
 * RBAC invariant: OWNER has full access to all org resources.
 *
 * - Owner → GET /classrooms → 200 (bypass, never 403 for permissions)
 * - Director without permission → 403
 * - Teacher without permission → 403
 * - Student without permission → 403
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, OrganizationStatus, PermissionKey } from '@prisma/client';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const PASSWORD = 'RbacOwner123!';

describe('RBAC Owner invariant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let permissionIds: { MANAGE_STUDENTS: string; VIEW_RESULTS: string };

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

    for (const key of [PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS]) {
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key.replace(/_/g, ' '), allowedTypes: [] },
      });
    }
    const perms = await prisma.permission.findMany({
      where: {
        key: { in: [PermissionKey.MANAGE_STUDENTS, PermissionKey.VIEW_RESULTS] },
      },
      select: { id: true, key: true },
    });
    const byKey = new Map(perms.map((p) => [p.key, p.id]));
    permissionIds = {
      MANAGE_STUDENTS: byKey.get(PermissionKey.MANAGE_STUDENTS)!,
      VIEW_RESULTS: byKey.get(PermissionKey.VIEW_RESULTS)!,
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Owner has full access (bypass)', () => {
    it('Owner → GET /classrooms?yearId= → 200', async () => {
      // CREATE_ORG does not create org at register time (onboarding later), so we create org + Owner manually
      const org = await prisma.organization.create({
        data: {
          name: `RBAC Owner Org ${Date.now()}`,
          status: OrganizationStatus.ACTIVE,
        },
        select: { id: true },
      });
      const year = await prisma.academicYear.create({
        data: {
          orgId: org.id,
          label: `Owner Year ${Date.now()}`,
          startsAt: new Date('2025-09-01'),
          endsAt: new Date('2026-08-31'),
          isCurrent: true,
        },
        select: { id: true },
      });
      // RequireOrgReadyGuard needs at least one ClassSection in active year
      await prisma.classSection.create({
        data: {
          orgId: org.id,
          yearId: year.id,
          grade: 'GRADE_7',
          section: 'A',
        },
      });
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      const user = await prisma.user.create({
        data: {
          email: `rbac_owner_${Date.now()}@example.com`,
          name: 'E2E Owner',
          passwordHash,
        },
        select: { id: true, email: true },
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

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(201);
      const token = unwrap(loginRes)?.sessionToken ?? loginRes.body?.sessionToken;
      if (!token) throw new Error('Missing token');

      const res = await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId: year.id })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const data = unwrap(res);
      expect(Array.isArray(data) || Array.isArray(data?.data)).toBe(true);
    });
  });

  describe('Non-owners require permission', () => {
    async function setupOrgWithRoleAndDeniedPermissions(
      role: OrganizationRole,
      seed: string,
    ): Promise<{ token: string; yearId: string }> {
      const org = await prisma.organization.create({
        data: {
          name: `RBAC Deny ${role} ${Date.now()}`,
          status: OrganizationStatus.ACTIVE,
        },
        select: { id: true },
      });
      const year = await prisma.academicYear.create({
        data: {
          orgId: org.id,
          label: '2025/2026',
          startsAt: new Date('2025-09-01'),
          endsAt: new Date('2026-08-31'),
          isCurrent: true,
        },
        select: { id: true },
      });
      await prisma.classSection.create({
        data: { orgId: org.id, yearId: year.id, grade: 'GRADE_7', section: 'A' },
      });
      const passwordHash = await bcrypt.hash(PASSWORD, 10);
      const user = await prisma.user.create({
        data: {
          email: `${seed}_${Date.now()}@example.com`,
          name: `E2E ${role}`,
          passwordHash,
        },
        select: { id: true, email: true },
      });
      const membership = await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role,
        },
        select: { id: true },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { lastActiveMembershipId: membership.id },
      });

      // Org-specific deny: override defaults so this role has no access to classrooms
      for (const permId of [permissionIds.MANAGE_STUDENTS, permissionIds.VIEW_RESULTS]) {
        await prisma.rolePermission.upsert({
          where: {
            organizationId_role_permissionId: {
              organizationId: org.id,
              role,
              permissionId: permId,
            },
          },
          create: {
            organizationId: org.id,
            role,
            permissionId: permId,
            allowed: false,
          },
          update: { allowed: false },
        });
      }

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(201);
      const token = unwrap(loginRes)?.sessionToken ?? loginRes.body?.sessionToken;
      if (!token) throw new Error('Missing token');
      return { token, yearId: year.id };
    }

    it('Director without permission → GET /classrooms → 403', async () => {
      const { token, yearId } = await setupOrgWithRoleAndDeniedPermissions(
        OrganizationRole.DIRECTOR,
        'rbac_dir_deny',
      );
      await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId })
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('Teacher without permission → GET /classrooms → 403', async () => {
      const { token, yearId } = await setupOrgWithRoleAndDeniedPermissions(
        OrganizationRole.TEACHER,
        'rbac_tea_deny',
      );
      await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId })
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('Student without permission → GET /classrooms → 403', async () => {
      const { token, yearId } = await setupOrgWithRoleAndDeniedPermissions(
        OrganizationRole.STUDENT,
        'rbac_stu_deny',
      );
      await request(app.getHttpServer())
        .get('/classrooms')
        .query({ yearId })
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
