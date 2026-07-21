import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { RbacPolicyService } from '@/modules/rbac/rbac-policy.service';
import { authAs, login } from 'test/helpers';
import {
  OrganizationRole,
  OrganizationStatus,
  PermissionKey,
} from '@prisma/client';

/**
 * INV4 — PARENT nesmí získat generické RBAC oprávnění přes UserPermission
 * (ani org-scoped, ani globální), ani přes RolePermission. Rodičovský přístup
 * je výhradně vztahový (GuardianStudentRelation / GuardianPermissionKey).
 * Viz docs/guardian.md, guardian-spec.md §9.
 */

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Guardian permission hardening — INV4 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let policy: RbacPolicyService;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    policy = app.get(RbacPolicyService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function orgWithMember(seed: string, role: OrganizationRole) {
    const owner = await authAs(app, OrganizationRole.OWNER, {
      seed: `${seed}_owner`,
    });
    await prisma.organization.update({
      where: { id: owner.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    const member = await authAs(app, OrganizationRole.STUDENT, {
      seed: `${seed}_member`,
    });
    const membership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: member.user.id,
          organizationId: owner.organization.id,
        },
      },
      update: { role, deletedAt: null },
      create: {
        userId: member.user.id,
        organizationId: owner.organization.id,
        role,
      },
      select: { id: true, role: true, organizationId: true, userId: true },
    });
    const memberToken = await login(app, {
      ...member.login,
      organizationId: owner.organization.id,
    });
    return { owner, member, membership, memberToken };
  }

  async function permissionId(key: PermissionKey): Promise<string> {
    const existing = await prisma.permission.findUnique({
      where: { key },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await prisma.permission.create({
      data: { key, description: key.replace(/_/g, ' '), allowedTypes: [] },
      select: { id: true },
    });
    return created.id;
  }

  /** Přímý zápis do user_permissions (obchází service guard — simuluje legacy/útok). */
  async function seedUserPermission(
    userId: string,
    organizationId: string | null,
    key: PermissionKey,
  ) {
    const permId = await permissionId(key);
    await prisma.userPermission.create({
      data: { userId, organizationId, permissionId: permId, allowed: true },
    });
  }

  const me = async (token: string) =>
    unwrap(
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200),
    );

  it('1) PARENT + org-scoped UserPermission(VIEW_TEST_OVERVIEW) → učitelský endpoint stále 403', async () => {
    const { membership, memberToken } = await orgWithMember(
      'inv4_scoped',
      OrganizationRole.PARENT,
    );
    await seedUserPermission(
      membership.userId,
      membership.organizationId,
      PermissionKey.VIEW_TEST_OVERVIEW,
    );

    // /subjects je jištěno pouze VIEW_TEST_OVERVIEW — čistá guard-level sonda.
    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    const profile = await me(memberToken);
    expect(profile.activeRole).toBe(OrganizationRole.PARENT);
    expect(profile.permissions).not.toContain(PermissionKey.VIEW_TEST_OVERVIEW);
  });

  it('2) PARENT + globální UserPermission(VIEW_TEST_OVERVIEW) → učitelský endpoint stále 403', async () => {
    const { membership, memberToken } = await orgWithMember(
      'inv4_global',
      OrganizationRole.PARENT,
    );
    await seedUserPermission(
      membership.userId,
      null, // globální grant
      PermissionKey.VIEW_TEST_OVERVIEW,
    );

    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    const profile = await me(memberToken);
    expect(profile.permissions).not.toContain(PermissionKey.VIEW_TEST_OVERVIEW);
  });

  it('3) resolver vrací pro aktivní PARENT roli nulovou generickou množinu', async () => {
    const { membership, memberToken } = await orgWithMember(
      'inv4_empty',
      OrganizationRole.PARENT,
    );
    // I s několika granty musí být efektivní generická množina prázdná.
    await seedUserPermission(
      membership.userId,
      membership.organizationId,
      PermissionKey.VIEW_RESULTS,
    );
    await seedUserPermission(
      membership.userId,
      null,
      PermissionKey.VIEW_SUBMISSIONS,
    );

    const profile = await me(memberToken);
    expect(profile.activeRole).toBe(OrganizationRole.PARENT);
    expect(profile.permissions).toEqual([]);
  });

  it('5) TEACHER si legitimní UserPermission override zachová (oprava nerozbila RBAC)', async () => {
    const { owner, membership, memberToken } = await orgWithMember(
      'inv4_teacher',
      OrganizationRole.TEACHER,
    );
    // MANAGE_TEACHERS není default pro TEACHER → čistý test overridu.
    const before = await me(memberToken);
    expect(before.permissions).not.toContain(PermissionKey.MANAGE_TEACHERS);

    // Legitimní grant přes service (TEACHER není PARENT-only → projde).
    await policy.grantUserPermission(
      { userId: owner.user.id, organizationId: membership.organizationId },
      {
        userId: membership.userId,
        organizationId: membership.organizationId,
        permissionKey: PermissionKey.MANAGE_TEACHERS,
      },
    );

    // Override se propíše do efektivních oprávnění (grant zneplatnil RBAC cache).
    const after = await me(memberToken);
    expect(after.permissions).toContain(PermissionKey.MANAGE_TEACHERS);
  });

  it('6) write-path: grant generického oprávnění PARENT-only membershipu skončí 403', async () => {
    const { owner, membership } = await orgWithMember(
      'inv4_write',
      OrganizationRole.PARENT,
    );

    await expect(
      policy.grantUserPermission(
        { userId: owner.user.id, organizationId: membership.organizationId },
        {
          userId: membership.userId,
          organizationId: membership.organizationId,
          permissionKey: PermissionKey.VIEW_RESULTS,
        },
      ),
    ).rejects.toMatchObject({ status: 403 });

    // A žádný takový grant nesmí v DB vzniknout.
    const leaked = await prisma.userPermission.findFirst({
      where: {
        userId: membership.userId,
        organizationId: membership.organizationId,
        permission: { key: PermissionKey.VIEW_RESULTS },
      },
    });
    expect(leaked).toBeNull();
  });
});
