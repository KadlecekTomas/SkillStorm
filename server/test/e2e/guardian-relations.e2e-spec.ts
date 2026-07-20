import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { authAs } from 'test/helpers';
import {
  GuardianRelationStatus,
  OrganizationRole,
  OrganizationStatus,
  Prisma,
} from '@prisma/client';

/**
 * Guardian Etapa B — testovací matice DoD (docs/guardian/etapa-b-stop2-navrh.md §6):
 * párování kódem (single i bulk), potvrzení/rozporování rodičem, tenant
 * izolace (cizí dítě 403 / cizí tenant 404), okamžitá revokace, multi-parent
 * nezávislost, učitel-rodič přepínání kontextu, DB invarianty (composite FK,
 * partial unique) a nulový únik XP/parťáka do guardian odpovědí.
 */

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

/**
 * Rekurzivní kontrola, že odpověď nenese gamifikaci (princip 5). Visited set
 * kvůli cirkulárním referencím z envelope shimu v jest-setup-after (vzor
 * tests-answer-key-regression).
 */
function assertNoGamificationKeys(
  value: unknown,
  visited = new Set<unknown>(),
): void {
  if (!value || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((v) => assertNoGamificationKeys(v, visited));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    expect(
      ['xp', 'level', 'avatarType', 'partak', 'badges'].includes(key),
    ).toBe(false);
    assertNoGamificationKeys(nested, visited);
  }
}

