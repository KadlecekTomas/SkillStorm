import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import {
  OrganizationRole,
  OrganizationType,
  PermissionKey,
  PrismaClient,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from 'src/auth/token-cookies';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const ensureDatabaseExists = async (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace('/', '');
  url.pathname = '/postgres';
  const admin = new PrismaClient({
    datasources: { db: { url: url.toString() } },
  });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } catch (error: any) {
    if (!String(error?.message).includes('already exists')) {
      await admin.$disconnect();
      throw error;
    }
  }
  await admin.$disconnect();
};

const extractCookie = (cookies: string[] | undefined, name: string) => {
  if (!cookies) return null;
  const entry = cookies.find((c) => c.startsWith(`${name}=`));
  return entry ?? null;
};

const cookieValue = (cookie: string | null) =>
  cookie ? cookie.split(';')[0].split('=')[1] ?? null : null;

describe('Auth & Role Policy (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moduleRef: TestingModule;
  const createdUsers: string[] = [];
  const createdOrgs: string[] = [];
  const createdMemberships: string[] = [];

  const unique = () => `policy_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not defined for tests');
    }
    await ensureDatabaseExists(databaseUrl);
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const membershipId of createdMemberships) {
      await prisma.membership.delete({ where: { id: membershipId } }).catch(() => undefined);
    }
    for (const orgId of createdOrgs) {
      await prisma.organization
        .delete({ where: { id: orgId } })
        .catch(() => undefined);
    }
    for (const userId of createdUsers) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  const expectSecureCookies = (cookies: string[] | undefined) => {
    expect(cookies).toBeDefined();
    const access = extractCookie(cookies, ACCESS_TOKEN_COOKIE);
    const refresh = extractCookie(cookies, REFRESH_TOKEN_COOKIE);
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Strict');
    expect(access).toContain('Secure');
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('SameSite=Strict');
    expect(refresh).toContain('Secure');
    return { access: access!, refresh: refresh! };
  };

  describe('Registration without systemRole', () => {
    const payload = {
      name: 'Policy Tester',
      email: `${unique()}@example.com`,
      password: 'SuperSafe123!',
    };
    let userId: string;
    let organizationId: string;
    let membershipId: string;
    let cookies: string[] | undefined;

    it('registers successfully and issues cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.organization).toBeDefined();
      expect(res.body.membership).toBeDefined();

      userId = res.body.user.id;
      organizationId = res.body.organization.id;
      membershipId = res.body.membership.id;
      createdUsers.push(userId);
      createdOrgs.push(organizationId);
      createdMemberships.push(membershipId);

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(dbUser?.systemRole).toBeNull();

      const dbOrg = await prisma.organization.findUnique({
        where: { id: organizationId },
      });
      expect(dbOrg?.type).toBe(OrganizationType.PRIVATE);

      const dbMembership = await prisma.membership.findUnique({
        where: { id: membershipId },
      });
      expect(dbMembership?.role).toBe(OrganizationRole.OWNER);

      const raw = res.headers['set-cookie'];
      cookies = Array.isArray(raw) ? raw : raw ? [raw] : undefined;
      expectSecureCookies(cookies);
    });

    it('allows calling /auth/me with issued cookies', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies ?? [])
        .expect(200);
      expect(res.body.id).toBe(userId);
      expect(res.body.systemRole).toBeNull();
      expect(Array.isArray(res.body.memberships)).toBe(true);
      expect(res.body.needsOnboarding).toBe(false);
    });

    it('ignores provided systemRole in registration body', async () => {
      const payloadWithRole = {
        name: 'Policy Role Attempt',
        email: `${unique()}@example.com`,
        password: 'SuperSafe123!',
        systemRole: 'SUPERADMIN',
      };
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payloadWithRole)
        .expect(201);

      const user = await prisma.user.findUnique({
        where: { id: res.body.user.id },
      });
      expect(user?.systemRole).toBeNull();
      createdUsers.push(res.body.user.id);
      createdOrgs.push(res.body.organization.id);
      createdMemberships.push(res.body.membership.id);
    });
  });

  describe('Login, refresh rotation, logout', () => {
    const creds = {
      name: 'Policy Login',
      email: `${unique()}@example.com`,
      password: 'Password123!',
    };
    let userId: string;
    let loginCookies: string[] | undefined;
    let refreshPlain: string | null = null;
    let accessPlain: string | null = null;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(creds)
        .expect(201);

      userId = res.body.user.id;
      createdUsers.push(userId);
      createdOrgs.push(res.body.organization.id);
      createdMemberships.push(res.body.membership.id);
    });

    it('logs in and stores hashed refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: creds.email, password: creds.password })
        .expect(201);

      const loginRaw = res.headers['set-cookie'];
      loginCookies = Array.isArray(loginRaw) ? loginRaw : loginRaw ? [loginRaw] : undefined;
      const { access, refresh } = expectSecureCookies(loginCookies);
      refreshPlain = cookieValue(refresh);
      accessPlain = cookieValue(access);
      expect(refreshPlain).toBeTruthy();
      expect(accessPlain).toBeTruthy();

      const tokens = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokens.length).toBeGreaterThan(0);
      tokens.forEach((t) => {
        expect(t.tokenHash).toBeTruthy();
        expect((t as any).token).toBeUndefined();
      });
    });

    it('rotates refresh tokens and revokes the old one', async () => {
      const oldHash = hashToken(refreshPlain!);
      const oldRow = await prisma.refreshToken.findFirst({
        where: { tokenHash: oldHash },
      });
      expect(oldRow).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshPlain })
        .expect(201);

      const refreshRaw = res.headers['set-cookie'];
      const cookies = Array.isArray(refreshRaw)
        ? refreshRaw
        : refreshRaw
        ? [refreshRaw]
        : undefined;
      const { refresh } = expectSecureCookies(cookies);
      const newPlain = cookieValue(refresh);
      expect(newPlain).toBeTruthy();
      refreshPlain = newPlain;

      const updatedOld = await prisma.refreshToken.findFirst({
        where: { id: oldRow!.id },
      });
      expect(updatedOld?.revokedAt).not.toBeNull();

      const newHash = hashToken(refreshPlain!);
      const newRow = await prisma.refreshToken.findFirst({
        where: { tokenHash: newHash },
      });
      expect(newRow).toBeTruthy();
    });

    it('revokes tokens on logout and blocks further access', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessPlain}`)
        .send({ refreshToken: refreshPlain })
        .expect(201);

      const logoutHash = hashToken(refreshPlain!);
      const revokedRow = await prisma.refreshToken.findFirst({
        where: { tokenHash: logoutHash },
      });
      expect(revokedRow?.revokedAt).not.toBeNull();

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [
          `${ACCESS_TOKEN_COOKIE}=${accessPlain}`,
          `${REFRESH_TOKEN_COOKIE}=${refreshPlain}`,
        ])
        .expect(401);
    });
  });

  describe('Permissions and system role isolation', () => {
    it('ensures role permission matrix matches policy', async () => {
      const expected: Partial<Record<OrganizationRole, PermissionKey[]>> = {
        DIRECTOR: [
          PermissionKey.MANAGE_TEACHERS,
          PermissionKey.MANAGE_STUDENTS,
          PermissionKey.VIEW_RESULTS,
          PermissionKey.CREATE_TEST,
          PermissionKey.EDIT_TEST,
          PermissionKey.DELETE_TEST,
          PermissionKey.VIEW_ANALYTICS,
        ],
        TEACHER: [
          PermissionKey.CREATE_TEST,
          PermissionKey.EDIT_TEST,
          PermissionKey.VIEW_RESULTS,
          PermissionKey.MANAGE_STUDENTS,
        ],
        STUDENT: [PermissionKey.VIEW_RESULTS],
        PARENT: [PermissionKey.VIEW_RESULTS],
      };

      const permissions = await prisma.permission.findMany({
        select: { id: true, key: true },
      });
      const permissionMap = new Map(permissions.map((p) => [p.key, p.id]));

      for (const [role, perms] of Object.entries(expected)) {
        for (const key of perms ?? []) {
          let permissionId = permissionMap.get(key);
          if (!permissionId) {
            const created = await prisma.permission.create({
              data: {
                key,
                description: key.replace(/_/g, ' '),
                allowedTypes: [],
              },
            });
            permissionId = created.id;
            permissionMap.set(key, permissionId);
          }
          const existing = await prisma.rolePermission.findFirst({
            where: {
              organizationId: null,
              role: role as OrganizationRole,
              permissionId,
            },
          });
          if (existing) {
            await prisma.rolePermission.update({
              where: { id: existing.id },
              data: { allowed: true },
            });
          } else {
            await prisma.rolePermission.create({
              data: {
                organizationId: null,
                role: role as OrganizationRole,
                permissionId,
                allowed: true,
              },
            });
          }
        }
      }

      const rows = await prisma.rolePermission.findMany({
        where: { organizationId: null, allowed: true },
        select: {
          role: true,
          permission: { select: { key: true } },
        },
      });

      const aggregated: Partial<Record<OrganizationRole, PermissionKey[]>> = {};

      rows.forEach((row) => {
        if (!aggregated[row.role]) {
          aggregated[row.role] = [];
        }
        aggregated[row.role]!.push(row.permission.key);
      });

      Object.entries(expected).forEach(([role, perms]) => {
        const actual = aggregated[role as OrganizationRole]?.sort() ?? [];
        const target = [...(perms ?? [])].sort();
        expect(actual).toEqual(target);
      });
    });

    it('ensures created users never receive privileged systemRole', async () => {
      const privileged = await prisma.user.count({
        where: {
          id: { in: createdUsers },
          systemRole: { not: null },
        },
      });
      expect(privileged).toBe(0);
    });
  });
});
