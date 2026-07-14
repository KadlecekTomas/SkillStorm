// test/helpers.ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/auth/token-cookies';
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

function getAuthToken(res: request.Response): string | null {
  return (
    getCookie(res, ACCESS_TOKEN_COOKIE) ??
    res?.body?.data?.sessionToken ??
    res?.body?.sessionToken ??
    res?.body?.data?.accessToken ??
    res?.body?.accessToken ??
    null
  );
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
  if (payload.mode === RegisterMode.CREATE_ORG && !regData?.organization) {
    const bootstrapLoginRes = await agent
      .post('/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, password });
    if (bootstrapLoginRes.status !== 201) {
      throw new Error(
        `authAs bootstrap login failed: ${bootstrapLoginRes.status} ${JSON.stringify(
          bootstrapLoginRes.body,
        )}`,
      );
    }
    const bootstrapAccessToken = getAuthToken(bootstrapLoginRes);
    if (!bootstrapAccessToken) {
      throw new Error('authAs bootstrap login failed: missing access token');
    }
    const orgRes = await agent
      .post('/organizations')
      .set('Authorization', `Bearer ${bootstrapAccessToken}`)
      .send({ name: `Org ${tag}` });
    if (orgRes.status !== 201) {
      throw new Error(
        `authAs org create failed: ${orgRes.status} ${JSON.stringify(orgRes.body)}`,
      );
    }
    const orgData = unwrapBody(orgRes);
    regData.organization = orgData;
    regData.membership = await prisma.membership.findFirst({
      where: { userId: regData.user.id, organizationId: orgData.id },
      select: { id: true, role: true, organizationId: true },
    });
  }
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
  const accessToken = getAuthToken(loginRes);
  if (!accessToken) {
    throw new Error('authAs login failed: missing access token');
  }

  return {
    accessToken,
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
 * Pass organizationId to scope JWT to that org (user must be a member).
 */
export async function login(
  app: INestApplication,
  creds: {
    email?: string;
    login?: string;
    password: string;
    organizationId?: string;
  },
) {
  const email = creds.email ?? creds.login;
  if (!email) throw new Error('login() missing email');
  const body: { email: string; password: string; organizationId?: string } = {
    email,
    password: creds.password,
  };
  if (creds.organizationId) body.organizationId = creds.organizationId;
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .set('X-Forwarded-For', uniqueIp())
    .send(body);

  if (res.status !== 201) {
    throw new Error(`login failed: ${res.status}`);
  }
  const token = getAuthToken(res);
  if (!token) throw new Error('login failed: missing access token');
  return token;
}

/**
 * Creates a Subject usable for POST /tests in the given org.
 *
 * Subject is a GLOBAL entity (no organizationId column); org linkage is the
 * OrgSubject join row, and tests.service.validateSubject requires an enabled
 * OrgSubject in the caller's org. Older specs that did
 * `prisma.subject.create({ data: { organizationId } })` no longer compile.
 */
export async function createOrgSubject(
  prisma: PrismaService,
  organizationId: string,
  options: {
    name?: string;
    catalogSubjectId?: string;
    isEnabled?: boolean;
  } = {},
): Promise<{ subjectId: string; orgSubjectId: string }> {
  const subject = await prisma.subject.create({
    data: {
      name: options.name ?? `Subject ${unique('subj', 's')}`,
      ...(options.catalogSubjectId
        ? { catalogSubjectId: options.catalogSubjectId }
        : {}),
    },
    select: { id: true },
  });
  const orgSubject = await prisma.orgSubject.create({
    data: {
      organizationId,
      subjectId: subject.id,
      isEnabled: options.isEnabled ?? true,
    },
    select: { id: true },
  });
  return { subjectId: subject.id, orgSubjectId: orgSubject.id };
}

/**
 * Deterministic unique email for E2E to avoid 409 from duplicate email.
 */
export function uniqueEmail(prefix: string): string {
  const rnd = Math.floor(Math.random() * 1e9);
  const safe = `${prefix}_${Date.now()}_${rnd}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const short = safe.length > 32 ? `${safe.slice(0, 16)}${safe.slice(-16)}` : safe;
  return `${short}@example.com`;
}

/**
 * Switch JWT context to the given org. Returns new access token for that org.
 */
export async function useOrg(
  app: INestApplication,
  accessToken: string,
  orgId: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/use-org')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('X-Forwarded-For', uniqueIp())
    .send({ orgId })
    .expect(201);
  const token = getAuthToken(res);
  if (!token) throw new Error('useOrg: missing sessionToken in response');
  return token;
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
    const membership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId: organization.id,
        },
      },
      update: {
        role,
        deletedAt: null,
      },
      create: {
        userId,
        organizationId: organization.id,
        role,
      },
      select: { id: true, role: true, organizationId: true, userId: true },
    });
    return membership;
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
    const token = await login(app, {
      ...user.login,
      organizationId: organization.id,
    });
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
