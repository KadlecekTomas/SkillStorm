import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { OrganizationRole, OrganizationStatus, SystemRole } from '@prisma/client';
import * as request from 'supertest';
import { RegisterMode } from '@/auth/dto/register.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AppModule } from '../../src/app.module';
import { authAs } from '../helpers';

function unwrap(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

const TEST_PASSWORD = 'AuthFreshness123!';

describe('GET /auth/me org activation freshness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let superadminToken: string;
  let superadminUserId: string;
  let ownerUserId: string;
  let ownerOrgId: string;

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

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const superadmin = await prisma.user.create({
      data: {
        email: `auth_me_fresh_superadmin_${Date.now()}@example.com`,
        name: 'Auth Freshness Superadmin',
        passwordHash,
        systemRole: SystemRole.SUPERADMIN,
      },
      select: { id: true, email: true },
    });
    superadminUserId = superadmin.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superadmin.email, password: TEST_PASSWORD })
      .expect(201);

    const token = (unwrap(loginRes) ?? loginRes.body)?.sessionToken as string | undefined;
    if (!token) {
      throw new Error('Missing superadmin token');
    }
    superadminToken = token;
  });

  afterAll(async () => {
    if (prisma && ownerOrgId) {
      await prisma.organization.deleteMany({ where: { id: ownerOrgId } }).catch(() => {});
    }
    if (prisma && (ownerUserId || superadminUserId)) {
      await prisma.user
        .deleteMany({
          where: {
            id: {
              in: [ownerUserId, superadminUserId].filter(Boolean) as string[],
            },
          },
        })
        .catch(() => {});
    }

    await prisma?.$disconnect().catch(() => {});
    await app?.close().catch(() => {});
  });

  it('returns ACTIVE immediately after SUPERADMIN activates a pending organization', async () => {
    const owner = await authAs(app, OrganizationRole.OWNER, {
      seed: `auth_me_fresh_${Date.now()}`,
      mode: RegisterMode.CREATE_ORG,
    });

    ownerUserId = owner.user?.id;
    ownerOrgId = owner.organization?.id;

    expect(ownerOrgId).toBeTruthy();

    const beforeMeRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const beforeMe = unwrap(beforeMeRes);
    expect(beforeMe?.organization).toBeDefined();
    expect(beforeMe.organization.id).toBe(ownerOrgId);
    expect(beforeMe.organization.status).toBe(OrganizationStatus.PENDING);

    const activateRes = await request(app.getHttpServer())
      .post(`/platform/organizations/${ownerOrgId}/activate`)
      .set('Authorization', `Bearer ${superadminToken}`)
      .expect(201);

    const activated = unwrap(activateRes);
    expect(activated?.id).toBe(ownerOrgId);
    expect(activated?.status).toBe(OrganizationStatus.ACTIVE);

    const dbOrg = await prisma.organization.findUnique({
      where: { id: ownerOrgId },
      select: { status: true },
    });
    expect(dbOrg?.status).toBe(OrganizationStatus.ACTIVE);

    const afterMeRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    const afterMe = unwrap(afterMeRes);
    expect(afterMe?.organization).toBeDefined();
    expect(afterMe.organization.id).toBe(ownerOrgId);
    expect(afterMe.organization.status).toBe(OrganizationStatus.ACTIVE);
  });
});
