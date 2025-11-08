import { Test } from '@nestjs/testing';
import { INestApplication, Controller, Get } from '@nestjs/common';
import * as request from 'supertest';
import { Permission } from '../permission.decorator';
import { PermissionKey } from '@prisma/client';
import { RbacGuard } from '../rbac.guard';
import { APP_GUARD } from '@nestjs/core';
import { RbacService } from '../rbac.service';

let currentUser: any = null;

@Controller('secure')
class SecureController {
  @Get()
  @Permission(PermissionKey.CREATE_TEST)
  read() {
    return { ok: true };
  }
}

describe('RbacGuard (e2e-like)', () => {
  let app: INestApplication;
  const canUser = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SecureController],
      providers: [
        { provide: RbacService, useValue: { canUser } },
        { provide: APP_GUARD, useClass: RbacGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req, _res, next) => {
      req.user = currentUser;
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    canUser.mockReset();
  });

  it('allows users with required permission', async () => {
    currentUser = { userId: 'teacher-1', organizationId: 'org-1' };
    canUser.mockResolvedValue(true);

    await request(app.getHttpServer()).get('/secure').expect(200);
    expect(canUser).toHaveBeenCalledWith(
      'teacher-1',
      'org-1',
      PermissionKey.CREATE_TEST,
    );
  });

  it('denies users without permission', async () => {
    currentUser = { userId: 'student-1', organizationId: 'org-1' };
    canUser.mockResolvedValue(false);

    await request(app.getHttpServer()).get('/secure').expect(403);
  });
});
