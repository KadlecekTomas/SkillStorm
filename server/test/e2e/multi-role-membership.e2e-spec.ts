import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { ACCESS_TOKEN_COOKIE } from '@/auth/token-cookies';
import { authAs, login } from 'test/helpers';
import {
  InvitationType,
  OrganizationRole,
  OrganizationStatus,
  Prisma,
} from '@prisma/client';

/**
 * Guardian Etapa A — multi-role membership (docs/guardian/etapa-a-analyza.md).
 * Kryje: assignment CRUD + eskalační pravidla, switch-role + scoping oprávnění
 * per aktivní role, okamžitou revokaci (401 na dalším requestu), STUDENT
 * exkluzivitu, invite add-role, zpětnou kompatibilitu single-role uživatelů
 * a DB-level invariant (deferred constraint trigger).
 */

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

function tokenFromCookies(res: request.Response): string {
  const setCookies: string[] = ([] as string[]).concat(
    (res.headers['set-cookie'] as unknown as string[]) ?? [],
  );
  const cookie = setCookies.find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
  if (!cookie) throw new Error('missing access token cookie');
  const value = cookie.split(';')[0]?.split('=')[1];
  if (!value) throw new Error('empty access token cookie');
  return decodeURIComponent(value);
}

describe('Multi-role membership (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  /** Owner org + člen s danou rolí (vlastní user, membership v owner org). */
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

  it('owner přiřadí PARENT učiteli, kontext se přepíná a oprávnění sledují aktivní roli', async () => {
    const { owner, member, membership } = await orgWithMember(
      'mr_ctx',
      OrganizationRole.TEACHER,
    );

    const assignRes = await request(app.getHttpServer())
      .post(`/memberships/${membership.id}/roles`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(201);
    expect(unwrap(assignRes)).toEqual(
      expect.arrayContaining([
        OrganizationRole.TEACHER,
        OrganizationRole.PARENT,
      ]),
    );

    // login po přiřazení: aktivní role = primární (TEACHER), roles nese obě
    const teacherToken = await login(app, {
      ...member.login,
      organizationId: membership.organizationId,
    });
    const me = unwrap(
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200),
    );
    expect(me.activeRole).toBe(OrganizationRole.TEACHER);
    expect(me.roles).toEqual(
      expect.arrayContaining([
        OrganizationRole.TEACHER,
        OrganizationRole.PARENT,
      ]),
    );

    // učitelský kontext vidí předměty (VIEW_TEST_OVERVIEW)
    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    // přepnutí na rodiče
    const switchRes = await request(app.getHttpServer())
      .post('/auth/switch-role')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(201);
    expect(unwrap(switchRes).activeRole).toBe(OrganizationRole.PARENT);
    const parentToken = tokenFromCookies(switchRes);

    // rodičovský kontext: PARENT nemá VIEW_TEST_OVERVIEW → 403
    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);

    // /me v rodičovském kontextu
    const meParent = unwrap(
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200),
    );
    expect(meParent.activeRole).toBe(OrganizationRole.PARENT);
    expect(meParent.user.organizationRole).toBe(OrganizationRole.PARENT);

    // lastActiveRole: nový login obnoví rodičovský kontext
    const reloginToken = await login(app, {
      ...member.login,
      organizationId: membership.organizationId,
    });
    const meRelogin = unwrap(
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${reloginToken}`)
        .expect(200),
    );
    expect(meRelogin.activeRole).toBe(OrganizationRole.PARENT);

    // přepnutí zpět na učitele
    const backRes = await request(app.getHttpServer())
      .post('/auth/switch-role')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(201);
    const teacherToken2 = tokenFromCookies(backRes);
    await request(app.getHttpServer())
      .get('/subjects')
      .set('Authorization', `Bearer ${teacherToken2}`)
      .expect(200);
  });

  it('revokace role zneplatní živý token okamžitě (401 ROLE_CONTEXT_REVOKED)', async () => {
    const { owner, membership, memberToken } = await orgWithMember(
      'mr_revoke',
      OrganizationRole.TEACHER,
    );
    await request(app.getHttpServer())
      .post(`/memberships/${membership.id}/roles`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(201);

    const switchRes = await request(app.getHttpServer())
      .post('/auth/switch-role')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(201);
    const parentToken = tokenFromCookies(switchRes);

    // rodičovský token funguje
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    // owner roli odebere
    await request(app.getHttpServer())
      .delete(`/memberships/${membership.id}/roles/PARENT`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    // TENTÝŽ token je od dalšího requestu mrtvý — žádné čekání na expiraci
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(401);
  });

  it('STUDENT je exkluzivní: nelze přidat roli žákovi ani žáka jiné roli; primární roli nelze revokovat', async () => {
    const student = await orgWithMember('mr_excl_s', OrganizationRole.STUDENT);
    await request(app.getHttpServer())
      .post(`/memberships/${student.membership.id}/roles`)
      .set('Authorization', `Bearer ${student.owner.accessToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(400);

    const teacher = await orgWithMember('mr_excl_t', OrganizationRole.TEACHER);
    await request(app.getHttpServer())
      .post(`/memberships/${teacher.membership.id}/roles`)
      .set('Authorization', `Bearer ${teacher.owner.accessToken}`)
      .send({ role: OrganizationRole.STUDENT })
      .expect(400);

    // primární role není revokovatelná
    await request(app.getHttpServer())
      .delete(`/memberships/${teacher.membership.id}/roles/TEACHER`)
      .set('Authorization', `Bearer ${teacher.owner.accessToken}`)
      .expect(400);
  });

  it('eskalační pravidla: DIRECTOR nepřiřadí DIRECTOR, self-assign jen PARENT, cross-org zakázán', async () => {
    const { owner, membership } = await orgWithMember(
      'mr_esc',
      OrganizationRole.TEACHER,
    );
    // director ve stejné org
    const director = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'mr_esc_dir',
    });
    const directorMembership = await prisma.membership.upsert({
      where: {
        userId_organizationId: {
          userId: director.user.id,
          organizationId: membership.organizationId,
        },
      },
      update: { role: OrganizationRole.DIRECTOR, deletedAt: null },
      create: {
        userId: director.user.id,
        organizationId: membership.organizationId,
        role: OrganizationRole.DIRECTOR,
      },
      select: { id: true },
    });
    const directorToken = await login(app, {
      ...director.login,
      organizationId: membership.organizationId,
    });

    // DIRECTOR nesmí přiřadit DIRECTOR (jen owner/superadmin)
    await request(app.getHttpServer())
      .post(`/memberships/${membership.id}/roles`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ role: OrganizationRole.DIRECTOR })
      .expect(403);

    // OWNER roli nelze spravovat vůbec
    await request(app.getHttpServer())
      .post(`/memberships/${membership.id}/roles`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ role: OrganizationRole.OWNER })
      .expect(403);

    // self-assign: TEACHER sobě 403, PARENT sobě 201
    await request(app.getHttpServer())
      .post(`/memberships/${directorMembership.id}/roles`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ role: OrganizationRole.TEACHER })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/memberships/${directorMembership.id}/roles`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(201);

    // cross-org owner → 403 (org ACTIVE, ať neuvázne na PENDING org gate)
    const foreignOwner = await authAs(app, OrganizationRole.OWNER, {
      seed: 'mr_esc_foreign',
    });
    await prisma.organization.update({
      where: { id: foreignOwner.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    await request(app.getHttpServer())
      .post(`/memberships/${membership.id}/roles`)
      .set('Authorization', `Bearer ${foreignOwner.accessToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(403);
  });

  it('switch-role na nepřiřazenou roli → 403; single-role uživatel funguje identicky', async () => {
    const { memberToken } = await orgWithMember(
      'mr_single',
      OrganizationRole.TEACHER,
    );
    await request(app.getHttpServer())
      .post('/auth/switch-role')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(403);

    const me = unwrap(
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200),
    );
    expect(me.activeRole).toBe(OrganizationRole.TEACHER);
    expect(me.roles).toEqual([OrganizationRole.TEACHER]);
  });

  it('invite accept nad existujícím membershipem: stejná role idempotentně, STUDENT kombinace 409, nová role přidá assignment', async () => {
    const { owner, member, membership, memberToken } = await orgWithMember(
      'mr_invite',
      OrganizationRole.TEACHER,
    );

    const createInvite = async (role: OrganizationRole) => {
      const res = await request(app.getHttpServer())
        .post('/invites')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ type: InvitationType.ORG_ONLY, role, expiresInDays: 7 })
        .expect(201);
      return unwrap(res).code as string;
    };

    // stejná role → idempotentní přijetí (původní chování), bez nového assignmentu
    const teacherInvite = await createInvite(OrganizationRole.TEACHER);
    await request(app.getHttpServer())
      .post('/invites/accept')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ code: teacherInvite })
      .expect(201);
    const afterSameRole = await prisma.membershipRoleAssignment.findMany({
      where: { membershipId: membership.id, deletedAt: null },
      select: { role: true },
    });
    expect(afterSameRole.map((r) => r.role)).toEqual([
      OrganizationRole.TEACHER,
    ]);

    // nová role (DIRECTOR invite) → assignment přibude
    const directorInvite = await createInvite(OrganizationRole.DIRECTOR);
    await request(app.getHttpServer())
      .post('/invites/accept')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ code: directorInvite })
      .expect(201);
    const roles = await prisma.membershipRoleAssignment.findMany({
      where: { membershipId: membership.id, deletedAt: null },
      select: { role: true },
    });
    expect(roles.map((r) => r.role)).toEqual(
      expect.arrayContaining([
        OrganizationRole.TEACHER,
        OrganizationRole.DIRECTOR,
      ]),
    );
    // primární role se nezměnila
    const fresh = await prisma.membership.findUnique({
      where: { id: membership.id },
      select: { role: true },
    });
    expect(fresh?.role).toBe(OrganizationRole.TEACHER);

    // žák + TEACHER invite → 409 (exkluzivita)
    const studentCtx = await orgWithMember(
      'mr_invite_s',
      OrganizationRole.STUDENT,
    );
    const teacherInvite2 = await (async () => {
      const res = await request(app.getHttpServer())
        .post('/invites')
        .set('Authorization', `Bearer ${studentCtx.owner.accessToken}`)
        .send({
          type: InvitationType.ORG_ONLY,
          role: OrganizationRole.TEACHER,
          expiresInDays: 7,
        })
        .expect(201);
      return unwrap(res).code as string;
    })();
    await request(app.getHttpServer())
      .post('/invites/accept')
      .set('Authorization', `Bearer ${studentCtx.memberToken}`)
      .send({ code: teacherInvite2 })
      .expect(409);

    void member;
  });

  it('DB invariant: raw SQL porušení spadnou na deferred triggeru; seedovaná data jsou konzistentní', async () => {
    const { membership } = await orgWithMember(
      'mr_db',
      OrganizationRole.STUDENT,
    );

    // STUDENT + TEACHER assignment → STUDENT_ROLE_EXCLUSIVE_VIOLATION při COMMIT
    await expect(
      prisma.$executeRaw`INSERT INTO membership_role_assignments (membership_role_assignment_id, membership_id, role) VALUES (gen_random_uuid(), ${membership.id}, 'TEACHER')`,
    ).rejects.toThrow(/STUDENT_ROLE_EXCLUSIVE_VIOLATION/);

    // soft-delete assignmentu primární role → MEMBERSHIP_PRIMARY_ROLE_VIOLATION
    await expect(
      prisma.$executeRaw`UPDATE membership_role_assignments SET deleted_at = now() WHERE membership_id = ${membership.id} AND role = 'STUDENT'`,
    ).rejects.toThrow(/MEMBERSHIP_PRIMARY_ROLE_VIOLATION/);

    // globální konzistence: žádný živý membership bez aktivního assignmentu primární role
    const violations = await prisma.$queryRaw<
      { membership_id: string }[]
    >(Prisma.sql`
      SELECT m.membership_id FROM memberships m
      WHERE m.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM membership_role_assignments a
          WHERE a.membership_id = m.membership_id
            AND a.role = m.role
            AND a.deleted_at IS NULL
        )
      LIMIT 5
    `);
    expect(violations).toEqual([]);
  });
});
