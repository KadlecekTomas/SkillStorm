import { Test as NestTest } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { authAs } from 'test/helpers';
import {
  GuardianLaunchPolicy,
  LearningSessionStatus,
  OrganizationRole,
  OrganizationStatus,
} from '@prisma/client';

/**
 * Guardian Etapa C — testovací matice bodu 19 (docs/guardian/etapa-c-stop3-navrh.md §6):
 * oprávněné spuštění + provenance, cizí dítě/tenant, policy DISABLED,
 * PIN (vč. zámku), sourozenci/kolize relací + DB invariant, okamžitý konec
 * přístupu po ukončení, expirace navazující na rozpracovaný pokus.
 */

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Guardian Etapa C — žákovské relace (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgA: string;
  let ownerToken: string;
  let yearA: string;
  let classA: string;
  let child1: { id: string; membershipId: string; login: { email: string; password: string } };
  let child2: { id: string; membershipId: string };
  let studentB: { id: string };
  let parentToken: string;
  let testId: string;
  let aAllowed: string;
  let aPin: string;
  let aDisabled: string;

  const api = () => request(app.getHttpServer());

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
      data: { studentId: student.id, classSectionId, yearId, orgId, status: 'ACTIVE' },
    });
    return {
      id: student.id,
      membershipId: membership.id,
      login: { email: auth.login.email, password: auth.login.password },
    };
  }

  async function registerParentWithCode(seed: string, code: string) {
    const reg = await api()
      .post('/auth/register')
      .send({
        name: `Rodič ${seed}`,
        email: `${seed}${Date.now()}@example.com`,
        username: `${seed}${Date.now()}`,
        password: 'Password123!',
        mode: 'JOIN_ORG',
        inviteToken: code,
      })
      .expect(201);
    return reg.body?.sessionToken as string;
  }

  async function confirmFirstPending(token: string) {
    const children = unwrap(
      await api().get('/guardian/children').set('Authorization', `Bearer ${token}`).expect(200),
    );
    await api()
      .post(`/guardian/relations/${children.pendingConfirmation[0].relationId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
  }

  async function issueCodeFor(studentId: string) {
    const res = await api()
      .post(`/students/${studentId}/guardian-invites`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);
    return unwrap(res).code as string;
  }

  function mkAssignment(policy: GuardianLaunchPolicy) {
    return prisma.assignment.create({
      data: {
        organizationId: orgA,
        yearId: yearA,
        testId,
        targetType: 'CLASS',
        classSectionId: classA,
        openAt: new Date(Date.now() - 60_000),
        closeAt: new Date(Date.now() + 3_600_000),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'NEVER',
        createdById: ownerMembershipId,
        guardianLaunchPolicy: policy,
      },
      select: { id: true },
    });
  }
  let ownerMembershipId: string;

  function launch(body: Record<string, unknown>, token = parentToken) {
    return api()
      .post('/guardian/student-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.$connect();

    const owner = await authAs(app, OrganizationRole.OWNER, { seed: 'gs_owner' });
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
    classA = (
      await prisma.classSection.create({
        data: { orgId: orgA, yearId: yearA, grade: 'GRADE_5', section: 'S', label: '5.S' },
        select: { id: true },
      })
    ).id;

    child1 = await mkStudent('gs_ch1', orgA, yearA, classA);
    child2 = await mkStudent('gs_ch2', orgA, yearA, classA);

    // Org B (cizí tenant)
    const ownerB = await authAs(app, OrganizationRole.OWNER, { seed: 'gs_ownerB' });
    await prisma.organization.update({
      where: { id: ownerB.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    const yearB = await prisma.academicYear.findFirst({
      where: { orgId: ownerB.organization.id, isCurrent: true },
      select: { id: true },
    });
    const yearBId =
      yearB?.id ??
      (
        await prisma.academicYear.create({
          data: {
            orgId: ownerB.organization.id,
            label: '2025/2026',
            isCurrent: true,
            startsAt: new Date('2025-09-01'),
            endsAt: new Date('2026-08-31'),
          },
          select: { id: true },
        })
      ).id;
    const classB = await prisma.classSection.create({
      data: { orgId: ownerB.organization.id, yearId: yearBId, grade: 'GRADE_5', section: 'T', label: '5.T' },
      select: { id: true },
    });
    studentB = await mkStudent('gs_chB', ownerB.organization.id, yearBId, classB.id);

    // Test s otázkou (PUBLISHED)
    const test = await prisma.test.create({
      data: {
        organizationId: orgA,
        title: 'Guardian test',
        creatorId: ownerMembershipId,
        status: 'PUBLISHED',
        academicYearId: yearA,
        allowedGrades: ['GRADE_5'],
      },
      select: { id: true },
    });
    testId = test.id;
    await prisma.question.create({
      data: {
        testId,
        text: '1 < 2?',
        type: 'TRUE_FALSE',
        correctAnswer: 'true',
        order: 1,
      },
    });

    aAllowed = (await mkAssignment(GuardianLaunchPolicy.ALLOWED)).id;
    aPin = (await mkAssignment(GuardianLaunchPolicy.REQUIRE_CHILD_PIN)).id;
    aDisabled = (await mkAssignment(GuardianLaunchPolicy.DISABLED)).id;

    // Rodič s VERIFIED vztahem k child1
    parentToken = await registerParentWithCode('gs_p1', await issueCodeFor(child1.id));
    await confirmFirstPending(parentToken);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('1. oprávněné spuštění: relace vznikne, dítě odevzdá, provenance + audit nesou rodiče', async () => {
    const res = await launch({ studentId: child1.id, assignmentId: aAllowed, assistanceDeclared: true });
    expect(res.status).toBe(201);
    const body = unwrap(res);
    expect(body.session.studentName).toBeTruthy();
    const childToken = res.body?.sessionToken as string; // shim čte ss_at cookie
    expect(childToken).toBeTruthy();

    // Dítě pracuje běžnou pipeline pod tokenem relace
    const created = unwrap(
      await api()
        .post('/submissions')
        .set('Authorization', `Bearer ${childToken}`)
        .send({ assignmentId: aAllowed })
        .expect(201),
    );
    await api()
      .patch(`/submissions/${created.id}/responses`)
      .set('Authorization', `Bearer ${childToken}`)
      .send({ responses: [{ questionId: (await prisma.question.findFirstOrThrow({ where: { testId } })).id, givenText: 'true' }] })
      .expect(200);
    await api()
      .post(`/submissions/${created.id}/finish`)
      .set('Authorization', `Bearer ${childToken}`)
      .send({})
      .expect(200);

    const row = await prisma.submission.findUniqueOrThrow({
      where: { id: created.id },
      select: { learningSessionId: true, studentId: true },
    });
    expect(row.studentId).toBe(child1.membershipId); // výsledek patří dítěti
    expect(row.learningSessionId).toBe(body.session.id);

    // Učitelský pohled: provenance lidsky
    const result = unwrap(
      await api()
        .get(`/tests/${testId}/results/${child1.membershipId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200),
    );
    expect(result.provenance.label).toContain('Spustil rodič');
    expect(result.provenance.label).toContain('pomáhal');
    expect(result.provenance.initiatorName).toContain('Rodič');

    // Audit iniciátora
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'GUARDIAN_SESSION_STARTED', entityId: body.session.id },
    });
    expect(audit).toBeTruthy();

    // Úklid pro další testy: ukonči relaci rodičem
    await api()
      .post(`/guardian/student-sessions/${body.session.id}/end`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);
  });

  it('2. cizí dítě v org → 403, cizí tenant → 404; session nevznikne', async () => {
    const before = await prisma.learningSession.count();
    await launch({ studentId: child2.id, assignmentId: aAllowed }).expect(403);
    await launch({ studentId: studentB.id, assignmentId: aAllowed }).expect(404);
    expect(await prisma.learningSession.count()).toBe(before);
  });

  it('3. policy DISABLED → 409, srozumitelný kód', async () => {
    const res = await launch({ studentId: child1.id, assignmentId: aDisabled });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('GUARDIAN_LAUNCH_DISABLED');
  });

  it('4. PIN: bez PINu 400, špatný 403, 5× → zámek, správný PIN po zámku 403', async () => {
    await api()
      .post(`/students/${child1.id}/pin`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ pin: '2468' })
      .expect(201);

    await launch({ studentId: child1.id, assignmentId: aPin }).expect(400);
    await launch({ studentId: child1.id, assignmentId: aPin, pin: '0000' }).expect(403);

    // správný PIN po chybě funguje (počítadlo se resetuje)
    const okRes = await launch({ studentId: child1.id, assignmentId: aPin, pin: '2468' });
    expect(okRes.status).toBe(201);
    const okBody = unwrap(okRes);
    await api()
      .post(`/guardian/student-sessions/${okBody.session.id}/end`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);

    // 5 špatných pokusů → zámek; pak i správný PIN 403 (PIN_LOCKED)
    for (let i = 0; i < 5; i++) {
      await launch({ studentId: child1.id, assignmentId: aPin, pin: '9999' }).expect(403);
    }
    const locked = await launch({ studentId: child1.id, assignmentId: aPin, pin: '2468' });
    expect(locked.status).toBe(403);
    expect(JSON.stringify(locked.body)).toContain('PIN_LOCKED');
    const row = await prisma.student.findUniqueOrThrow({
      where: { id: child1.id },
      select: { pinLockedUntil: true, pinHash: true },
    });
    expect(row.pinLockedUntil).not.toBeNull();
    expect(row.pinHash).not.toContain('2468');
    // odemknout pro další testy (školní reset)
    await api()
      .post(`/students/${child1.id}/pin`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ pin: '2468' })
      .expect(201);
  });

  it('5. kolize relací: nové spuštění pro totéž dítě ukončí staré (starý token 401); partial unique drží v DB', async () => {
    const first = unwrap(await launch({ studentId: child1.id, assignmentId: aAllowed }).expect(201));
    const res2 = await launch({ studentId: child1.id, assignmentId: aAllowed });
    expect(res2.status).toBe(201);
    const secondToken = res2.body?.sessionToken as string;

    const firstRow = await prisma.learningSession.findUniqueOrThrow({
      where: { id: first.session.id },
      select: { status: true },
    });
    expect(firstRow.status).toBe(LearningSessionStatus.ENDED);

    // DB invariant: druhý ACTIVE řádek pro totéž dítě neprojde ani přímým SQL
    await expect(
      prisma.$executeRaw`
        INSERT INTO learning_sessions
          (learning_session_id, student_id, organization_id, initiator_membership_id,
           guardian_relation_id, assignment_id, expires_at, created_at, updated_at)
        SELECT gen_random_uuid(), student_id, organization_id, initiator_membership_id,
               guardian_relation_id, assignment_id, expires_at, now(), now()
        FROM learning_sessions WHERE status = 'ACTIVE' AND student_id = ${child1.id} LIMIT 1
      `,
    ).rejects.toThrow();

    // úklid: ukončit druhou relaci dítětem (dítě v relaci smí)
    const active = unwrap(res2).session.id;
    await api()
      .post(`/guardian/student-sessions/${active}/end`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(201);
  });

  it('6. ukončení platí okamžitě: žákovský token po end → 401 SESSION_ENDED', async () => {
    const res = await launch({ studentId: child1.id, assignmentId: aAllowed }).expect(201);
    const childToken = res.body?.sessionToken as string;
    const sessionId = unwrap(res).session.id;

    await api()
      .get('/assignments/my')
      .set('Authorization', `Bearer ${childToken}`)
      .expect(200);
    await api()
      .post(`/guardian/student-sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);
    const after = await api()
      .get('/assignments/my')
      .set('Authorization', `Bearer ${childToken}`);
    expect(after.status).toBe(401);
  });

  it('7. expirace navazuje na rozpracovaný pokus — nikdy nový pokus', async () => {
    const res = await launch({ studentId: child1.id, assignmentId: aPin, pin: '2468' }).expect(201);
    const childToken = res.body?.sessionToken as string;
    const sessionId = unwrap(res).session.id;

    // dítě rozpracuje (create bez finish)
    const created = unwrap(
      await api()
        .post('/submissions')
        .set('Authorization', `Bearer ${childToken}`)
        .send({ assignmentId: aPin })
        .expect(201),
    );

    // relace vyprší
    await prisma.learningSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await api()
      .post('/submissions')
      .set('Authorization', `Bearer ${childToken}`)
      .send({ assignmentId: aPin });
    expect(expired.status).toBe(401);
    const flipped = await prisma.learningSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { status: true },
    });
    expect(flipped.status).toBe(LearningSessionStatus.EXPIRED);

    // nové spuštění → stejný pokus (maxAttempts=1 se nevyčerpá)
    const again = await launch({ studentId: child1.id, assignmentId: aPin, pin: '2468' }).expect(201);
    const childToken2 = again.body?.sessionToken as string;
    const resumed = unwrap(
      await api()
        .post('/submissions')
        .set('Authorization', `Bearer ${childToken2}`)
        .send({ assignmentId: aPin })
        .expect(201),
    );
    expect(resumed.id).toBe(created.id);
    expect(resumed.attemptNo).toBe(created.attemptNo);
    await api()
      .post(`/guardian/student-sessions/${unwrap(again).session.id}/end`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);
  });

  it('8. NULL provenance = samostatné přihlášení; rodič na učitelský detail nesmí', async () => {
    // child2 se přihlásí sám a odevzdá (vlastní test bez relace)
    const loginRes = await api()
      .post('/auth/login')
      .send({ ...child1.login, organizationId: orgA })
      .expect(201);
    const selfToken = loginRes.body?.sessionToken as string;
    // child1 už má APPROVED submission z testu 1 — provenance zůstala z relace.
    // Samostatnost ověříme na child2: vytvoř mu vlastní submission ručně.
    const sub = await prisma.submission.create({
      data: {
        organizationId: orgA,
        assignmentId: aAllowed,
        testId,
        studentId: child2.membershipId,
        attemptNo: 1,
        status: 'APPROVED',
        submittedAt: new Date(),
        score: 1,
      },
      select: { id: true },
    });
    void sub;
    const result = unwrap(
      await api()
        .get(`/tests/${testId}/results/${child2.membershipId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200),
    );
    expect(result.provenance.initiatedVia).toBeNull();
    expect(result.provenance.label).toContain('samostatně');

    // rodič nevidí učitelský detail (interní auditní pohled)
    await api()
      .get(`/tests/${testId}/results/${child1.membershipId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
    void selfToken;
  });
});
