import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';

const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Owner parity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdMembershipIds: string[] = [];

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
    if (createdMembershipIds.length) {
      await prisma.membership
        .deleteMany({ where: { id: { in: createdMembershipIds } } })
        .catch(() => {});
    }
    if (createdOrgIds.length) {
      await prisma.organization
        .deleteMany({ where: { id: { in: createdOrgIds } } })
        .catch(() => {});
    }
    if (createdUserIds.length) {
      await prisma.refreshToken
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => {});
    }

    await prisma.$disconnect();
    await app.close();
  });

  it('OWNER can perform director-level actions (delete user in same org)', async () => {
    const ownerEmail = `owner-${unique()}@example.com`;
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Owner User',
        email: ownerEmail,
        username: `owner_${unique()}`,
        password: 'Password123!',
        mode: RegisterMode.CREATE_ORG,
      })
      .expect(201);

    const ownerBody = unwrap(ownerRes);
    const ownerToken = ownerBody.sessionToken as string;
    const ownerId = ownerBody.user.id as string;
    const orgId = ownerBody.organization.id as string;

    createdUserIds.push(ownerId);
    createdOrgIds.push(orgId);

    const memberEmail = `member-${unique()}@example.com`;
    const memberRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Member User',
        email: memberEmail,
        username: `member_${unique()}`,
        password: 'Password123!',
        mode: RegisterMode.INDIVIDUAL,
      })
      .expect(201);

    const memberBody = unwrap(memberRes);
    const memberId = memberBody.user.id as string;
    createdUserIds.push(memberId);

    const membership = await prisma.membership.create({
      data: {
        userId: memberId,
        organizationId: orgId,
        role: OrganizationRole.STUDENT,
      },
      select: { id: true },
    });
    createdMembershipIds.push(membership.id);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/users/${memberId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const deleteBody = unwrap(deleteRes);
    expect(deleteBody.user?.anonymized).toBe(true);
  });
});
