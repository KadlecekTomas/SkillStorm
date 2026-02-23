import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { RegisterMode } from '@/auth/dto/register.dto';
import { OrganizationRole } from '@prisma/client';

function unwrapBody(res: request.Response) {
  return res?.body?.data ?? res?.body;
}

describe('Invite entry invariant (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks join without invite across all entry points', async () => {
    // Register an INDIVIDUAL user to obtain auth token
    const email = `inv-invariant-${Date.now()}@example.com`;
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Invariant User',
        email,
        password: 'Password123!',
        username: `inv_${Date.now()}`,
        mode: RegisterMode.INDIVIDUAL,
      })
      .expect(201);

    const registerBody = unwrapBody(registerRes);
    const token = registerBody.sessionToken as string;

    // Legacy join is disabled
    await request(app.getHttpServer())
      .post('/auth/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ joinCode: 'legacy-code', role: OrganizationRole.TEACHER })
      .expect(410);

    // Invite accept without token is forbidden
    await request(app.getHttpServer())
      .post('/invites/accept')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);

    // Register JOIN_ORG without invite is forbidden
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Join User',
        email: `join-no-invite-${Date.now()}@example.com`,
        password: 'Password123!',
        username: `join_${Date.now()}`,
        mode: RegisterMode.JOIN_ORG,
      })
      .expect(403);
  });
});
