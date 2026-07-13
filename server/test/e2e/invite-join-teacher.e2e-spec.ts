import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { authAs } from '../helpers';
import { InvitationType, OrganizationRole } from '@prisma/client';
import { RegisterMode } from '@/auth/dto/register.dto';

function uniqueEmail(prefix: string) {
  const stamp = Date.now();
  const rnd = Math.floor(Math.random() * 1e6);
  return `${prefix}.${stamp}.${rnd}@example.com`;
}

describe('Invite/join teacher flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('joins as teacher and appears in teachers list', async () => {
    const owner = await authAs(app, OrganizationRole.OWNER, {
      mode: RegisterMode.CREATE_ORG,
    });

    const teacherEmail = uniqueEmail('invite.teacher');
    const teacherPassword = 'Password123!';
    const teacherRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Invited Teacher',
        email: teacherEmail,
        username: `invited_${Date.now()}`,
        password: teacherPassword,
        mode: RegisterMode.CREATE_ORG,
        role: OrganizationRole.TEACHER,
      })
      .expect(201);

    const teacherToken =
      teacherRegister.body?.sessionToken ??
      teacherRegister.body?.data?.sessionToken;

    const inviteRes = await request(app.getHttpServer())
      .post('/invites')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        type: InvitationType.ORG_ONLY,
        role: OrganizationRole.TEACHER,
        expiresInDays: 7,
      })
      .expect(201);
    const inviteBody = inviteRes.body?.data ?? inviteRes.body;
    const inviteCode = inviteBody.code as string;

    await request(app.getHttpServer())
      .post('/invites/accept')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        code: inviteCode,
      })
      .expect(201);

    const teachersRes = await request(app.getHttpServer())
      .get('/teachers')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .query({ organizationId: owner.organization.id, page: 1, limit: 50 })
      .expect(200);

    const data = teachersRes.body?.data ?? teachersRes.body;
    const items = data?.items ?? [];
    const found = items.some(
      (teacher: any) => teacher?.membership?.user?.email === teacherEmail,
    );

    expect(found).toBe(true);
  });
});
