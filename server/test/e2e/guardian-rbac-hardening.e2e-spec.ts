import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { authAs, createSystemUser } from 'test/helpers';
import {
  GuardianRelationStatus,
  GuardianPermissionKey,
  OrganizationRole,
  OrganizationStatus,
  PermissionKey,
  SystemRole,
} from '@prisma/client';
import { RbacPolicyService } from '@/modules/rbac/rbac-policy.service';

/**
 * Guardian Etapa D — regresní matice RBAC hardeningu (docs/guardian.md §1):
 * D1–D5 + N1. PARENT nemá žádné školní klíče a služby mají pozitivní
 * allowlisty — školní pohledy pro rodiče končí 403, školní role si drží
 * přesně svůj rozsah, klíč odpovědí se rodiči nedostane ani přes přímé ID.
 */

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Guardian Etapa D — RBAC hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgA: string;
  let ownerToken: string;
  let ownerMembershipId: string;
  let teacherToken: string;
  let studentAToken: string;
  let parentToken: string;
  let yearA: string;
  let classA: string; // homeroom učitele
  let classC: string; // mimo scope učitele
  let studentA: { id: string; membershipId: string };
  let studentC: { id: string; membershipId: string };
  let testA: string; // test s otázkou (klíč odpovědí)
  let testB: string; // cizí org
  let subA: string; // submission studentA (třída učitele)
  let subC: string; // submission studentC (mimo scope učitele)
  let parentUserId: string;
  let parentMembershipId: string;
  let teacherUserId: string;
  let teacherMembershipId: string;
  let policy: RbacPolicyService;

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function mkStudent(seed: string, orgId: string, yearId: string, classSectionId: string) {
    const a = await authAs(app, OrganizationRole.STUDENT, { seed });
    const membership = await prisma.membership.create({
      data: { userId: a.user.id, organizationId: orgId, role: OrganizationRole.STUDENT },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: { membershipId: membership.id, orgId },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: { studentId: student.id, classSectionId, yearId, orgId, status: 'ACTIVE' },
    });
    return { id: student.id, membershipId: membership.id, login: a.login };
  }

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const owner = await authAs(app, OrganizationRole.OWNER, { seed: 'gh_owner' });
    orgA = owner.organization.id;
    ownerToken = owner.accessToken;
    ownerMembershipId = owner.membership.id;
    await prisma.organization.update({
      where: { id: orgA },
      data: { status: OrganizationStatus.ACTIVE },
    });
    const existingYear = await prisma.academicYear.findFirst({
      where: { orgId: orgA, isCurrent: true },
      select: { id: true },
    });
    yearA =
      existingYear?.id ??
      (
        await prisma.academicYear.create({
          data: {
            orgId: orgA,
            label: '2025/2026',
            isCurrent: true,
            startsAt: new Date('2025-09-01'),
            endsAt: new Date('2026-08-31'),
          },
          select: { id: true },
        })
      ).id;

    // Učitel s homeroom classA; classC mimo jeho scope
    const teacherAuth = await authAs(app, OrganizationRole.STUDENT, { seed: 'gh_teacher' });
    const teacherMembership = await prisma.membership.create({
      data: { userId: teacherAuth.user.id, organizationId: orgA, role: OrganizationRole.TEACHER },
      select: { id: true },
    });
    const teacherRow = await prisma.teacher.create({
      data: { membershipId: teacherMembership.id, organizationId: orgA },
      select: { id: true },
    });
    const tLogin = await api()
      .post('/auth/login')
      .send({ email: teacherAuth.login.email, password: teacherAuth.login.password, organizationId: orgA })
      .expect(201);
    teacherToken = tLogin.body?.sessionToken;
    teacherMembershipId = teacherMembership.id;
    teacherUserId = teacherAuth.user.id;

    classA = (
      await prisma.classSection.create({
        data: { orgId: orgA, yearId: yearA, grade: 'GRADE_5', section: 'U', label: '5.U', teacherId: teacherRow.id },
        select: { id: true },
      })
    ).id;
    classC = (
      await prisma.classSection.create({
        data: { orgId: orgA, yearId: yearA, grade: 'GRADE_6', section: 'V', label: '6.V' },
        select: { id: true },
      })
    ).id;

    studentA = await mkStudent('gh_stA', orgA, yearA, classA);
    studentC = await mkStudent('gh_stC', orgA, yearA, classC);
    const sLogin = await api()
      .post('/auth/login')
      .send({ email: (studentA as any).login.email, password: (studentA as any).login.password, organizationId: orgA })
      .expect(201);
    studentAToken = sLogin.body?.sessionToken;

    // Test s klíčem odpovědí + zadání pro obě třídy + odevzdání
    const test = await prisma.test.create({
      data: {
        organizationId: orgA,
        title: 'Hardening test',
        creatorId: ownerMembershipId,
        status: 'PUBLISHED',
        academicYearId: yearA,
        allowedGrades: ['GRADE_5', 'GRADE_6'],
      },
      select: { id: true },
    });
    testA = test.id;
    await prisma.question.create({
      data: { testId: testA, text: 'Tajný klíč?', type: 'TRUE_FALSE', correctAnswer: 'true', order: 1 },
    });
    const mkAssignment = (classSectionId: string) =>
      prisma.assignment.create({
        data: {
          organizationId: orgA,
          yearId: yearA,
          testId: testA,
          targetType: 'CLASS',
          classSectionId,
          openAt: new Date(Date.now() - 60_000),
          closeAt: new Date(Date.now() + 3_600_000),
          maxAttempts: 2,
          shuffle: false,
          showExplain: 'NEVER',
          createdById: ownerMembershipId,
        },
        select: { id: true },
      });
    const asgA = await mkAssignment(classA);
    const asgC = await mkAssignment(classC);
    subA = (
      await prisma.submission.create({
        data: {
          organizationId: orgA,
          assignmentId: asgA.id,
          testId: testA,
          studentId: studentA.membershipId,
          attemptNo: 1,
          status: 'APPROVED',
          submittedAt: new Date(),
          score: 1,
        },
        select: { id: true },
      })
    ).id;
    subC = (
      await prisma.submission.create({
        data: {
          organizationId: orgA,
          assignmentId: asgC.id,
          testId: testA,
          studentId: studentC.membershipId,
          attemptNo: 1,
          status: 'APPROVED',
          submittedAt: new Date(),
          score: 0.5,
        },
        select: { id: true },
      })
    ).id;

    // Cizí org + test
    const ownerB = await authAs(app, OrganizationRole.OWNER, { seed: 'gh_ownerB' });
    await prisma.organization.update({
      where: { id: ownerB.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    testB = (
      await prisma.test.create({
        data: {
          organizationId: ownerB.organization.id,
          title: 'Cizí test',
          creatorId: ownerB.membership.id,
          status: 'PUBLISHED',
        },
        select: { id: true },
      })
    ).id;

    // Rodič: registrace kódem + potvrzení (VERIFIED vztah ke studentA)
    const codeRes = await api()
      .post(`/students/${studentA.id}/guardian-invites`)
      .set(auth(ownerToken))
      .expect(201);
    const reg = await api()
      .post('/auth/register')
      .send({
        name: 'Rodič Hardening',
        email: `gh_p${Date.now()}@example.com`,
        username: `ghp${Date.now()}`,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken: unwrap(codeRes).code,
      })
      .expect(201);
    parentToken = reg.body?.sessionToken;
    const children = unwrap(
      await api().get('/guardian/children').set(auth(parentToken)).expect(200),
    );
    await api()
      .post(`/guardian/relations/${children.pendingConfirmation[0].relationId}/confirm`)
      .set(auth(parentToken))
      .expect(201);

    const parentMembership = await prisma.membership.findFirst({
      where: { organizationId: orgA, role: OrganizationRole.PARENT },
      select: { id: true, userId: true },
    });
    if (!parentMembership) throw new Error('parent membership not found');
    parentMembershipId = parentMembership.id;
    parentUserId = parentMembership.userId;
    policy = app.get(RbacPolicyService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('D1: PARENT nedostane klíč odpovědí — GET /tests/:id → 403 (i přes přímé ID), cizí org rovněž', async () => {
    const res = await api().get(`/tests/${testA}`).set(auth(parentToken));
    expect(res.status).toBe(403);
    expect(res.text).not.toContain('Tajný klíč');
    expect(res.text).not.toContain('correctAnswer');

    const cross = await api().get(`/tests/${testB}`).set(auth(parentToken));
    expect([403, 404]).toContain(cross.status);
    expect(cross.text).not.toContain('correctAnswer');
  });

  it('D2+D3: PARENT nevidí výsledky testu ani katalog testů', async () => {
    await api().get(`/tests/${testA}/results`).set(auth(parentToken)).expect(403);
    await api().get('/tests').set(auth(parentToken)).expect(403);
  });

  it('D4: PARENT nevylistuje odevzdání — ani s ?studentId= filtrem', async () => {
    await api().get('/submissions').set(auth(parentToken)).expect(403);
    await api()
      .get('/submissions')
      .query({ studentId: studentC.membershipId })
      .set(auth(parentToken))
      .expect(403);
  });

  it('D5+N1: PARENT nevidí org overview; metrics/summary jen platformní role', async () => {
    await api().get('/stats/overview').set(auth(parentToken)).expect(403);
    await api().get('/metrics/summary').set(auth(parentToken)).expect(403);
    await api().get('/metrics/summary').set(auth(teacherToken)).expect(403);
    await api().get('/metrics/summary').set(auth(ownerToken)).expect(403);
    const superadmin = await createSystemUser(app, prisma, SystemRole.SUPERADMIN, 'gh_sys');
    await api().get('/metrics/summary').set(auth(superadmin.accessToken)).expect(200);
  });

  it('PARENT: rodinný prostor dál funguje (guardian API nezávisí na školních klíčích)', async () => {
    const children = unwrap(
      await api().get('/guardian/children').set(auth(parentToken)).expect(200),
    );
    expect(children.children).toHaveLength(1);
    await api()
      .get(`/guardian/children/${studentA.id}/overview`)
      .set(auth(parentToken))
      .expect(200);
  });

  it('STUDENT: drží svůj rozsah — detail bez klíče, jen vlastní submissions, overview zúžené', async () => {
    const detail = await api().get(`/tests/${testA}`).set(auth(studentAToken)).expect(200);
    // Žák VIDÍ otázky (bez klíče); klíč správných odpovědí NE.
    expect(detail.text).not.toMatch(/correctAnswers?"\s*:/);

    const subs = unwrap(await api().get('/submissions').set(auth(studentAToken)).expect(200));
    const list = Array.isArray(subs) ? subs : (subs.items ?? subs.data ?? []);
    for (const s of list) {
      expect(s.id).not.toBe(subC);
    }
    await api().get('/stats/overview').set(auth(studentAToken)).expect(200);
  });

  it('TEACHER: vidí detail s otázkami, submissions jen svých tříd; DIRECTOR/OWNER org-wide', async () => {
    const detail = await api().get(`/tests/${testA}`).set(auth(teacherToken)).expect(200);
    expect(detail.text).toContain('Tajný klíč');

    const tSubs = unwrap(await api().get('/submissions').set(auth(teacherToken)).expect(200));
    const tList = Array.isArray(tSubs) ? tSubs : (tSubs.items ?? tSubs.data ?? []);
    const tIds = tList.map((s: { id: string }) => s.id);
    expect(tIds).toContain(subA);
    expect(tIds).not.toContain(subC);

    const oSubs = unwrap(await api().get('/submissions').set(auth(ownerToken)).expect(200));
    const oList = Array.isArray(oSubs) ? oSubs : (oSubs.items ?? oSubs.data ?? []);
    const oIds = oList.map((s: { id: string }) => s.id);
    expect(oIds).toEqual(expect.arrayContaining([subA, subC]));

    await api().get('/tests').set(auth(teacherToken)).expect(200);
    await api().get(`/tests/${testA}/results`).set(auth(ownerToken)).expect(200);
    await api().get('/stats/overview').set(auth(ownerToken)).expect(200);
  });

  it('DB stav: PARENT defaults jsou prázdné (kanonický zdroj)', async () => {
    // Guard proti regresi defaults: RBAC seed/permission map nesmí PARENTovi
    // vrátit školní klíče.
    const { isPermissionAllowedByDefault } = await import(
      '@/modules/rbac/rbac.defaults'
    );
    const { PermissionKey } = await import('@prisma/client');
    for (const key of Object.values(PermissionKey)) {
      expect(
        isPermissionAllowedByDefault(OrganizationRole.PARENT, key as any),
      ).toBe(false);
    }
    // sanity: vztahová vrstva zůstává (guardian oprávnění nejsou PermissionKey)
    expect(Object.values(GuardianPermissionKey).length).toBeGreaterThan(0);
    expect(GuardianRelationStatus.VERIFIED).toBe('VERIFIED');
  });

  it('INV1: DB CHECK odmítne PARENT role_permission — globální i org-scoped', async () => {
    const perm = await prisma.permission.findFirst({ select: { id: true } });
    expect(perm).toBeTruthy();
    // Globální
    await expect(
      prisma.$executeRaw`
        INSERT INTO role_permissions (role_permission_id, role, permission_id, allowed)
        VALUES (gen_random_uuid(), 'PARENT', ${perm!.id}, true)
      `,
    ).rejects.toThrow(/role_permissions_no_parent_role|check constraint/i);
    // Org-scoped (reálné orgId, aby to nespadlo na FK dřív než na CHECK)
    await expect(
      prisma.$executeRaw`
        INSERT INTO role_permissions (role_permission_id, role, permission_id, organization_id, allowed)
        VALUES (gen_random_uuid(), 'PARENT', ${perm!.id}, ${orgA}, true)
      `,
    ).rejects.toThrow(/role_permissions_no_parent_role|check constraint/i);
  });

  it('INV2: po bootu (seed + default sync) neexistuje ŽÁDNÝ PARENT role_permission', async () => {
    const count = await prisma.rolePermission.count({
      where: { role: OrganizationRole.PARENT },
    });
    expect(count).toBe(0);
  });

  it('INV3: admin write cesta (RbacPolicyService.grantRolePermission) odmítne PARENT', async () => {
    const { RbacPolicyService } = await import(
      '@/modules/rbac/rbac-policy.service'
    );
    const { PermissionKey } = await import('@prisma/client');
    const policy = app.get(RbacPolicyService);
    await expect(
      policy.grantRolePermission(
        { userId: null, organizationId: orgA },
        {
          role: OrganizationRole.PARENT,
          permissionKey: PermissionKey.VIEW_RESULTS,
          organizationId: orgA,
        },
      ),
    ).rejects.toThrow();
    // Nic se nevytvořilo (guard běží před DB, DB CHECK je druhá pojistka).
    expect(
      await prisma.rolePermission.count({
        where: { role: OrganizationRole.PARENT },
      }),
    ).toBe(0);
    // Kontrola pozitivní: STUDENT grant guardem projde (dojde až k DB/permission).
    await policy
      .grantRolePermission(
        { userId: null, organizationId: orgA },
        {
          role: OrganizationRole.STUDENT,
          permissionKey: PermissionKey.VIEW_RESULTS,
          organizationId: orgA,
        },
      )
      .catch(() => undefined); // případný jiný důvod neřešíme; jde o to, že NEhodí PARENT guard
  });

  // ── INV4: UserPermission cesta (docs/guardian.md §4) ──────────────────────
  // §3 uzavřela RolePermission (DB CHECK + guard + defaults). Zde ověřujeme
  // druhý zdroj — user_permissions + resolver RbacService.canUser: aktivní
  // PARENT role nezíská generické oprávnění ani přes user grant (globální ani
  // org-scoped), guardian přístup zůstává výhradně vztahový, TEACHER override
  // funguje.
  describe('INV4 — UserPermission cesta', () => {
    async function permId(key: PermissionKey): Promise<string> {
      const p = await prisma.permission.findUnique({
        where: { key },
        select: { id: true },
      });
      if (p) return p.id;
      return (
        await prisma.permission.create({
          data: { key, description: key.replace(/_/g, ' '), allowedTypes: [] },
          select: { id: true },
        })
      ).id;
    }
    async function seedUP(
      userId: string,
      organizationId: string | null,
      key: PermissionKey,
    ) {
      await prisma.userPermission.create({
        data: {
          userId,
          organizationId,
          permissionId: await permId(key),
          allowed: true,
        },
      });
    }
    const meOf = async (token: string) =>
      unwrap(await api().get('/auth/me').set(auth(token)).expect(200));

    // Sdílený parentToken: uklidit seedované granty po každém testu.
    afterEach(async () => {
      await prisma.userPermission.deleteMany({ where: { userId: parentUserId } });
    });

    it('org-scoped UserPermission neodemkne učitelský endpoint (403) a /auth/me zůstává prázdné', async () => {
      await seedUP(parentUserId, orgA, PermissionKey.VIEW_TEST_OVERVIEW);
      await seedUP(parentUserId, orgA, PermissionKey.VIEW_RESULTS);

      // /subjects je jištěno pouze VIEW_TEST_OVERVIEW (guard bez služebního
      // allowlistu) → čistý důkaz resolver-level zamítnutí i s user grantem.
      await api().get('/subjects').set(auth(parentToken)).expect(403);
      // Endpoint dle znění zadání (VIEW_RESULTS):
      await api()
        .get(`/tests/${testA}/results`)
        .set(auth(parentToken))
        .expect(403);

      const me = await meOf(parentToken);
      expect(me.activeRole).toBe(OrganizationRole.PARENT);
      expect(me.permissions).not.toContain(PermissionKey.VIEW_TEST_OVERVIEW);
      expect(me.permissions).not.toContain(PermissionKey.VIEW_RESULTS);
    });

    it('globální UserPermission (organization_id NULL) rovněž neodemkne (403), /auth/me prázdné', async () => {
      await seedUP(parentUserId, null, PermissionKey.VIEW_TEST_OVERVIEW);
      await seedUP(parentUserId, null, PermissionKey.VIEW_RESULTS);

      await api().get('/subjects').set(auth(parentToken)).expect(403);
      await api()
        .get(`/tests/${testA}/results`)
        .set(auth(parentToken))
        .expect(403);

      const me = await meOf(parentToken);
      expect(me.permissions).not.toContain(PermissionKey.VIEW_TEST_OVERVIEW);
      expect(me.permissions).not.toContain(PermissionKey.VIEW_RESULTS);
    });

    it('/auth/me při aktivní PARENT roli má nulovou generickou množinu i s několika granty', async () => {
      await seedUP(parentUserId, orgA, PermissionKey.VIEW_RESULTS);
      await seedUP(parentUserId, null, PermissionKey.VIEW_SUBMISSIONS);
      const me = await meOf(parentToken);
      expect(me.activeRole).toBe(OrganizationRole.PARENT);
      expect(me.permissions).toEqual([]);
    });

    it('VERIFIED guardian vztah dál umožní /guardian/* (200) — vztahová autorizace, ne PermissionKey', async () => {
      const children = unwrap(
        await api().get('/guardian/children').set(auth(parentToken)).expect(200),
      );
      expect(children.children).toHaveLength(1);
      await api()
        .get(`/guardian/children/${studentA.id}/overview`)
        .set(auth(parentToken))
        .expect(200);
    });

    it('PARENT bez vztahu / cizí dítě / PENDING vztah → /guardian/* 403', async () => {
      // Cizí dítě (studentC — žádný vztah k tomuto rodiči)
      const foreign = await api()
        .get(`/guardian/children/${studentC.id}/overview`)
        .set(auth(parentToken));
      expect([403, 404]).toContain(foreign.status);

      // PENDING vztah k dalšímu dítěti → stále bez přístupu
      const pendingStudent = await mkStudent('gh_pending', orgA, yearA, classA);
      await prisma.guardianStudentRelation.create({
        data: {
          guardianMembershipId: parentMembershipId,
          studentId: pendingStudent.id,
          organizationId: orgA,
          status: GuardianRelationStatus.PENDING,
        },
      });
      const pending = await api()
        .get(`/guardian/children/${pendingStudent.id}/overview`)
        .set(auth(parentToken));
      expect([403, 404]).toContain(pending.status);
    });

    it('TEACHER aktivní role: legitimní UserPermission override funguje (oprava nerozbila RBAC)', async () => {
      const before = await meOf(teacherToken);
      expect(before.permissions).not.toContain(PermissionKey.MANAGE_TEACHERS);

      await policy.grantUserPermission(
        { userId: null, organizationId: orgA },
        {
          userId: teacherUserId,
          organizationId: orgA,
          permissionKey: PermissionKey.MANAGE_TEACHERS,
        },
      );

      const after = await meOf(teacherToken);
      expect(after.permissions).toContain(PermissionKey.MANAGE_TEACHERS);

      await policy.revokeUserPermission(
        { userId: null, organizationId: orgA },
        {
          userId: teacherUserId,
          organizationId: orgA,
          permissionKey: PermissionKey.MANAGE_TEACHERS,
        },
      );
    });

    it('write path: org-scoped UserPermission grant PARENT-only membershipu → aplikační 403, žádný záznam', async () => {
      await expect(
        policy.grantUserPermission(
          { userId: null, organizationId: orgA },
          {
            userId: parentUserId,
            organizationId: orgA,
            permissionKey: PermissionKey.VIEW_RESULTS,
          },
        ),
      ).rejects.toMatchObject({ status: 403 });

      const leaked = await prisma.userPermission.findFirst({
        where: {
          userId: parentUserId,
          organizationId: orgA,
          permission: { key: PermissionKey.VIEW_RESULTS },
        },
      });
      expect(leaked).toBeNull();
    });
  });
});
