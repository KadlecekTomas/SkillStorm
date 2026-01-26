// test/helpers.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { CSRF_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/auth/token-cookies';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterMode } from '@/auth/dto/register.dto';

/**
 * Generuje jednoduchý, ale dostatečně unikátní suffix.
 * Bez crypto, funguje v každém Node prostředí.
 */
function unique(prefix: string, seed = 'u') {
  const rnd = Math.floor(Math.random() * 1e9);
  return `${prefix}_${seed}_${Date.now()}_${rnd}`;
}

function uniqueIp() {
  const rnd = () => Math.floor(Math.random() * 250) + 1;
  return `10.${rnd()}.${rnd()}.${rnd()}`;
}

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

function getCookie(res: request.Response, name: string): string | null {
  const setCookie = res.headers?.['set-cookie'];
  if (!setCookie) return null;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const item of list) {
    const match = item.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

type AuthAsResult = {
  accessToken: string;
  refreshToken: string | null;
  csrfToken: string | null;
  user: any;
  organization: any;
  membership: any;
  login: { email: string; login: string; password: string };
  agent: request.SuperAgentTest;
};

type AuthAsOptions = {
  seed?: string;
  name?: string;
  role?: OrganizationRole;
  email?: string;
  username?: string;
  password?: string;
  mode?: RegisterMode;
};

/**
 * Unified auth helper for E2E.
 * - Registers user (creates org + membership)
 * - Logs in (returns access token + cookies)
 */
export async function authAs(
  app: INestApplication,
  role: OrganizationRole,
  options: AuthAsOptions = {},
): Promise<AuthAsResult> {
  const seed = options.seed ?? 'u';
  const tag = unique('e2e', seed);
  const safeTag = tag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const shortTag =
    safeTag.length > 32
      ? `${safeTag.slice(0, 16)}${safeTag.slice(-16)}`
      : safeTag;
  const email = options.email ?? `${shortTag}@example.com`;
  const password = options.password ?? 'Password123!';
  const payload = {
    name: options.name ?? `E2E User ${tag}`,
    email,
    username: options.username ?? shortTag,
    password,
    role,
    mode: options.mode ?? RegisterMode.CREATE_ORG,
  };

  const agent = request.agent(app.getHttpServer());
  const reg = await agent
    .post('/auth/register')
    .set('X-Forwarded-For', uniqueIp())
    .send(payload);
  if (reg.status !== 201) {
    throw new Error(
      `authAs register failed: ${reg.status} email=${email} ${JSON.stringify(
        reg.body,
      )}`,
    );
  }
  const regData = unwrapBody(reg);
  const prisma = app.get(PrismaService);
  if (
    payload.mode === RegisterMode.CREATE_ORG &&
    regData?.membership?.id &&
    role !== OrganizationRole.OWNER
  ) {
    await prisma.membership.update({
      where: { id: regData.membership.id },
      data: { role },
    });
    regData.membership = await prisma.membership.findUnique({
      where: { id: regData.membership.id },
      select: { id: true, role: true, organizationId: true },
    });
  }

  const loginRes = await agent
    .post('/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password });
  if (loginRes.status !== 201) {
    throw new Error(
      `authAs login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`,
    );
  }
  const loginData = unwrapBody(loginRes);

  return {
    accessToken: loginData?.sessionToken,
    refreshToken: getCookie(loginRes, REFRESH_TOKEN_COOKIE),
    csrfToken: getCookie(loginRes, CSRF_TOKEN_COOKIE),
    user: loginData?.user,
    organization: regData?.organization,
    membership: regData?.membership,
    login: { email, login: email, password },
    agent,
  };
}

/**
 * Registrace uživatele pro E2E testy.
 * - Vždy unikátní name/email/username
 * - 3 pokusy (pro případnou kolizi unikátních constraintů)
 */
export async function register(
  app: INestApplication,
  seed = 'u',
  nameOverride?: string,
) {
  let lastError: unknown = null;
  for (let i = 0; i < 3; i++) {
    const tag = unique('e2e', seed);
    try {
      const auth = await authAs(app, OrganizationRole.STUDENT, {
        seed: tag,
        name: nameOverride ?? `E2E User ${tag}`,
      });
      return {
        user: auth.user,
        accessToken: auth.accessToken,
        organization: auth.organization,
        membership: auth.membership,
        login: {
          email: auth.login.email,
          login: auth.login.email,
          password: auth.login.password,
        },
      };
    } catch (err) {
      lastError = err;
      // malý backoff a zkusíme jiné tagy
      await new Promise((r) => setTimeout(r, 50 + i * 50));
    }
  }
  throw new Error(`register() failed after 3 attempts: ${String(lastError)}`);
}

/**
 * Login helper – vrací access token.
 */
export async function login(
  app: INestApplication,
  creds: { email?: string; login?: string; password: string },
) {
  const email = creds.email ?? creds.login;
  if (!email) throw new Error('login() missing email');
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password: creds.password });

  if (res.status !== 201) {
    throw new Error(`login failed: ${res.status}`);
  }
  const data = unwrapBody(res);
  return data?.sessionToken as string;
}

