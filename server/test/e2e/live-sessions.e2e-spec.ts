// test/e2e/live-sessions.e2e-spec.ts
/**
 * Bleskovky (live sessions, režim B) — e2e
 *
 * A. Lifecycle: create → start (snapshot kol, FITB vynechána) → reveal →
 *    outcome → finish (XP parťákovi, session FINISHED)
 * B. Correct-key leak guard: projekce nikdy nevrací správný klíč před
 *    revealem (network tab na sdíleném zařízení nesmí prozradit odpovědi)
 * C. Outcome před revealem → 400 ROUND_NOT_REVEALED
 * D. XP nezávislé na správnosti: opačné outcomes → stejná XP delta
 * E. RBAC: student 403, cizí org 404, cizí učitel v téže org 403
 * F. Double finish → 409; session bez třídy → žádné XP
 * G. Hlasování: fázový guard (mimo VOTING → 409), leak guard (žádný correctKey
 *    v voting odpovědích), auto-outcome prahy (≥2/3 / ≤1/3 / SPLIT), klamp
 *    dekrementu na 0, učitelův override, neplatná možnost → 400
 * H. Hlasy nemění XP ani kampaňový advance: opačné poměry hlasů → identická
 *    delta (rozšíření testu D na voting cestu)
 * I. RBAC votes: student 403, cizí učitel 403, cizí org 404
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import {
  LiveRoundOutcome,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  SchoolGrade,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import {
  XP_PER_FINISHED_SESSION,
  XP_PER_PLAYED_ROUND,
} from '@/live-sessions/live-sessions.constants';

const unwrap = (res: request.Response) => res.body?.data ?? res.body;

describe('Live sessions — Bleskovky režim B (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgAId: string;
  let orgBId: string;
  let teacherToken: string; // host v orgA
  let otherTeacherToken: string; // jiný učitel v orgA
  let studentToken: string;
  let teacherBToken: string; // učitel v orgB
  let testId: string;
  let classSectionId: string;
  let userIds: string[];

  const api = () => request(app.getHttpServer());

  async function createSessionAndStart(token: string) {
    const createRes = await api()
      .post('/live-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId, classSectionId })
      .expect(201);
    const session = unwrap(createRes);
    const startRes = await api()
      .post(`/live-sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return unwrap(startRes);
  }

  async function openVoting(sessionId: string, roundId: string) {
    return unwrap(
      await api()
        .post(`/live-sessions/${sessionId}/rounds/${roundId}/voting`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
  }

  async function castVotes(
    sessionId: string,
    roundId: string,
    key: string,
    n: number,
  ) {
    let last: any = null;
    for (let i = 0; i < n; i += 1) {
      const res = await api()
        .post(`/live-sessions/${sessionId}/rounds/${roundId}/votes`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ key })
        .expect(201);
      last = unwrap(res);
    }
    return last;
  }

  async function correctKeyOf(roundId: string): Promise<string> {
    const round = await prisma.liveSessionRound.findUniqueOrThrow({
      where: { id: roundId },
      select: { correctKeySnapshot: true },
    });
    return round.correctKeySnapshot;
  }

  /** Jiný než správný klíč v rámci možností kola (A/B stačí — TF má 2). */
  function wrongKeyFor(correctKey: string): string {
    return correctKey === 'A' ? 'B' : 'A';
  }

  async function playRound(
    sessionId: string,
    roundId: string,
    outcome: LiveRoundOutcome,
  ) {
    await api()
      .post(`/live-sessions/${sessionId}/rounds/${roundId}/reveal`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);
    await api()
      .post(`/live-sessions/${sessionId}/rounds/${roundId}/outcome`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ outcome })
      .expect(201);
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

    const ts = Date.now();
    const ctxA = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `live_A_${ts}`,
      with: { student: true },
    });
    const ctxB = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `live_B_${ts}`,
    });

    orgAId = ctxA.organization.id;
    orgBId = ctxB.organization.id;
    teacherToken = ctxA.actor.accessToken;
    studentToken = ctxA.student!.accessToken;
    teacherBToken = ctxB.actor.accessToken;
    const otherTeacher = await ctxA.addMember('TEACHER' as any, 'teacher2');
    otherTeacherToken = otherTeacher.accessToken;
    userIds = [
      ctxA.owner.user.id,
      ctxA.actor.user.id,
      ctxA.student!.user.id,
      otherTeacher.user.id,
      ctxB.owner.user.id,
      ctxB.actor.user.id,
    ];

    await prisma.organization.updateMany({
      where: { id: { in: [orgAId, orgBId] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const yearA = await prisma.academicYear.findFirst({
      where: { orgId: orgAId, isCurrent: true },
      select: { id: true },
    });
    if (!yearA) throw new Error('Missing current academic year in orgA');

    // orgB potřebuje třídu, jinak requesty jejího učitele padnou na 412 ORG_NOT_READY
    const yearB = await prisma.academicYear.findFirst({
      where: { orgId: orgBId, isCurrent: true },
      select: { id: true },
    });
    if (!yearB) throw new Error('Missing current academic year in orgB');
    await prisma.classSection.create({
      data: {
        orgId: orgBId,
        yearId: yearB.id,
        grade: SchoolGrade.GRADE_5,
        section: 'B',
      },
    });

    const classSection = await prisma.classSection.create({
      data: {
        orgId: orgAId,
        yearId: yearA.id,
        grade: SchoolGrade.GRADE_7,
        section: 'L',
      },
    });
    classSectionId = classSection.id;

    const teacherMembershipId = ctxA.actor.membership!.id as string;
    const test = await prisma.test.create({
      data: {
        organizationId: orgAId,
        title: 'Bleskovka fixture',
        status: PublishStatus.PUBLISHED,
        publishedAt: new Date(),
        creatorId: teacherMembershipId,
        questions: {
          create: [
            {
              text: 'Kolik je 1/2 + 1/4?',
              type: QuestionType.MULTIPLE_CHOICE,
              order: 1,
              correctAnswer: '3/4',
              options: {
                create: [
                  { text: '3/4' },
                  { text: '2/6' },
                  { text: '1/6' },
                  { text: '2/4' },
                ],
              },
            },
            {
              text: 'Zlomek 4/8 lze zkrátit na 1/2.',
              type: QuestionType.TRUE_FALSE,
              order: 2,
              correctAnswer: 'true',
            },
            {
              text: 'Kolik je 2/3 z 9?',
              type: QuestionType.MULTIPLE_CHOICE,
              order: 3,
              correctAnswer: '6',
              options: {
                create: [{ text: '6' }, { text: '3' }, { text: '9' }],
              },
            },
            {
              // FITB je pro bleskovku nepoužitelná → nesmí se stát kolem
              text: 'Doplň: 1/2 = __/4',
              type: QuestionType.FILL_IN_THE_BLANK,
              order: 4,
              correctAnswer: '2',
            },
          ],
        },
      },
    });
    testId = test.id;
  });

  afterAll(async () => {
    if (orgAId && orgBId) {
      const orgs = [orgAId, orgBId];
      await prisma.classPartakXpEvent.deleteMany({
        where: { classPartak: { organizationId: { in: orgs } } },
      });
      await prisma.classPartak.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.liveSession.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.test.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.classSection.deleteMany({
        where: { orgId: { in: orgs } },
      });
      await prisma.membership.deleteMany({
        where: { organizationId: { in: orgs } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    }
    if (userIds?.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('A+B: lifecycle — start snapshotne jen kompatibilní otázky a neleakuje správný klíč', async () => {
    const session = await createSessionAndStart(teacherToken);
    expect(session.status).toBe('RUNNING');
    expect(session.ageMode).toBe('MIDDLE'); // GRADE_7 default
    // 4 otázky v testu, FITB vynechána
    expect(session.rounds).toHaveLength(3);

    // B: před revealem žádný správný klíč nikde v payloadu
    for (const round of session.rounds) {
      expect(round.correctKey).toBeUndefined();
      expect(round.correctKeySnapshot).toBeUndefined();
    }
    const projRes = await api()
      .get(`/live-sessions/${session.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const projection = unwrap(projRes);
    expect(JSON.stringify(projection.rounds)).not.toContain('correctKey');

    // reveal prvního kola → klíč se vrátí a od té chvíle je v projekci
    const [r1, r2, r3] = projection.rounds;
    const revealRes = await api()
      .post(`/live-sessions/${session.id}/rounds/${r1.id}/reveal`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);
    const revealed = unwrap(revealRes);
    expect(['A', 'B', 'C', 'D']).toContain(revealed.correctKey);

    const projAfter = unwrap(
      await api()
        .get(`/live-sessions/${session.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200),
    );
    expect(projAfter.rounds[0].correctKey).toBe(revealed.correctKey);
    expect(projAfter.rounds[1].correctKey).toBeUndefined();
    expect(projAfter.rounds[2].correctKey).toBeUndefined();

    // C: outcome před revealem → 400
    const badOutcome = await api()
      .post(`/live-sessions/${session.id}/rounds/${r2.id}/outcome`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ outcome: LiveRoundOutcome.SPLIT })
      .expect(400);
    expect(badOutcome.body?.code ?? badOutcome.body?.error?.code).toBe(
      'ROUND_NOT_REVEALED',
    );

    // dohrát všechna 3 kola
    await api()
      .post(`/live-sessions/${session.id}/rounds/${r1.id}/outcome`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ outcome: LiveRoundOutcome.MOSTLY_CORRECT })
      .expect(201);
    await playRound(session.id, r2.id, LiveRoundOutcome.SPLIT);
    await playRound(session.id, r3.id, LiveRoundOutcome.MOSTLY_WRONG);

    // finish → XP = 3×kolo + dokončení
    const finish = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/finish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    expect(finish.status).toBe('FINISHED');
    expect(finish.playedRounds).toBe(3);
    expect(finish.xpDelta).toBe(
      3 * XP_PER_PLAYED_ROUND + XP_PER_FINISHED_SESSION,
    );
    expect(finish.partak.xp).toBeGreaterThanOrEqual(finish.xpDelta);

    // F: double finish → 409
    await api()
      .post(`/live-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(409);

    // GET /class-partak odpovídá
    const partak = unwrap(
      await api()
        .get(`/live-sessions/class-partak/${classSectionId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200),
    );
    expect(partak.xp).toBe(finish.partak.xp);
  });

  it('D: XP delta je stejná pro opačné výsledky kol — správnost XP neovlivňuje', async () => {
    const deltas: number[] = [];
    for (const outcome of [
      LiveRoundOutcome.MOSTLY_CORRECT,
      LiveRoundOutcome.MOSTLY_WRONG,
    ]) {
      const session = await createSessionAndStart(teacherToken);
      for (const round of session.rounds) {
        await playRound(session.id, round.id, outcome);
      }
      const finish = unwrap(
        await api()
          .post(`/live-sessions/${session.id}/finish`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(201),
      );
      deltas.push(finish.xpDelta);
    }
    expect(deltas[0]).toBe(deltas[1]);
  });

  it('E: RBAC — student 403, cizí org 404, cizí učitel téže org 403', async () => {
    const session = await createSessionAndStart(teacherToken);

    await api()
      .post('/live-sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ testId })
      .expect(403);

    await api()
      .get(`/live-sessions/${session.id}`)
      .set('Authorization', `Bearer ${teacherBToken}`)
      .expect(404);

    await api()
      .get(`/live-sessions/${session.id}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(403);

    await api()
      .get(`/live-sessions/class-partak/${classSectionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('G: hlasování — fázový guard, leak guard, auto-outcome prahy, klamp, override', async () => {
    const session = await createSessionAndStart(teacherToken);
    const [r1, r2, r3] = session.rounds;

    // mimo fázi VOTING (neotevřeno) → 409
    const notVoting = await api()
      .post(`/live-sessions/${session.id}/rounds/${r1.id}/votes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: 'A' })
      .expect(409);
    expect(notVoting.body?.code ?? notVoting.body?.error?.code).toBe(
      'ROUND_NOT_VOTING',
    );

    // otevření hlasování — odpověď bez správného klíče
    const opened = await openVoting(session.id, r1.id);
    expect(opened.correctKey).toBeUndefined();
    expect(opened.correctKeySnapshot).toBeUndefined();

    const correct1 = await correctKeyOf(r1.id);
    const wrong1 = wrongKeyFor(correct1);

    // hlasy: 2 správně + 1 špatně = 2/3 ≥ 2/3 → MOSTLY_CORRECT
    await castVotes(session.id, r1.id, correct1, 2);
    const voteRes = await castVotes(session.id, r1.id, wrong1, 1);
    expect(voteRes.totalVotes).toBe(3);
    expect(voteRes.voteCounts[correct1]).toBe(2);
    // leak guard: votes odpověď nikdy neobsahuje správný klíč
    expect(voteRes.correctKey).toBeUndefined();
    expect(Object.keys(voteRes)).not.toContain('correctKey');

    // projekce během hlasování: počty ano, correctKey ne
    const during = unwrap(
      await api()
        .get(`/live-sessions/${session.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200),
    );
    expect(during.rounds[0].voteCounts[correct1]).toBe(2);
    expect(JSON.stringify(during.rounds)).not.toContain('correctKey');

    // klamp: dekrement pod 0 nejde
    await castVotes(session.id, r1.id, correct1, 1); // 3 správně
    const dec = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/rounds/${r1.id}/votes`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ key: wrong1, delta: -1 })
        .expect(201),
    );
    expect(dec.voteCounts[wrong1]).toBe(0);
    const decAgain = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/rounds/${r1.id}/votes`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ key: wrong1, delta: -1 })
        .expect(201),
    );
    expect(decAgain.voteCounts[wrong1]).toBe(0);

    // reveal → auto-outcome (3/3 správně → MOSTLY_CORRECT) se rovnou persistuje
    const reveal1 = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/rounds/${r1.id}/reveal`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    expect(reveal1.autoOutcome).toBe('MOSTLY_CORRECT');
    expect(reveal1.outcome).toBe('MOSTLY_CORRECT');
    const r1Db = await prisma.liveSessionRound.findUniqueOrThrow({
      where: { id: r1.id },
    });
    expect(r1Db.outcome).toBe('MOSTLY_CORRECT');
    expect(r1Db.completedAt).not.toBeNull();

    // po revealu už hlasovat nejde
    await api()
      .post(`/live-sessions/${session.id}/rounds/${r1.id}/votes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: correct1 })
      .expect(409);
    // ani znovu otevřít hlasování
    await api()
      .post(`/live-sessions/${session.id}/rounds/${r1.id}/voting`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(409);

    // učitelův override auto-outcome — jeho slovo je finální
    const overridden = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/rounds/${r1.id}/outcome`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ outcome: LiveRoundOutcome.SPLIT })
        .expect(201),
    );
    expect(overridden.outcome).toBe('SPLIT');

    // r2: 1 správně + 2 špatně = 1/3 ≤ 1/3 → MOSTLY_WRONG
    await openVoting(session.id, r2.id);
    const correct2 = await correctKeyOf(r2.id);
    await castVotes(session.id, r2.id, correct2, 1);
    await castVotes(session.id, r2.id, wrongKeyFor(correct2), 2);
    const reveal2 = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/rounds/${r2.id}/reveal`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    expect(reveal2.autoOutcome).toBe('MOSTLY_WRONG');

    // r3: 1 správně + 1 špatně = 1/2 mezi prahy → SPLIT
    await openVoting(session.id, r3.id);
    const correct3 = await correctKeyOf(r3.id);
    await castVotes(session.id, r3.id, correct3, 1);
    await castVotes(session.id, r3.id, wrongKeyFor(correct3), 1);
    const reveal3 = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/rounds/${r3.id}/reveal`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    expect(reveal3.autoOutcome).toBe('SPLIT');

    // neplatná možnost (TRUE_FALSE kolo má jen A/B) → 400
    const tfRound = session.rounds.find(
      (r: any) => r.options.length === 2,
    ) as any;
    // tfRound už je odehrané (bylo mezi r1–r3) — 409 fáze má přednost; ověř
    // aspoň DTO validaci: klíč mimo enum → 400 z ValidationPipe
    await api()
      .post(`/live-sessions/${session.id}/rounds/${tfRound.id}/votes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: 'X' })
      .expect(400);

    await api()
      .post(`/live-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);
  });

  it('G2: klíč mimo možnosti kola (C na pravda/nepravda) → 400 INVALID_VOTE_OPTION', async () => {
    const session = await createSessionAndStart(teacherToken);
    const tfRound = session.rounds.find((r: any) => r.options.length === 2);
    expect(tfRound).toBeDefined();
    await openVoting(session.id, tfRound.id);
    const bad = await api()
      .post(`/live-sessions/${session.id}/rounds/${tfRound.id}/votes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: 'C' })
      .expect(400);
    expect(bad.body?.code ?? bad.body?.error?.code).toBe('INVALID_VOTE_OPTION');
    await api()
      .post(`/live-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);
  });

  it('H: hlasy nemění XP ani advance — opačné poměry hlasů → identická delta', async () => {
    const results: Array<{ xpDelta: number; playedRounds: number }> = [];
    for (const voteForCorrect of [true, false]) {
      const session = await createSessionAndStart(teacherToken);
      for (const round of session.rounds) {
        await openVoting(session.id, round.id);
        const correct = await correctKeyOf(round.id);
        const key = voteForCorrect ? correct : wrongKeyFor(correct);
        await castVotes(session.id, round.id, key, 5);
        // reveal persistuje auto-outcome → kolo je odehrané bez ručního soudu
        await api()
          .post(`/live-sessions/${session.id}/rounds/${round.id}/reveal`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(201);
      }
      const finish = unwrap(
        await api()
          .post(`/live-sessions/${session.id}/finish`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(201),
      );
      expect(finish.campaignAdvance).toBeNull();
      results.push({
        xpDelta: finish.xpDelta,
        playedRounds: finish.playedRounds,
      });
    }
    const [allCorrect, allWrong] = results as [
      { xpDelta: number; playedRounds: number },
      { xpDelta: number; playedRounds: number },
    ];
    expect(allCorrect.xpDelta).toBe(allWrong.xpDelta);
    expect(allCorrect.playedRounds).toBe(allWrong.playedRounds);
    // a stejná delta jako ruční cesta: kola × 10 + 50
    expect(allCorrect.xpDelta).toBe(
      allCorrect.playedRounds * XP_PER_PLAYED_ROUND + XP_PER_FINISHED_SESSION,
    );
  });

  it('I: RBAC votes — student 403, cizí učitel 403, cizí org 404', async () => {
    const session = await createSessionAndStart(teacherToken);
    const round = session.rounds[0];
    await openVoting(session.id, round.id);

    await api()
      .post(`/live-sessions/${session.id}/rounds/${round.id}/votes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ key: 'A' })
      .expect(403);
    await api()
      .post(`/live-sessions/${session.id}/rounds/${round.id}/votes`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ key: 'A' })
      .expect(403);
    await api()
      .post(`/live-sessions/${session.id}/rounds/${round.id}/votes`)
      .set('Authorization', `Bearer ${teacherBToken}`)
      .send({ key: 'A' })
      .expect(404);
    await api()
      .post(`/live-sessions/${session.id}/rounds/${round.id}/voting`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    await api()
      .post(`/live-sessions/${session.id}/finish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);
  });

  it('F: session bez třídy — finished bez XP', async () => {
    const createRes = await api()
      .post('/live-sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ testId })
      .expect(201);
    const session = unwrap(createRes);
    expect(session.ageMode).toBe('MIDDLE'); // bez třídy → default

    const started = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/start`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    const first = started.rounds[0];
    await playRound(session.id, first.id, LiveRoundOutcome.SPLIT);

    const finish = unwrap(
      await api()
        .post(`/live-sessions/${session.id}/finish`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    expect(finish.xpDelta).toBe(0);
    expect(finish.partak).toBeNull();
  });
});
