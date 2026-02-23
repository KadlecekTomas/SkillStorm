import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';
import { addDays, subDays } from 'date-fns';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Auth registration invite guards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  const baseEmail = () =>
    `reg-invite-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const createInvite = async (
    orgId: string,
    role: OrganizationRole,
    overrides?: Partial<{ expiresAt: Date; usedCount: number; maxUses: number }>,
  ) => {
    const token = `invite_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const invite = await prisma.invite.create({
      data: {
        organizationId: orgId,
        token,
        code: `code_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
        role,
        expiresAt: overrides?.expiresAt ?? addDays(new Date(), 7),
        usedCount: overrides?.usedCount ?? 0,
        maxUses: overrides?.maxUses ?? 1,
      },
      select: { id: true, token: true },
    });
    return invite;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdUserIds.length || createdOrgIds.length) {
      await prisma.membership
        .deleteMany({ where: { userId: { in: createdUserIds } } })
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

  it('CREATE_ORG without invite -> 201 and onboarding creates OWNER membership', async () => {
    const email = baseEmail();
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner User',
        email,
        password: 'Password123!',
        username: `owner_${Date.now()}`,
        mode: RegisterMode.CREATE_ORG,
      })
      .expect(201);

    const registerBody = unwrapBody(registerRes);
    const userId = registerBody.user.id as string;
    createdUserIds.push(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });
    expect(user?.systemRole ?? null).toBeNull();

    const orgRes = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${registerBody.sessionToken}`)
      .send({ name: `Org ${Date.now()}` })
      .expect(201);

    const orgBody = unwrapBody(orgRes);
    const orgId = orgBody.id as string;
    createdOrgIds.push(orgId);

    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId: orgId },
      select: { role: true },
    });
    expect(membership?.role).toBe(OrganizationRole.OWNER);
  });

  it('JOIN_ORG without invite -> 403', async () => {
    const email = baseEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join User',
        email,
        password: 'Password123!',
        username: `join_${Date.now()}`,
        mode: RegisterMode.JOIN_ORG,
      })
      .expect(403);
  });

  it('JOIN_ORG with invalid invite -> 403', async () => {
    const email = baseEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join User',
        email,
        password: 'Password123!',
        username: `join_invalid_${Date.now()}`,
        mode: RegisterMode.JOIN_ORG,
        inviteToken: 'invalid-token',
      })
      .expect(403);
  });

  it('JOIN_ORG with valid invite -> 201, membership role/org from invite, invite usedCount incremented', async () => {
    const orgA = await prisma.organization.create({
      data: { name: `Invite Org A ${Date.now()}` },
      select: { id: true },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Invite Org B ${Date.now()}` },
      select: { id: true },
    });
    createdOrgIds.push(orgA.id, orgB.id);

    const invite = await createInvite(orgA.id, OrganizationRole.TEACHER);

    const email = baseEmail();
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join User',
        email,
        password: 'Password123!',
        username: `join_valid_${Date.now()}`,
        mode: RegisterMode.JOIN_ORG,
        inviteToken: invite.token,
      })
      .expect(201);

    const body = unwrapBody(res);
    const userId = body.user.id as string;
    createdUserIds.push(userId);

    const membership = await prisma.membership.findFirst({
      where: { userId },
      select: { role: true, organizationId: true },
    });
    expect(membership?.organizationId).toBe(orgA.id);
    expect(membership?.role).toBe(OrganizationRole.TEACHER);

    const usedInvite = await prisma.invite.findUnique({
      where: { id: invite.id },
      select: { usedCount: true },
    });
    expect(usedInvite?.usedCount).toBe(1);
  });

  it('JOIN_ORG with expired invite -> 403', async () => {
    const org = await prisma.organization.create({
      data: { name: `Expired Invite Org ${Date.now()}` },
      select: { id: true },
    });
    createdOrgIds.push(org.id);
    const invite = await createInvite(org.id, OrganizationRole.TEACHER, {
      expiresAt: subDays(new Date(), 1),
    });

    const email = baseEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join User',
        email,
        password: 'Password123!',
        username: `join_expired_${Date.now()}`,
        mode: RegisterMode.JOIN_ORG,
        inviteToken: invite.token,
      })
      .expect(403);
  });

  it('JOIN_ORG with used invite -> 403', async () => {
    const org = await prisma.organization.create({
      data: { name: `Used Invite Org ${Date.now()}` },
      select: { id: true },
    });
    createdOrgIds.push(org.id);
    const invite = await createInvite(org.id, OrganizationRole.TEACHER, {
      usedCount: 1,
      maxUses: 1,
    });

    const email = baseEmail();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join User',
        email,
        password: 'Password123!',
        username: `join_used_${Date.now()}`,
        mode: RegisterMode.JOIN_ORG,
        inviteToken: invite.token,
      })
      .expect(403);
  });
});
