import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as request from 'supertest';
import { Permission } from '@/modules/rbac/permission.decorator';
import { OrganizationRole, PermissionKey } from '@prisma/client';
import { RbacGuard } from '@/modules/rbac/rbac.guard';
import { APP_GUARD } from '@nestjs/core';
import { RbacService } from '@/modules/rbac/rbac.service';
import { MetricsService } from '@/metrics/metrics.service';

let currentUser: any = null;

jest.setTimeout(30000);

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
        { provide: MetricsService, useValue: { recordForbiddenAccess: jest.fn().mockResolvedValue(undefined) } },
        { provide: APP_GUARD, useClass: RbacGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
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

  it('OWNER bypass: allows access without calling canUser', async () => {
    currentUser = {
      userId: 'owner-1',
      organizationId: 'org-1',
      organizationRole: OrganizationRole.OWNER,
    };
    canUser.mockClear();

    await request(app.getHttpServer()).get('/secure').expect(200);
    expect(canUser).not.toHaveBeenCalled();
  });
});
