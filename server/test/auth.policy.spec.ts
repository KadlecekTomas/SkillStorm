import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import {
  OrganizationRole,
  OrganizationType,
  PermissionKey,
  PrismaClient,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterMode } from '@/auth/dto/register.dto';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/auth/token-cookies';

jest.setTimeout(30000);

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

const cookieValue = (cookie: string | null) => {
  if (!cookie) return null;
  const token = cookie.split(';')[0]?.split('=')[1];
  return token ?? null;
};

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
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      for (const membershipId of createdMemberships) {
        await prisma.membership
          .delete({ where: { id: membershipId } })
          .catch(() => undefined);
      }
      for (const orgId of createdOrgs) {
        await prisma.organization
          .delete({ where: { id: orgId } })
          .catch(() => undefined);
      }
      for (const userId of createdUsers) {
        await prisma.user
          .delete({ where: { id: userId } })
          .catch(() => undefined);
      }
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  const expectSecureCookies = (cookies: string[] | undefined) => {
    expect(cookies).toBeDefined();
    const access = extractCookie(cookies, ACCESS_TOKEN_COOKIE);
    const refresh = extractCookie(cookies, REFRESH_TOKEN_COOKIE);
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Lax');
    if (process.env.NODE_ENV === 'production') {
      expect(access).toContain('Secure');
    }
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('SameSite=Lax');
    if (process.env.NODE_ENV === 'production') {
      expect(refresh).toContain('Secure');
    }
    return { access: access!, refresh: refresh! };
  };

  describe('Registration without systemRole', () => {
    const payload = {
      name: 'Policy Tester',
      email: `${unique()}@example.com`,
      password: 'SuperSafe123!',
      role: OrganizationRole.OWNER,
      mode: RegisterMode.CREATE_ORG,
    };
    let userId: string;
    let cookies: string[] | undefined;
    let accessToken: string | null = null;

    it('registers successfully and issues cookies (CREATE_ORG: user only, no org yet)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.organization).toBeNull();
      expect(res.body.membership).toBeNull();

      userId = res.body.user.id;
      createdUsers.push(userId);

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(dbUser?.systemRole).toBeNull();

      const dbMemberships = await prisma.membership.findMany({
        where: { userId },
      });
      expect(dbMemberships).toHaveLength(0);

      const raw = res.headers['set-cookie'];
      cookies = Array.isArray(raw) ? raw : raw ? [raw] : undefined;
      const { access } = expectSecureCookies(cookies);
      accessToken = cookieValue(access);
    });

    it('allows calling /auth/me with issued cookies', async () => {
      if (!accessToken) {
        throw new Error('Missing access token from registration');
      }
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.user.id).toBe(userId);
      expect(res.body.user.systemRole).toBeNull();
      expect(Array.isArray(res.body.user.memberships)).toBe(true);
      expect(res.body.user.memberships).toHaveLength(0);
      expect(res.body.user.needsOnboarding).toBe(true);
    });

    it('ignores provided systemRole in registration body', async () => {
      const payloadWithRole = {
        name: 'Policy Role Attempt',
        email: `${unique()}@example.com`,
        password: 'SuperSafe123!',
        role: OrganizationRole.OWNER,
        mode: RegisterMode.CREATE_ORG,
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
      expect(res.body.organization).toBeNull();
      expect(res.body.membership).toBeNull();
      createdUsers.push(res.body.user.id);
    });
  });

  describe('Login, refresh rotation, logout', () => {
    const creds = {
      name: 'Policy Login',
      email: `${unique()}@example.com`,
      password: 'Password123!',
      role: OrganizationRole.OWNER,
      mode: RegisterMode.CREATE_ORG,
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
    });

    it('logs in and stores hashed refresh tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: creds.email, password: creds.password })
        .expect(201);

      const loginRaw = res.headers['set-cookie'];
      loginCookies = Array.isArray(loginRaw) ? loginRaw : loginRaw ? [loginRaw] : undefined;
      const { access, refresh } = expectSecureCookies(loginCookies);
      refreshPlain = cookieValue(refresh);
      accessPlain = cookieValue(access);
      expect(refreshPlain).toBeTruthy();
      expect(accessPlain).toBeTruthy();
      if (!refreshPlain) {
        throw new Error('Missing refresh token cookie');
      }

      const tokens = await prisma.refreshToken.findMany({
        where: { userId },
      });
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some((t) => t.token === refreshPlain)).toBe(true);
      tokens.forEach((t) => {
        expect(t.token).toBeTruthy();
      });
    });

    it('rotates refresh tokens and revokes the old one', async () => {
      if (!refreshPlain) {
        throw new Error('Missing refresh token before rotation');
      }
      const oldToken = refreshPlain;
      const oldRow = await prisma.refreshToken.findFirst({
        where: { token: oldToken },
      });
      expect(oldRow).toBeTruthy();

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [`${REFRESH_TOKEN_COOKIE}=${refreshPlain}`])
        .expect(200);

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

      if (!refreshPlain) {
        throw new Error('Missing refresh token after rotation');
      }
      const newToken = refreshPlain;
      const newRow = await prisma.refreshToken.findFirst({
        where: { token: newToken },
      });
      expect(newRow).toBeTruthy();
    });

    it('revokes tokens on logout and blocks further access', async () => {
      if (!refreshPlain) {
        throw new Error('Missing refresh token before logout');
      }
      if (!accessPlain) {
        throw new Error('Missing access token before logout');
      }

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessPlain}`)
        .set('Cookie', [`${REFRESH_TOKEN_COOKIE}=${refreshPlain}`])
        .expect(201);

      const logoutToken = refreshPlain;
      const revokedRow = await prisma.refreshToken.findFirst({
        where: { token: logoutToken },
      });
      expect(revokedRow?.revokedAt).not.toBeNull();

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessPlain}`)
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
