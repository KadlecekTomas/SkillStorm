// test/e2e/board-interactions.e2e-spec.ts
/**
 * Interaktivní kola bleskovek (MATCH_PAIRS / ORDER / SORT_BINS) — e2e
 *
 * A. Snapshot & leak guard: projekce vrací board-safe content s round-local
 *    ID (l1/r1, o1, c1/b1 — autorská ID nesmí prosáknout), řešení NIKDY před
 *    dokončením; snapshot je imunní vůči pozdější editaci otázky.
 * B. MATCH_PAIRS: server soudí každé položení; auto-outcome z počtu špatných
 *    pokusů (0 → MOSTLY_CORRECT, 3 → SPLIT, 5 → MOSTLY_WRONG při 4 položkách).
 * C. ORDER: Zkontrolovat vrací masku po pozicích; neúspěšná kontrola = wrong+1;
 *    správné pořadí kolo dokončí; nevalidní rozložení → 400.
 * D. SORT_BINS: totéž pro koše; hraniční práh (2 wrong při 6 kartách →
 *    MOSTLY_CORRECT).
 * E. XP invariant: bezchybné vs. katastrofální řešení → IDENTICKÁ XP delta
 *    (pokusy ani outcome do XP nevstupují).
 * F. Guardy: attempt na kvízové kolo → 409; hlasování na interaktivním kole →
 *    409; tah po dokončení → idempotentní alreadyCompleted; „Ukázat řešení"
 *    dokončí kolo bez aktivity s outcome null.
 * G. RBAC attempts: student 403, cizí učitel v org 403, cizí org 404.
 * H. Publish/assign šev: sada s validním interaktivním obsahem jde publikovat,
 *    žákům zadat nejde (TEST_NOT_ASSIGNABLE); nevalidní obsah → 400 už v DTO.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import * as request from 'supertest';
import {
  LiveRoundOutcome,
  OrganizationStatus,
  PublishStatus,
  QuestionType,
  RoundInteractionType,
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

type ProjectionRound = {
  id: string;
  order: number;
  interactionType: RoundInteractionType;
  content: any;
  attemptStats: any;
  options: unknown[];
  outcome: string | null;
  completedAt: string | null;
  revealedAt: string | null;
  correctKey?: string;
  solution?: any;
};

describe('Live sessions — interaktivní kola (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let orgAId: string;
  let orgBId: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let studentToken: string;
  let teacherBToken: string;
  let testId: string;
  let classSectionId: string;

  const api = () => request(app.getHttpServer());

  async function createSessionAndStart(withClass = true) {
    const createRes = await api()
      .post('/live-sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ testId, ...(withClass ? { classSectionId } : {}) })
      .expect(201);
    const session = unwrap(createRes);
    const startRes = await api()
      .post(`/live-sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(201);
    return unwrap(startRes) as { id: string; rounds: ProjectionRound[] };
  }

  function roundOf(
    projection: { rounds: ProjectionRound[] },
    type: RoundInteractionType,
  ): ProjectionRound {
    const round = projection.rounds.find((r) => r.interactionType === type);
    if (!round) throw new Error(`Round ${type} not found`);
    return round;
  }

  async function solutionOf(roundId: string): Promise<any> {
    const round = await prisma.liveSessionRound.findUniqueOrThrow({
      where: { id: roundId },
      select: { solutionSnapshot: true },
    });
    return round.solutionSnapshot;
  }

  function attempt(
    sessionId: string,
    roundId: string,
    body: object,
    token = teacherToken,
  ) {
    return api()
      .post(`/live-sessions/${sessionId}/rounds/${roundId}/attempts`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  /** Vyřeší MATCH/SORT kolo podle řešení z DB; předtím nasype N špatných tahů. */
  async function solvePlacements(
    sessionId: string,
    round: ProjectionRound,
    wrongAttempts: number,
  ) {
    const solution = await solutionOf(round.id);
    const mapping: Record<string, string> =
      round.interactionType === RoundInteractionType.MATCH_PAIRS
        ? solution.pairs
        : solution.assignment;
    const targets: string[] =
      round.interactionType === RoundInteractionType.MATCH_PAIRS
        ? round.content.right.map((c: any) => c.id)
        : round.content.bins.map((b: any) => b.id);

    const entries = Object.entries(mapping);
    // špatné tahy: první položka na jiný než správný cíl
    for (let i = 0; i < wrongAttempts; i += 1) {
      const [itemId, correctTarget] = entries[0] as [string, string];
      const wrongTarget = targets.find((t) => t !== correctTarget) as string;
      const res = await attempt(sessionId, round.id, {
        kind: 'PLACE',
        itemId,
        targetId: wrongTarget,
      }).expect(201);
      expect(unwrap(res).correct).toBe(false);
    }
    let last: any = null;
    for (const [itemId, targetId] of entries) {
      const res = await attempt(sessionId, round.id, {
        kind: 'PLACE',
        itemId,
        targetId,
      }).expect(201);
      last = unwrap(res);
      expect(last.correct).toBe(true);
    }
    return last;
  }

  /** Vyřeší ORDER kolo; předtím N neúspěšných kontrol (rotace o 1). */
  async function solveOrder(
    sessionId: string,
    round: ProjectionRound,
    failedChecks: number,
  ) {
    const solution = await solutionOf(round.id);
    const correct: string[] = solution.order;
    const rotated = [...correct.slice(1), correct[0] as string];
    for (let i = 0; i < failedChecks; i += 1) {
      const res = await attempt(sessionId, round.id, {
        kind: 'CHECK',
        arrangement: rotated,
      }).expect(201);
      const body = unwrap(res);
      expect(body.solved).toBe(false);
      expect(body.mask).toContain(false);
    }
    const res = await attempt(sessionId, round.id, {
      kind: 'CHECK',
      arrangement: correct,
    }).expect(201);
    return unwrap(res);
  }

  /** Odehraje kvízové kolo (reveal + outcome). */
  async function playQuizRound(
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
      seed: `board_A_${ts}`,
      with: { student: true },
    });
    const ctxB = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `board_B_${ts}`,
    });

    orgAId = ctxA.organization.id;
    orgBId = ctxB.organization.id;
    teacherToken = ctxA.actor.accessToken;
    studentToken = ctxA.student!.accessToken;
    teacherBToken = ctxB.actor.accessToken;
    const otherTeacher = await ctxA.addMember('TEACHER' as any, 'teacher2');
    otherTeacherToken = otherTeacher.accessToken;

    await prisma.organization.updateMany({
      where: { id: { in: [orgAId, orgBId] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    const yearA = await prisma.academicYear.findFirst({
      where: { orgId: orgAId, isCurrent: true },
      select: { id: true },
    });
    if (!yearA) throw new Error('Missing current academic year in orgA');
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
        grade: SchoolGrade.GRADE_4,
        section: 'I',
      },
    });
    classSectionId = classSection.id;

    const teacherMembershipId = ctxA.actor.membership!.id as string;
    const test = await prisma.test.create({
      data: {
        organizationId: orgAId,
        title: 'Interaktivní bleskovka fixture',
        status: PublishStatus.PUBLISHED,
        publishedAt: new Date(),
        creatorId: teacherMembershipId,
        questions: {
          create: [
            {
              text: 'Kvízové kolo — pravda?',
              type: QuestionType.TRUE_FALSE,
              order: 1,
              correctAnswer: 'true',
            },
            {
              text: 'Přiřaďte dvojice',
              type: QuestionType.MATCH_PAIRS,
              order: 2,
              content: {
                pairs: [
                  { id: 'p1', left: 'pes', right: 'štěká' },
                  { id: 'p2', left: 'kočka', right: 'mňouká' },
                  { id: 'p3', left: 'kráva', right: 'bučí' },
                  { id: 'p4', left: 'ovce', right: 'bečí' },
                ],
              },
            },
            {
              text: 'Seřaďte čísla',
              type: QuestionType.ORDER,
              order: 3,
              content: {
                items: [
                  { id: 'i1', text: '1' },
                  { id: 'i2', text: '3' },
                  { id: 'i3', text: '7' },
                  { id: 'i4', text: '9' },
                ],
                labels: { start: 'nejmenší', end: 'největší' },
              },
            },
            {
              text: 'Roztřiďte slova',
              type: QuestionType.SORT_BINS,
              order: 4,
              content: {
                bins: [
                  { id: 'sudá', label: 'Sudá' },
                  { id: 'lichá', label: 'Lichá' },
                ],
                cards: [
                  { id: 'k1', text: '2', binId: 'sudá' },
                  { id: 'k2', text: '4', binId: 'sudá' },
                  { id: 'k3', text: '6', binId: 'sudá' },
                  { id: 'k4', text: '1', binId: 'lichá' },
                  { id: 'k5', text: '3', binId: 'lichá' },
                  { id: 'k6', text: '5', binId: 'lichá' },
                ],
              },
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
      await prisma.liveSessionRound.deleteMany({
        where: { session: { organizationId: { in: orgs } } },
      });
      await prisma.liveSession.deleteMany({
        where: { organizationId: { in: orgs } },
      });
    }
    await app.close();
  });

  it('A: snapshot & leak guard — round-local ID, žádné řešení před dokončením, imunita vůči editaci', async () => {
    const projection = await createSessionAndStart();
    expect(projection.rounds).toHaveLength(4);

    const match = roundOf(projection, RoundInteractionType.MATCH_PAIRS);
    const order = roundOf(projection, RoundInteractionType.ORDER);
    const sort = roundOf(projection, RoundInteractionType.SORT_BINS);
    const quiz = roundOf(projection, RoundInteractionType.QUIZ);

    // Kvíz beze změny chování
    expect(quiz.options.length).toBeGreaterThan(0);
    expect(quiz.correctKey).toBeUndefined();

    // Board-safe content s překlíčovanými round-local ID
    for (const c of match.content.left) expect(c.id).toMatch(/^l\d+$/);
    for (const c of match.content.right) expect(c.id).toMatch(/^r\d+$/);
    for (const c of order.content.items) expect(c.id).toMatch(/^o\d+$/);
    for (const c of sort.content.cards) expect(c.id).toMatch(/^c\d+$/);
    for (const b of sort.content.bins) expect(b.id).toMatch(/^b\d+$/);

    // Autorská ID (p1/i1/k1/sudá) nesmí prosáknout do projekce
    const raw = JSON.stringify([match.content, order.content, sort.content]);
    expect(raw).not.toContain('"p1"');
    expect(raw).not.toContain('"i1"');
    expect(raw).not.toContain('"k1"');
    expect(raw).not.toContain('sudá');

    // Řešení není v odpovědi před dokončením
    expect(match.solution).toBeUndefined();
    expect(order.solution).toBeUndefined();
    expect(sort.solution).toBeUndefined();

    // ORDER: zobrazené pořadí nesmí být rovnou správné
    const solution = await solutionOf(order.id);
    expect(order.content.items.map((i: any) => i.id)).not.toEqual(
      solution.order,
    );

    // Imunita snapshotu: editace autorského obsahu běžící kolo nezmění
    const question = await prisma.question.findFirstOrThrow({
      where: { testId, type: QuestionType.MATCH_PAIRS },
      select: { id: true },
    });
    await prisma.question.update({
      where: { id: question.id },
      data: {
        content: {
          pairs: [
            { id: 'p1', left: 'ZMĚNA', right: 'ZMĚNA2' },
            { id: 'p2', left: 'x', right: 'y' },
            { id: 'p3', left: 'z', right: 'w' },
            { id: 'p4', left: 'q', right: 'r' },
          ],
        },
      },
    });
    const fresh = unwrap(
      await api()
        .get(`/live-sessions/${projection.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200),
    );
    const freshMatch = roundOf(fresh, RoundInteractionType.MATCH_PAIRS);
    expect(JSON.stringify(freshMatch.content)).not.toContain('ZMĚNA');
  });

  it('B: MATCH_PAIRS — soud serveru per tah + auto-outcome prahy (0/3/5 wrong při 4 položkách)', async () => {
    // 0 špatných → MOSTLY_CORRECT
    const p1 = await createSessionAndStart();
    const match1 = roundOf(p1, RoundInteractionType.MATCH_PAIRS);
    const done1 = await solvePlacements(p1.id, match1, 0);
    expect(done1.solved).toBe(true);
    expect(done1.outcome).toBe('MOSTLY_CORRECT');
    expect(done1.solution).toBeDefined();
    expect(done1.placedCount).toBe(4);

    // Po dokončení vrací projekce řešení (revealedAt nastaven)
    const after = unwrap(
      await api()
        .get(`/live-sessions/${p1.id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200),
    );
    const m = roundOf(after, RoundInteractionType.MATCH_PAIRS);
    expect(m.completedAt).not.toBeNull();
    expect(m.solution).toBeDefined();

    // 3 špatné → SPLIT (2 < 3 ≤ 4)
    const p2 = await createSessionAndStart();
    const match2 = roundOf(p2, RoundInteractionType.MATCH_PAIRS);
    const done2 = await solvePlacements(p2.id, match2, 3);
    expect(done2.outcome).toBe('SPLIT');

    // 5 špatných → MOSTLY_WRONG (5 > 4)
    const p3 = await createSessionAndStart();
    const match3 = roundOf(p3, RoundInteractionType.MATCH_PAIRS);
    const done3 = await solvePlacements(p3.id, match3, 5);
    expect(done3.outcome).toBe('MOSTLY_WRONG');
  });

  it('C: ORDER — maska po pozicích, neúspěšné kontroly jako wrong, nevalidní rozložení 400', async () => {
    const projection = await createSessionAndStart();
    const order = roundOf(projection, RoundInteractionType.ORDER);

    // Nevalidní rozložení: chybějící/duplicitní ID
    const ids = order.content.items.map((i: any) => i.id);
    await attempt(projection.id, order.id, {
      kind: 'CHECK',
      arrangement: [ids[0], ids[0], ids[1], ids[2]],
    }).expect(400);
    // PLACE na ORDER → 400
    await attempt(projection.id, order.id, {
      kind: 'PLACE',
      itemId: ids[0],
      targetId: ids[1],
    }).expect(400);

    // 1 neúspěšná kontrola + správné pořadí → MOSTLY_CORRECT (1 ≤ ⌈4/3⌉)
    const done = await solveOrder(projection.id, order, 1);
    expect(done.solved).toBe(true);
    expect(done.checks).toBe(2);
    expect(done.wrong).toBe(1);
    expect(done.outcome).toBe('MOSTLY_CORRECT');
  });

  it('D: SORT_BINS — hraniční práh (2 wrong při 6 kartách → MOSTLY_CORRECT), nevalidní cíl 400', async () => {
    const projection = await createSessionAndStart();
    const sort = roundOf(projection, RoundInteractionType.SORT_BINS);

    await attempt(projection.id, sort.id, {
      kind: 'PLACE',
      itemId: sort.content.cards[0].id,
      targetId: 'neexistuje',
    }).expect(400);
    await attempt(projection.id, sort.id, {
      kind: 'PLACE',
      itemId: 'neexistuje',
      targetId: sort.content.bins[0].id,
    }).expect(400);

    const done = await solvePlacements(projection.id, sort, 2);
    expect(done.solved).toBe(true);
    expect(done.wrong).toBe(2);
    expect(done.outcome).toBe('MOSTLY_CORRECT'); // 2 = ⌈6/3⌉ — hranice včetně
  });

  it('E: XP invariant — bezchybné vs. katastrofální řešení → identická delta', async () => {
    async function playWholeSession(chaos: boolean): Promise<number> {
      const projection = await createSessionAndStart();
      const quiz = roundOf(projection, RoundInteractionType.QUIZ);
      const match = roundOf(projection, RoundInteractionType.MATCH_PAIRS);
      const order = roundOf(projection, RoundInteractionType.ORDER);
      const sort = roundOf(projection, RoundInteractionType.SORT_BINS);

      await playQuizRound(
        projection.id,
        quiz.id,
        chaos ? LiveRoundOutcome.MOSTLY_WRONG : LiveRoundOutcome.MOSTLY_CORRECT,
      );
      await solvePlacements(projection.id, match, chaos ? 6 : 0);
      await solveOrder(projection.id, order, chaos ? 5 : 0);
      await solvePlacements(projection.id, sort, chaos ? 8 : 0);

      const finish = unwrap(
        await api()
          .post(`/live-sessions/${projection.id}/finish`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(201),
      );
      expect(finish.playedRounds).toBe(4);
      return finish.xpDelta as number;
    }

    const perfectDelta = await playWholeSession(false);
    const chaosDelta = await playWholeSession(true);
    const expected = 4 * XP_PER_PLAYED_ROUND + XP_PER_FINISHED_SESSION;
    expect(perfectDelta).toBe(expected);
    expect(chaosDelta).toBe(expected);
  });

  it('F: guardy — kvíz vs. interaktivní šev, idempotentní doběh, Ukázat řešení', async () => {
    const projection = await createSessionAndStart();
    const quiz = roundOf(projection, RoundInteractionType.QUIZ);
    const match = roundOf(projection, RoundInteractionType.MATCH_PAIRS);
    const sort = roundOf(projection, RoundInteractionType.SORT_BINS);

    // Attempt na kvízové kolo → 409
    const quizAttempt = await attempt(projection.id, quiz.id, {
      kind: 'PLACE',
      itemId: 'l1',
      targetId: 'r1',
    }).expect(409);
    expect(quizAttempt.body.code ?? quizAttempt.body.error?.code).toBeDefined();

    // Hlasování na interaktivním kole → 409 ROUND_NOT_QUIZ
    await api()
      .post(`/live-sessions/${projection.id}/rounds/${match.id}/voting`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(409);
    await api()
      .post(`/live-sessions/${projection.id}/rounds/${match.id}/votes`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: 'A' })
      .expect(409);

    // Ukázat řešení bez jediného tahu → dokončeno, outcome null (soudí učitel)
    const reveal = unwrap(
      await api()
        .post(`/live-sessions/${projection.id}/rounds/${sort.id}/reveal`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(201),
    );
    expect(reveal.solution).toBeDefined();
    expect(reveal.outcome).toBeNull();
    const sortDb = await prisma.liveSessionRound.findUniqueOrThrow({
      where: { id: sort.id },
      select: { completedAt: true, revealedAt: true },
    });
    expect(sortDb.completedAt).not.toBeNull();
    expect(sortDb.revealedAt).not.toBeNull();

    // Tah po dokončení → idempotentní doběh (alreadyCompleted, žádná chyba)
    const late = unwrap(
      await attempt(projection.id, sort.id, {
        kind: 'PLACE',
        itemId: sort.content.cards[0].id,
        targetId: sort.content.bins[0].id,
      }).expect(201),
    );
    expect(late.alreadyCompleted).toBe(true);
    expect(late.solved).toBe(true);
  });

  it('G: RBAC attempts — student 403, cizí učitel 403, cizí org 404', async () => {
    const projection = await createSessionAndStart();
    const match = roundOf(projection, RoundInteractionType.MATCH_PAIRS);
    const body = { kind: 'PLACE', itemId: 'l1', targetId: 'r1' };

    await attempt(projection.id, match.id, body, studentToken).expect(403);
    await attempt(projection.id, match.id, body, otherTeacherToken).expect(403);
    await attempt(projection.id, match.id, body, teacherBToken).expect(404);
  });

  it('H: publish/assign šev — validní interaktivní sada publikuje, žákům nejde zadat', async () => {
    // Nezávislý na seedu katalogu: celý řetězec catalog → subject → orgSubject
    const catalogSubject = await prisma.catalogSubject.create({
      data: { code: `BOARD_${Date.now()}`, name: 'Board fixture předmět' },
      select: { id: true },
    });
    const subject = await prisma.subject.create({
      data: {
        catalogSubjectId: catalogSubject.id,
        name: 'Board fixture předmět',
      },
      select: { id: true },
    });
    const orgSubject = { subjectId: subject.id };
    await prisma.orgSubject.create({
      data: {
        organizationId: orgAId,
        subjectId: subject.id,
        isEnabled: true,
      },
    });

    const created = unwrap(
      await api()
        .post('/tests')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Publikovatelná interaktivní sada',
          subjectId: orgSubject.subjectId,
        })
        .expect(201),
    );
    const newTestId = created.id as string;

    // Nevalidní obsah (2 dvojice) → 400 INVALID_INTERACTIVE_CONTENT
    await api()
      .post(`/tests/${newTestId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'Málo dvojic',
        type: 'MATCH_PAIRS',
        content: {
          pairs: [
            { id: 'p1', left: 'a', right: 'b' },
            { id: 'p2', left: 'c', right: 'd' },
          ],
        },
      })
      .expect(400);

    // correctAnswer na interaktivním typu → 400 (validator odpovědí)
    await api()
      .post(`/tests/${newTestId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'Odpověď nepatří do content typu',
        type: 'ORDER',
        correctAnswer: 'x',
        content: { items: [] },
      })
      .expect(400);

    // Validní interaktivní otázka přes API
    await api()
      .post(`/tests/${newTestId}/questions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        text: 'Seřaďte',
        type: 'ORDER',
        content: {
          items: [
            { id: 'i1', text: 'a' },
            { id: 'i2', text: 'b' },
            { id: 'i3', text: 'c' },
            { id: 'i4', text: 'd' },
          ],
        },
      })
      .expect(201);

    // Publish vyžaduje topic + allowedGrades — doplnit fixture chain
    await ensureTopicAssignment(prisma, newTestId);

    await api()
      .patch(`/tests/${newTestId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    // Zadání žákům blokováno
    const assignRes = await api()
      .post(`/tests/${newTestId}/assign`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        classSectionId,
        openAt: new Date().toISOString(),
        closeAt: new Date(Date.now() + 86_400_000).toISOString(),
        maxAttempts: 1,
        shuffle: false,
        showExplain: 'none',
      });
    expect([400, 409]).toContain(assignRes.status);
    const errBody = JSON.stringify(assignRes.body);
    expect(errBody).toContain('TEST_NOT_ASSIGNABLE');

    // …ale bleskovku z ní spustit jde
    const sessionRes = await api()
      .post('/live-sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ testId: newTestId })
      .expect(201);
    expect(unwrap(sessionRes).id).toBeDefined();
  });

  /** Publish chain: catalog topic → subjectLevel → topicLevel → TestAssignment. */
  async function ensureTopicAssignment(db: PrismaService, id: string) {
    const test = await db.test.findUnique({
      where: { id },
      select: { subjectId: true },
    });
    if (!test?.subjectId) throw new Error('Test bez subjectId');
    const subject = await db.subject.findUnique({
      where: { id: test.subjectId },
      select: { catalogSubjectId: true },
    });
    if (!subject?.catalogSubjectId) {
      throw new Error('Subject bez catalogSubjectId');
    }
    const catalogTopic = await db.catalogTopic.create({
      data: {
        subjectId: subject.catalogSubjectId,
        name: `Board topic ${Date.now()}`,
      },
      select: { id: true },
    });
    const subjectLevel = await db.subjectLevel.upsert({
      where: {
        subjectId_grade: {
          subjectId: test.subjectId,
          grade: SchoolGrade.GRADE_4,
        },
      },
      update: {},
      create: { subjectId: test.subjectId, grade: SchoolGrade.GRADE_4 },
      select: { id: true },
    });
    const topicLevel = await db.topicLevel.create({
      data: {
        subjectLevelId: subjectLevel.id,
        catalogTopicId: catalogTopic.id,
      },
      select: { id: true },
    });
    await db.testAssignment.create({
      data: { testId: id, topicLevelId: topicLevel.id, isPrimary: true },
    });
    await db.test.updateMany({
      where: { id, allowedGrades: { isEmpty: true } },
      data: { allowedGrades: [SchoolGrade.GRADE_4] },
    });
  }
});