describe('Guardian Etapa B — vztahy a párování (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgA: string;
  let ownerAToken: string;
  let teacherAToken: string;
  let yearA: string;
  let classA: string; // homeroom teacherA
  let classA2: string; // mimo scope teacherA
  let student1: { id: string; membershipId: string; name: string };
  let student2: { id: string; membershipId: string };
  let orgB: string;
  let studentB: { id: string };

  const api = () => request(app.getHttpServer());

  /** Nový uživatel + STUDENT membership + Student řádek + enrollment. */
  async function mkStudent(seed: string, orgId: string, yearId: string, classSectionId: string) {
    const auth = await authAs(app, OrganizationRole.STUDENT, { seed });
    const membership = await prisma.membership.create({
      data: { userId: auth.user.id, organizationId: orgId, role: OrganizationRole.STUDENT },
      select: { id: true },
    });
    const student = await prisma.student.create({
      data: { membershipId: membership.id, orgId },
      select: { id: true },
    });
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classSectionId,
        yearId,
        orgId,
        status: 'ACTIVE',
      },
    });
    return {
      id: student.id,
      membershipId: membership.id,
      name: auth.user.name as string,
    };
  }

  /** Registrace rodiče guardian kódem → access token. */
  async function registerParent(seed: string, code: string) {
    const email = `${seed}${Date.now()}@example.com`;
    const reg = await api()
      .post('/auth/register')
      .send({
        name: `Rodič ${seed}`,
        email,
        username: `${seed}${Date.now()}`,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken: code,
      })
      .expect(201);
    const body = unwrap(reg);
    const token = reg.body?.sessionToken ?? body?.sessionToken;
    expect(token).toBeTruthy();
    return { token: token as string, userId: body?.user?.id as string, email };
  }

  async function issueCode(studentId: string, actorToken = ownerAToken) {
    const res = await api()
      .post(`/students/${studentId}/guardian-invites`)
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(201);
    const body = unwrap(res);
    expect(body.code).toBeTruthy();
    return body.code as string;
  }

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

    // Org A: owner + rok + dvě třídy + učitel (homeroom classA)
    const ownerA = await authAs(app, OrganizationRole.OWNER, { seed: 'ge_ownerA' });
    orgA = ownerA.organization.id;
    ownerAToken = ownerA.accessToken;
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

    const teacherAuth = await authAs(app, OrganizationRole.STUDENT, {
      seed: 'ge_teacherA',
    });
    const teacherMembership = await prisma.membership.create({
      data: {
        userId: teacherAuth.user.id,
        organizationId: orgA,
        role: OrganizationRole.TEACHER,
      },
      select: { id: true },
    });
    const teacherRow = await prisma.teacher.create({
      data: { membershipId: teacherMembership.id, organizationId: orgA },
      select: { id: true },
    });
    const loginTeacher = await api()
      .post('/auth/login')
      .send({
        email: teacherAuth.login.email,
        password: teacherAuth.login.password,
        organizationId: orgA,
      })
      .expect(201);
    teacherAToken = loginTeacher.body?.sessionToken;
    expect(teacherAToken).toBeTruthy();

    classA = (
      await prisma.classSection.create({
        data: {
          orgId: orgA,
          yearId: yearA,
          grade: 'GRADE_5',
          section: 'G',
          label: '5.G',
          teacherId: teacherRow.id,
        },
        select: { id: true },
      })
    ).id;
    classA2 = (
      await prisma.classSection.create({
        data: {
          orgId: orgA,
          yearId: yearA,
          grade: 'GRADE_6',
          section: 'H',
          label: '6.H',
        },
        select: { id: true },
      })
    ).id;

    student1 = await mkStudent('ge_st1', orgA, yearA, classA);
    student2 = await mkStudent('ge_st2', orgA, yearA, classA2);

    // Org B (cizí tenant)
    const ownerB = await authAs(app, OrganizationRole.OWNER, { seed: 'ge_ownerB' });
    orgB = ownerB.organization.id;
    await prisma.organization.update({
      where: { id: orgB },
      data: { status: OrganizationStatus.ACTIVE },
    });
    const yearB = await prisma.academicYear.findFirst({
      where: { orgId: orgB, isCurrent: true },
      select: { id: true },
    });
    const yearBId =
      yearB?.id ??
      (
        await prisma.academicYear.create({
          data: {
            orgId: orgB,
            label: '2025/2026',
            isCurrent: true,
            startsAt: new Date('2025-09-01'),
            endsAt: new Date('2026-08-31'),
          },
          select: { id: true },
        })
      ).id;
    const classB = await prisma.classSection.create({
      data: { orgId: orgB, yearId: yearBId, grade: 'GRADE_5', section: 'Z', label: '5.Z' },
      select: { id: true },
    });
    studentB = await mkStudent('ge_stB', orgB, yearBId, classB.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('1. happy path: kód od školy → registrace rodiče → potvrzení → dítě viditelné, overview 200', async () => {
    const code = await issueCode(student1.id);
    const parent = await registerParent('ge_p1', code);

    const beforeConfirm = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    expect(beforeConfirm.children).toHaveLength(0);
    expect(beforeConfirm.pendingConfirmation).toHaveLength(1);
    expect(beforeConfirm.pendingConfirmation[0].studentId).toBe(student1.id);

    const relationId = beforeConfirm.pendingConfirmation[0].relationId;
    await api()
      .post(`/guardian/relations/${relationId}/confirm`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(201);

    const afterConfirm = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    expect(afterConfirm.children).toHaveLength(1);
    expect(afterConfirm.children[0].classLabel).toBe('5.G');
    expect(afterConfirm.children[0].permissions).toContain('VIEW_ASSIGNMENTS');
    expect(afterConfirm.children[0].permissions).not.toContain('START_TEST');

    const overview = unwrap(
      await api()
        .get(`/guardian/children/${student1.id}/overview`)
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    expect(overview.student.id).toBe(student1.id);
    expect(Array.isArray(overview.todo)).toBe(true);

    // Princip 5: žádná gamifikace v guardian odpovědích
    assertNoGamificationKeys(beforeConfirm);
    assertNoGamificationKeys(afterConfirm);
    assertNoGamificationKeys(overview);
  });

  it('2. cizí dítě v téže org → 403, cizí tenant → 404', async () => {
    const code = await issueCode(student1.id);
    const parent = await registerParent('ge_p2', code);
    const children = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    await api()
      .post(`/guardian/relations/${children.pendingConfirmation[0].relationId}/confirm`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(201);

    await api()
      .get(`/guardian/children/${student2.id}/overview`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(403);
    await api()
      .get(`/guardian/children/${studentB.id}/overview`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(404);
  });

  it('3. revokace školou platí okamžitě, bez re-loginu', async () => {
    const code = await issueCode(student1.id);
    const parent = await registerParent('ge_p3', code);
    const children = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    const relationId = children.pendingConfirmation[0].relationId;
    await api()
      .post(`/guardian/relations/${relationId}/confirm`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(201);
    await api()
      .get(`/guardian/children/${student1.id}/overview`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(200);

    await api()
      .post(`/guardian/relations/${relationId}/revoke`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);

    await api()
      .get(`/guardian/children/${student1.id}/overview`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(403);
    const after = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    expect(after.children).toHaveLength(0);
  });

  it('4. dispute: „není moje dítě" → DISPUTED, škola vidí, rodič přístup nemá', async () => {
    const code = await issueCode(student2.id);
    const parent = await registerParent('ge_p4', code);
    const children = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent.token}`)
        .expect(200),
    );
    const relationId = children.pendingConfirmation[0].relationId;
    await api()
      .post(`/guardian/relations/${relationId}/dispute`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(201);

    const guardians = unwrap(
      await api()
        .get(`/students/${student2.id}/guardians`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .expect(200),
    );
    const disputed = guardians.find(
      (g: { relationId: string }) => g.relationId === relationId,
    );
    expect(disputed.status).toBe('DISPUTED');

    await api()
      .get(`/guardian/children/${student2.id}/overview`)
      .set('Authorization', `Bearer ${parent.token}`)
      .expect(403);
  });

  it('5. multi-parent: dva rodiče nezávisle; revokace jednoho nezasáhne druhého', async () => {
    const codeP5 = await issueCode(student1.id);
    const parent5 = await registerParent('ge_p5', codeP5);
    const codeP6 = await issueCode(student1.id);
    const parent6 = await registerParent('ge_p6', codeP6);

    for (const p of [parent5, parent6]) {
      const children = unwrap(
        await api()
          .get('/guardian/children')
          .set('Authorization', `Bearer ${p.token}`)
          .expect(200),
      );
      await api()
        .post(`/guardian/relations/${children.pendingConfirmation[0].relationId}/confirm`)
        .set('Authorization', `Bearer ${p.token}`)
        .expect(201);
    }

    const children5 = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parent5.token}`)
        .expect(200),
    );
    const rel5 = children5.children[0].relationId;
    await api()
      .post(`/guardian/relations/${rel5}/revoke`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);

    await api()
      .get(`/guardian/children/${student1.id}/overview`)
      .set('Authorization', `Bearer ${parent5.token}`)
      .expect(403);
    await api()
      .get(`/guardian/children/${student1.id}/overview`)
      .set('Authorization', `Bearer ${parent6.token}`)
      .expect(200);
  });

  it('6. učitel-rodič: jeden membership, kontext dle aktivní role', async () => {
    // Učitel přijme guardian kód (přidá PARENT roli k TEACHER membershipu)
    const code = await issueCode(student1.id);
    const accept = await api()
      .post('/invites/accept')
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ code })
      .expect(201);
    const acceptBody = unwrap(accept);
    const tokenAfterAccept: string =
      accept.body?.sessionToken ?? acceptBody?.sessionToken ?? teacherAToken;

    // S aktivní rolí TEACHER guardian API odmítne (PARENT_ROLE_REQUIRED)
    await api()
      .get('/guardian/children')
      .set('Authorization', `Bearer ${tokenAfterAccept}`)
      .expect(403);

    // switch-role na PARENT → children viditelné
    const switched = await api()
      .post('/auth/switch-role')
      .set('Authorization', `Bearer ${tokenAfterAccept}`)
      .send({ role: OrganizationRole.PARENT })
      .expect(201);
    const parentToken: string =
      switched.body?.sessionToken ?? unwrap(switched)?.sessionToken;
    expect(parentToken).toBeTruthy();

    const children = unwrap(
      await api()
        .get('/guardian/children')
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200),
    );
    expect(children.pendingConfirmation).toHaveLength(1);
    expect(children.pendingConfirmation[0].studentId).toBe(student1.id);
  });

  it('7. bulk kódy pro třídu (teacher scope): arch pro classA, cizí třída 403', async () => {
    const bulk = unwrap(
      await api()
        .post(`/classrooms/${classA}/guardian-invites/bulk`)
        .set('Authorization', `Bearer ${teacherAToken}`)
        .expect(201),
    );
    expect(bulk.classLabel).toBe('5.G');
    expect(bulk.slips.length).toBeGreaterThanOrEqual(1);
    for (const slip of bulk.slips) {
      expect(slip.code).toMatch(/^[A-HJ-NP-Z2-9]{6,8}$/);
      expect(slip.studentName).toBeTruthy();
      expect(new Date(slip.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }

    // Učitel bez úvazku v classA2 → 403; owner org-wide → 201
    await api()
      .post(`/classrooms/${classA2}/guardian-invites/bulk`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .expect(403);
    await api()
      .post(`/classrooms/${classA2}/guardian-invites/bulk`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .expect(201);
  });

  it('8. DB invarianty: cross-org vztah neprojde ani přímým SQL, druhý živý vztah páru také ne', async () => {
    // Membership rodiče v orgA, žák z orgB → composite FK musí selhat
    const parentMembership = await prisma.membership.findFirst({
      where: { organizationId: orgA, role: OrganizationRole.PARENT },
      select: { id: true },
    });
    expect(parentMembership).toBeTruthy();
    await expect(
      prisma.$executeRaw`
        INSERT INTO guardian_student_relations
          (guardian_student_relation_id, guardian_membership_id, student_id,
           organization_id, type, status, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${parentMembership!.id}, ${studentB.id},
           ${orgA}, 'PARENT', 'PENDING', now(), now())
      `,
    ).rejects.toThrow();

    // Druhý živý vztah stejného páru → partial unique
    const live = await prisma.guardianStudentRelation.findFirst({
      where: { revokedAt: null, status: GuardianRelationStatus.VERIFIED },
      select: { guardianMembershipId: true, studentId: true, organizationId: true },
    });
    expect(live).toBeTruthy();
    await expect(
      prisma.guardianStudentRelation.create({
        data: {
          guardianMembershipId: live!.guardianMembershipId,
          studentId: live!.studentId,
          organizationId: live!.organizationId,
          status: GuardianRelationStatus.PENDING,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it('9. PIN: škola nastaví 4–6 číslic, jen hash v DB; špatný formát 400', async () => {
    await api()
      .post(`/students/${student1.id}/pin`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ pin: '12345' })
      .expect(201);
    const row = await prisma.student.findUniqueOrThrow({
      where: { id: student1.id },
      select: { pinHash: true, pinUpdatedAt: true, pinFailedCount: true },
    });
    expect(row.pinHash).toBeTruthy();
    expect(row.pinHash).not.toContain('12345');
    expect(row.pinUpdatedAt).not.toBeNull();
    expect(row.pinFailedCount).toBe(0);

    await api()
      .post(`/students/${student1.id}/pin`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ pin: '12' })
      .expect(400);
    await api()
      .post(`/students/${student1.id}/pin`)
      .set('Authorization', `Bearer ${teacherAToken}`)
      .send({ pin: 'abcd' })
      .expect(400);
  });
});