type OrgContextRole = 'OWNER' | 'DIRECTOR' | 'TEACHER' | 'STUDENT';

type SetupOrgContextOptions = {
  role: OrgContextRole;
  seed?: string;
  name?: string;
  with?: {
    director?: boolean;
    teacher?: boolean;
    student?: boolean;
    superadmin?: boolean;
  };
};

type ActorContext = AuthAsResult & { membership?: any };

function normalizeRole(role: OrgContextRole): OrganizationRole {
  if (role === 'OWNER' || role === 'DIRECTOR') return OrganizationRole.DIRECTOR;
  if (role === 'TEACHER') return OrganizationRole.TEACHER;
  return OrganizationRole.STUDENT;
}

async function createUser(
  app: INestApplication,
  seed: string,
  name?: string,
): Promise<AuthAsResult> {
  const options: AuthAsOptions = { seed };
  if (name !== undefined) options.name = name;
  return authAs(app, OrganizationRole.STUDENT, options);
}

export async function createSystemUser(
  app: INestApplication,
  prisma: PrismaService,
  systemRole: SystemRole,
  seed = 'sys',
  name?: string,
): Promise<ActorContext> {
  const auth = await createUser(app, seed, name);
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { systemRole },
  });
  const token = await login(app, auth.login);
  return { ...auth, accessToken: token };
}

export async function setupOrgContext(
  app: INestApplication,
  prisma: PrismaService,
  options: SetupOrgContextOptions,
) {
  const seed = options.seed ?? 'ctx';
  const owner = await authAs(app, OrganizationRole.DIRECTOR, {
    seed: `${seed}_owner`,
    name: options.name ?? `E2E Owner ${seed}`,
  });
  const organization = owner.organization;

  const addMembershipForUser = async (
    userId: string,
    role: OrganizationRole,
  ) => {
    const existing = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: organization.id,
        },
      },
      select: { id: true, role: true, organizationId: true, userId: true },
    });
    if (existing) return existing;

    const res = await request(app.getHttpServer())
      .post('/memberships')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        organizationId: organization.id,
        userId,
        role,
      })
      .expect(201);
    return res.body;
  };

  const createUserForContext = async (
    memberSeed: string,
    name?: string,
  ): Promise<AuthAsResult> => {
    return createUser(app, `${seed}_${memberSeed}`, name);
  };

  const addMember = async (
    role: OrganizationRole,
    memberSeed: string,
    name?: string,
  ): Promise<ActorContext> => {
    const user = await createUserForContext(memberSeed, name);
    const membership = await addMembershipForUser(user.user.id, role);
    const token = await login(app, user.login);
    return { ...user, accessToken: token, membership };
  };

  const ctx: {
    organization: any;
    owner: ActorContext;
    actor: ActorContext;
    director?: ActorContext;
    teacher?: ActorContext;
    student?: ActorContext;
    superadmin?: ActorContext;
    createUser: typeof createUserForContext;
    addMember: typeof addMember;
    addMembershipForUser: typeof addMembershipForUser;
  } = {
    organization,
    owner,
    actor: owner,
    createUser: createUserForContext,
    addMember,
    addMembershipForUser,
  };

  const desiredRole = normalizeRole(options.role);
  if (desiredRole !== OrganizationRole.DIRECTOR) {
    const actor = await addMember(desiredRole, options.role.toLowerCase());
    ctx.actor = actor;
    if (desiredRole === OrganizationRole.TEACHER) ctx.teacher = actor;
    if (desiredRole === OrganizationRole.STUDENT) ctx.student = actor;
  }

  if (options.with?.director) {
    ctx.director = await addMember(OrganizationRole.DIRECTOR, 'director');
  }
  if (options.with?.teacher) {
    ctx.teacher = await addMember(OrganizationRole.TEACHER, 'teacher');
  }
  if (options.with?.student) {
    ctx.student = await addMember(OrganizationRole.STUDENT, 'student');
  }
  if (options.with?.superadmin) {
    const superadmin = await createSystemUser(
      app,
      prisma,
      SystemRole.SUPERADMIN,
      `${seed}_superadmin`,
    );
    superadmin.membership = await addMembershipForUser(
      superadmin.user.id,
      OrganizationRole.DIRECTOR,
    );
    superadmin.accessToken = await login(app, superadmin.login);
    ctx.superadmin = superadmin;
  }

  return ctx;
}
