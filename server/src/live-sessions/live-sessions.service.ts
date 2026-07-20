import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LiveRoundOutcome,
  LiveSessionStatus,
  Prisma,
  PublishStatus,
  QuestionType,
  RoundInteractionType,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { OrgContext } from '@/common/org-context/org-context.types';
import {
  CampaignsService,
  CampaignAdvanceResult,
} from '@/campaigns/campaigns.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import {
  EMPTY_ATTEMPT_STATS,
  OPTION_KEYS,
  OptionKey,
  RoundAttemptStats,
  RoundOptionSnapshot,
  RoundVoteCounts,
  XP_PER_FINISHED_SESSION,
  XP_PER_PLAYED_ROUND,
  computeAttemptOutcome,
  computeStage,
  computeVoteOutcome,
  resolveDefaultLiveAgeMode,
} from './live-sessions.constants';
import {
  isInteractiveQuestionType,
  INTERACTIVE_QUESTION_TYPES,
} from '@/shared/interactive-content.util';
import {
  InteractiveBoardContent,
  InteractiveSolution,
  buildInteractiveSnapshot,
  validItemIds,
  validTargetIds,
} from './interactive-rounds.util';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

const TRUE_FALSE_OPTIONS = [
  { text: 'Pravda', value: 'true' },
  { text: 'Nepravda', value: 'false' },
] as const;

type QuestionWithOptions = {
  id: string;
  text: string;
  type: QuestionType;
  order: number | null;
  correctAnswer: string | null;
  correctAnswers: string[];
  content: unknown;
  options: { id: string; text: string }[];
};

/** Snapshot kola při startu — kvíz, nebo interaktivní obsah + řešení. */
type RoundSnapshot =
  | { kind: 'QUIZ'; options: RoundOptionSnapshot[]; correctKey: string }
  | {
      kind: 'INTERACTIVE';
      interactionType: RoundInteractionType;
      content: InteractiveBoardContent;
      solution: InteractiveSolution;
    };

/** Kolo pro projekci — correctKey/solution jen u už odhalených kol (refresh mid-session). */
export interface ProjectionRound {
  id: string;
  order: number;
  questionText: string;
  interactionType: RoundInteractionType;
  /** QUIZ only — u interaktivních kol prázdné pole. */
  options: RoundOptionSnapshot[];
  /** Interaktivní kola — board-safe obsah (bez řešení). */
  content: InteractiveBoardContent | null;
  /** Interaktivní kola — anonymní agregát průběhu (obnova plochy po refreshi). */
  attemptStats: RoundAttemptStats | null;
  outcome: LiveRoundOutcome | null;
  /** Anonymní agregáty hlasů z tabule; null = kolo bez hlasování. */
  voteCounts: RoundVoteCounts | null;
  votingStartedAt: Date | null;
  revealedAt: Date | null;
  completedAt: Date | null;
  correctKey?: string;
  solution?: InteractiveSolution;
}

function sumVotes(counts: RoundVoteCounts): number {
  return Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
}

function normalizeAnswer(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Otázka je použitelná v bleskovce, pokud je interaktivní (MATCH_PAIRS/ORDER/
 * SORT_BINS s validním obsahem), nebo ji lze zobrazit jako single-choice
 * A/B/C/D: TRUE_FALSE vždy, MULTIPLE_CHOICE jen single-mode (correctAnswer,
 * ne correctAnswers[]) s 2–4 možnostmi, z nichž právě jedna je správná.
 */
function buildRoundSnapshot(q: QuestionWithOptions): RoundSnapshot | null {
  if (isInteractiveQuestionType(q.type)) {
    const snap = buildInteractiveSnapshot(q.type, q.content);
    if (!snap) return null;
    return {
      kind: 'INTERACTIVE',
      interactionType: q.type as unknown as RoundInteractionType,
      content: snap.content,
      solution: snap.solution,
    };
  }
  const quiz = buildQuizSnapshot(q);
  return quiz ? { kind: 'QUIZ', ...quiz } : null;
}

function buildQuizSnapshot(
  q: QuestionWithOptions,
): { options: RoundOptionSnapshot[]; correctKey: string } | null {
  if (q.type === QuestionType.TRUE_FALSE) {
    if (!q.correctAnswer) return null;
    const correctValue = normalizeAnswer(q.correctAnswer);
    if (correctValue !== 'true' && correctValue !== 'false') return null;
    const options = TRUE_FALSE_OPTIONS.map((o, i) => ({
      key: OPTION_KEYS[i] as OptionKey,
      text: o.text as string,
    }));
    return {
      options,
      correctKey: (correctValue === 'true' ? 'A' : 'B') as OptionKey,
    };
  }

  if (q.type !== QuestionType.MULTIPLE_CHOICE) return null;
  if (q.correctAnswers.length > 0) return null; // multi-mode nelze soudit 3 tlačítky
  if (!q.correctAnswer) return null;
  if (q.options.length < 2 || q.options.length > OPTION_KEYS.length) {
    return null;
  }

  const correctNorm = normalizeAnswer(q.correctAnswer);
  const matching = q.options.filter(
    (o) => normalizeAnswer(o.text) === correctNorm,
  );
  if (matching.length !== 1) return null;

  const shuffled = shuffle(q.options);
  const options = shuffled.map((o, i) => ({
    key: OPTION_KEYS[i] as OptionKey,
    text: o.text,
  }));
  const correctIndex = shuffled.findIndex(
    (o) => normalizeAnswer(o.text) === correctNorm,
  );
  return { options, correctKey: OPTION_KEYS[correctIndex] as OptionKey };
}

@Injectable()
export class LiveSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
  ) {}

  async create(dto: CreateLiveSessionDto, ctx: OrgContext) {
    const test = await this.prisma.test.findFirst({
      where: {
        id: dto.testId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });
    if (!test) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Sada otázek nebyla nalezena.',
      });
    }
    if (test.status !== PublishStatus.PUBLISHED) {
      throw new BadRequestException({
        code: 'TEST_NOT_PUBLISHED',
        message: 'Bleskovku lze spustit jen z publikované sady.',
      });
    }

    const compatible = await this.loadCompatibleQuestions(dto.testId);
    if (compatible.length === 0) {
      throw new BadRequestException({
        code: 'NO_LIVE_COMPATIBLE_QUESTIONS',
        message:
          'Sada neobsahuje žádnou otázku použitelnou v bleskovce (A/B/C/D nebo pravda/nepravda).',
      });
    }

    let classSectionGrade = null;
    if (dto.classSectionId) {
      const classSection = await this.prisma.classSection.findFirst({
        where: { id: dto.classSectionId, orgId: ctx.organizationId },
        select: { id: true, grade: true },
      });
      if (!classSection) {
        throw new NotFoundException({
          code: 'CLASS_SECTION_NOT_FOUND',
          message: 'Třída nebyla nalezena.',
        });
      }
      classSectionGrade = classSection.grade;
    }

    if (dto.campaignProgressId) {
      await this.campaigns.assertSessionLink(
        dto.campaignProgressId,
        dto.classSectionId,
        ctx,
      );
    }

    return this.prisma.liveSession.create({
      data: {
        organizationId: ctx.organizationId,
        hostId: ctx.membershipId,
        classSectionId: dto.classSectionId ?? null,
        testId: dto.testId,
        ageMode: dto.ageMode ?? resolveDefaultLiveAgeMode(classSectionGrade),
        countdownSec: dto.countdownSec ?? null,
        campaignProgressId: dto.campaignProgressId ?? null,
      },
      select: this.sessionSelect(),
    });
  }

  /** DRAFT → RUNNING: nasnapshotuje otázky do kol. Šev režimu A: mezi create a start se vklíní lobby. */
  async start(id: string, ctx: OrgContext) {
    const session = await this.getOwnedSession(id, ctx);
    if (session.status !== LiveSessionStatus.DRAFT) {
      throw new ConflictException({
        code: 'ALREADY_STARTED',
        message: 'Bleskovka už byla spuštěna.',
      });
    }

    const compatible = await this.loadCompatibleQuestions(session.testId);
    const snapshots = compatible
      .map((q) => ({ q, snap: buildRoundSnapshot(q) }))
      .filter(
        (
          x,
        ): x is {
          q: QuestionWithOptions;
          snap: RoundSnapshot;
        } => x.snap !== null,
      );
    if (snapshots.length === 0) {
      throw new BadRequestException({
        code: 'NO_LIVE_COMPATIBLE_QUESTIONS',
        message: 'Sada už neobsahuje žádnou použitelnou otázku.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // updateMany guard: count=0 → souběžný start (stejný vzor jako publish testu)
      const res = await tx.liveSession.updateMany({
        where: { id, status: LiveSessionStatus.DRAFT },
        data: { status: LiveSessionStatus.RUNNING, startedAt: new Date() },
      });
      if (res.count === 0) {
        throw new ConflictException({
          code: 'ALREADY_STARTED',
          message: 'Bleskovka už byla spuštěna.',
        });
      }
      await tx.liveSessionRound.createMany({
        data: snapshots.map(({ q, snap }, i) => {
          const base = {
            sessionId: id,
            order: i + 1,
            questionId: q.id,
            questionText: q.text,
          };
          if (snap.kind === 'QUIZ') {
            return {
              ...base,
              interactionType: RoundInteractionType.QUIZ,
              optionsSnapshot: snap.options as unknown as Prisma.InputJsonValue,
              correctKeySnapshot: snap.correctKey,
            };
          }
          return {
            ...base,
            interactionType: snap.interactionType,
            contentSnapshot: snap.content as unknown as Prisma.InputJsonValue,
            solutionSnapshot: snap.solution as unknown as Prisma.InputJsonValue,
            // Nenulové stats od začátku — atomické jsonb_set v submitAttempt
            // nemusí řešit NULL sloupec.
            attemptStats:
              EMPTY_ATTEMPT_STATS as unknown as Prisma.InputJsonValue,
          };
        }),
      });
    });

    return this.getProjection(id, ctx);
  }

  /**
   * Data pro projekci. correctKey se vrací POUZE u kol s revealedAt — projekce
   * běží na sdíleném/školním zařízení a network tab nesmí prozradit odpovědi
   * budoucích kol. Stejný kontrakt bude platit pro režim A.
   */
  async getProjection(id: string, ctx: OrgContext) {
    const session = await this.getOwnedSession(id, ctx);
    const rounds = await this.prisma.liveSessionRound.findMany({
      where: { sessionId: id },
      orderBy: { order: 'asc' },
    });

    return {
      id: session.id,
      status: session.status,
      mode: session.mode,
      ageMode: session.ageMode,
      countdownSec: session.countdownSec,
      classSectionId: session.classSectionId,
      campaignProgressId: session.campaignProgressId,
      testTitle: session.test.title,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      rounds: rounds.map((r): ProjectionRound => {
        const base: ProjectionRound = {
          id: r.id,
          order: r.order,
          questionText: r.questionText,
          interactionType: r.interactionType,
          options:
            (r.optionsSnapshot as unknown as RoundOptionSnapshot[] | null) ??
            [],
          content:
            (r.contentSnapshot as unknown as InteractiveBoardContent | null) ??
            null,
          attemptStats: (r.attemptStats as RoundAttemptStats | null) ?? null,
          outcome: r.outcome,
          voteCounts: (r.voteCounts as RoundVoteCounts | null) ?? null,
          votingStartedAt: r.votingStartedAt,
          revealedAt: r.revealedAt,
          completedAt: r.completedAt,
        };
        if (r.revealedAt) {
          if (r.correctKeySnapshot) base.correctKey = r.correctKeySnapshot;
          if (r.solutionSnapshot) {
            base.solution =
              r.solutionSnapshot as unknown as InteractiveSolution;
          }
        }
        return base;
      }),
    };
  }

  /**
   * Otevře fázi VOTING (volitelná, mezi otázkou a revealem). Idempotentní.
   * Hlasování je anonymní agregát z tabule — žádná vazba na osoby.
   */
  async openVoting(id: string, roundId: string, ctx: OrgContext) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);
    const round = await this.getRound(id, roundId);
    this.assertQuizRound(round.interactionType);
    if (round.revealedAt) {
      throw new ConflictException({
        code: 'ROUND_ALREADY_REVEALED',
        message: 'Po odhalení odpovědi už hlasovat nelze.',
      });
    }

    if (!round.votingStartedAt) {
      const updated = await this.prisma.liveSessionRound.update({
        where: { id: roundId },
        data: { votingStartedAt: new Date(), voteCounts: {} },
        select: { id: true, votingStartedAt: true, voteCounts: true },
      });
      return {
        roundId,
        votingStartedAt: updated.votingStartedAt,
        voteCounts: updated.voteCounts as RoundVoteCounts,
      };
    }
    return {
      roundId,
      votingStartedAt: round.votingStartedAt,
      voteCounts: (round.voteCounts as RoundVoteCounts | null) ?? {},
    };
  }

  /**
   * Jeden dotyk na tabuli (tap +1 / long-press −1). Přijímá se POUZE ve fázi
   * VOTING (votingStartedAt nastaveno, revealedAt ne) — jinak 409. Inkrement
   * je atomický v SQL a klampovaný na 0; correctKey se nevrací (reveal gating).
   */
  async castVote(
    id: string,
    roundId: string,
    key: OptionKey,
    delta: 1 | -1,
    ctx: OrgContext,
  ) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);
    const round = await this.getRound(id, roundId);
    this.assertQuizRound(round.interactionType);
    if (!round.votingStartedAt || round.revealedAt) {
      throw new ConflictException({
        code: 'ROUND_NOT_VOTING',
        message: 'Kolo teď není ve fázi hlasování.',
      });
    }
    const options = round.optionsSnapshot as unknown as RoundOptionSnapshot[];
    if (!options.some((o) => o.key === key)) {
      throw new BadRequestException({
        code: 'INVALID_VOTE_OPTION',
        message: 'Toto kolo takovou možnost nemá.',
      });
    }

    // WHERE fáze guard i v SQL — souběžný reveal mezi checkem a updatem
    // hlas zahodí místo zápisu do už odhaleného kola.
    const affected = await this.prisma.$executeRaw`
      UPDATE live_session_rounds
      SET vote_counts = jsonb_set(
        COALESCE(vote_counts, '{}'::jsonb),
        ARRAY[${key}]::text[],
        to_jsonb(GREATEST(0, COALESCE((vote_counts ->> ${key})::int, 0) + ${delta}))
      )
      WHERE live_session_round_id = ${roundId}
        AND voting_started_at IS NOT NULL
        AND revealed_at IS NULL
    `;
    if (affected === 0) {
      throw new ConflictException({
        code: 'ROUND_NOT_VOTING',
        message: 'Kolo teď není ve fázi hlasování.',
      });
    }

    const fresh = await this.prisma.liveSessionRound.findUnique({
      where: { id: roundId },
      select: { voteCounts: true },
    });
    const voteCounts = (fresh?.voteCounts as RoundVoteCounts | null) ?? {};
    return { roundId, voteCounts, totalVotes: sumVotes(voteCounts) };
  }

  /**
   * Jeden tah na tabuli v interaktivním kole (MATCH_PAIRS/ORDER/SORT_BINS).
   * Server soudí každé položení — řešení neopouští server před dokončením.
   * Neblokující pro souběžné tahy (děti u tabule nečekají): stats se
   * inkrementují atomicky v SQL s fázovým guardem ve WHERE, dokončení jde
   * přes updateMany (completed_at IS NULL) — poslední souběžné položení
   * vyhrává závod přesně jednou.
   */
  async submitAttempt(
    id: string,
    roundId: string,
    dto: SubmitAttemptDto,
    ctx: OrgContext,
  ) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);
    const round = await this.getRound(id, roundId);
    if (round.interactionType === RoundInteractionType.QUIZ) {
      throw new ConflictException({
        code: 'ROUND_NOT_INTERACTIVE',
        message: 'Kvízové kolo se neřeší tahy na tabuli.',
      });
    }
    const content = round.contentSnapshot as unknown as InteractiveBoardContent;
    const solution = round.solutionSnapshot as unknown as InteractiveSolution;
    const itemCount = this.roundItemCount(round);

    // Idempotentní doběh: tah, který dorazí po dokončení kola (souběžné
    // taháky, pomalá wifi), vrátí hotový stav místo chyby.
    if (round.completedAt) {
      return this.attemptResponse(round.id, round, itemCount, {
        alreadyCompleted: true,
      });
    }

    if (dto.kind === 'PLACE') {
      if (content.kind === 'ORDER') {
        throw new BadRequestException({
          code: 'ATTEMPT_KIND_MISMATCH',
          message: 'Kolo ORDER se kontroluje tlačítkem Zkontrolovat (CHECK).',
        });
      }
      const itemId = dto.itemId as string;
      const targetId = dto.targetId as string;
      if (!validItemIds(content).has(itemId)) {
        throw new BadRequestException({
          code: 'INVALID_ATTEMPT_ITEM',
          message: 'Toto kolo takovou kartičku nemá.',
        });
      }
      if (!validTargetIds(content).has(targetId)) {
        throw new BadRequestException({
          code: 'INVALID_ATTEMPT_TARGET',
          message: 'Toto kolo takový cíl nemá.',
        });
      }
      const expected =
        content.kind === 'MATCH_PAIRS'
          ? (solution as { pairs: Record<string, string> }).pairs[itemId]
          : (solution as { assignment: Record<string, string> }).assignment[
              itemId
            ];
      const correct = expected === targetId;

      if (correct) {
        // Správné položení: placed.itemId = targetId (idempotentní na duplicitní
        // tap). WHERE guard zahodí zápis do mezitím dokončeného kola.
        await this.prisma.$executeRaw`
          UPDATE live_session_rounds
          SET attempt_stats = jsonb_set(
            attempt_stats,
            ARRAY['placed', ${itemId}]::text[],
            to_jsonb(${targetId}::text)
          )
          WHERE live_session_round_id = ${roundId}
            AND completed_at IS NULL
        `;
      } else {
        await this.incrementWrong(roundId);
      }
      const finished = await this.maybeCompleteInteractive(roundId, itemCount);
      const fresh = await this.getRound(id, roundId);
      return this.attemptResponse(roundId, fresh, itemCount, {
        correct,
        justCompleted: finished,
      });
    }

    // CHECK — pouze ORDER
    if (content.kind !== 'ORDER') {
      throw new BadRequestException({
        code: 'ATTEMPT_KIND_MISMATCH',
        message: 'Zkontrolovat patří jen kolu ORDER.',
      });
    }
    const arrangement = dto.arrangement ?? [];
    const expectedOrder = (solution as { order: string[] }).order;
    const validIds = validItemIds(content);
    if (
      arrangement.length !== expectedOrder.length ||
      new Set(arrangement).size !== arrangement.length ||
      arrangement.some((itemId) => !validIds.has(itemId))
    ) {
      throw new BadRequestException({
        code: 'INVALID_ARRANGEMENT',
        message: 'Rozložení neodpovídá kartičkám kola.',
      });
    }
    const mask = arrangement.map((itemId, i) => itemId === expectedOrder[i]);
    const solved = mask.every(Boolean);
    // checks vždy +1, neúspěšná kontrola navíc wrong +1 (prahy počítají
    // neúspěšné kontroly, ne jednotlivé pozice — viz konstanty).
    await this.prisma.$executeRaw`
      UPDATE live_session_rounds
      SET attempt_stats = jsonb_set(
        jsonb_set(
          attempt_stats,
          '{checks}',
          to_jsonb(COALESCE((attempt_stats ->> 'checks')::int, 0) + 1)
        ),
        '{wrong}',
        to_jsonb(COALESCE((attempt_stats ->> 'wrong')::int, 0) + ${solved ? 0 : 1})
      )
      WHERE live_session_round_id = ${roundId}
        AND completed_at IS NULL
    `;
    let justCompleted = false;
    if (solved) {
      justCompleted = await this.completeInteractive(roundId, itemCount);
    }
    const fresh = await this.getRound(id, roundId);
    return this.attemptResponse(roundId, fresh, itemCount, {
      mask,
      justCompleted,
    });
  }

  /**
   * Odhalí správnou odpověď — až teď correctKey opouští server. Idempotentní.
   * Pokud se v kole hlasovalo, spočítá a předvyplní auto-outcome (prahy viz
   * computeVoteOutcome); učitel ho může přepsat přes setOutcome — jeho slovo
   * je finální. Hlasy do XP/kampaní nevstupují (finish počítá jen completedAt).
   */
  async reveal(id: string, roundId: string, ctx: OrgContext) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);
    const round = await this.getRound(id, roundId);
    if (round.interactionType !== RoundInteractionType.QUIZ) {
      return this.revealInteractive(round);
    }

    // QUIZ kolo má correctKeySnapshot vždy (nullability patří interaktivním).
    const correctKey = round.correctKeySnapshot as string;
    const voteCounts = (round.voteCounts as RoundVoteCounts | null) ?? null;
    const autoOutcome = computeVoteOutcome(voteCounts, correctKey);

    let outcome = round.outcome;
    if (!round.revealedAt) {
      const now = new Date();
      // auto-outcome se persistuje hned při revealu — kolo je tím odehrané;
      // ruční přepsání učitelem jde přes stávající setOutcome
      outcome = round.outcome ?? autoOutcome;
      await this.prisma.liveSessionRound.update({
        where: { id: roundId },
        data: {
          revealedAt: now,
          ...(outcome && !round.outcome
            ? { outcome, completedAt: round.completedAt ?? now }
            : {}),
        },
      });
    }
    return {
      roundId,
      correctKey: round.correctKeySnapshot,
      voteCounts,
      totalVotes: voteCounts ? sumVotes(voteCounts) : 0,
      autoOutcome,
      outcome,
    };
  }

  /**
   * Reveal interaktivního kola — „Ukázat řešení". Učitelská pojistka, když se
   * třída zasekne; normálně kolo dokončí děti samy (submitAttempt). Idempotentní.
   * Auto-outcome z dosavadních pokusů; bez jediného tahu zůstává null (soudí
   * učitel ručně přes setOutcome).
   */
  private async revealInteractive(
    round: Awaited<ReturnType<LiveSessionsService['getRound']>>,
  ) {
    const stats =
      (round.attemptStats as RoundAttemptStats | null) ?? EMPTY_ATTEMPT_STATS;
    const itemCount = this.roundItemCount(round);
    const hasActivity =
      stats.wrong > 0 ||
      stats.checks > 0 ||
      Object.keys(stats.placed).length > 0;
    const autoOutcome = hasActivity
      ? computeAttemptOutcome(stats.wrong, itemCount)
      : null;

    let outcome = round.outcome;
    if (!round.revealedAt) {
      const now = new Date();
      outcome = round.outcome ?? autoOutcome;
      await this.prisma.liveSessionRound.update({
        where: { id: round.id },
        data: {
          revealedAt: now,
          completedAt: round.completedAt ?? now,
          ...(outcome && !round.outcome ? { outcome } : {}),
        },
      });
    }
    return {
      roundId: round.id,
      interactionType: round.interactionType,
      solution: round.solutionSnapshot as unknown as InteractiveSolution,
      attemptStats: stats,
      autoOutcome,
      outcome,
    };
  }

  /** Učitelův soud kola (3 tlačítka). Vyžaduje předchozí reveal; lze opravit dokud session běží. */
  async setOutcome(
    id: string,
    roundId: string,
    outcome: LiveRoundOutcome,
    ctx: OrgContext,
  ) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);
    const round = await this.getRound(id, roundId);
    if (!round.revealedAt) {
      throw new BadRequestException({
        code: 'ROUND_NOT_REVEALED',
        message: 'Výsledek kola lze zadat až po odhalení odpovědi.',
      });
    }

    const updated = await this.prisma.liveSessionRound.update({
      where: { id: roundId },
      data: { outcome, completedAt: round.completedAt ?? new Date() },
      select: { id: true, order: true, outcome: true, completedAt: true },
    });
    return updated;
  }

  /**
   * RUNNING → FINISHED + atomické připsání XP třídnímu parťákovi.
   * XP = odehraná kola × XP_PER_PLAYED_ROUND + XP_PER_FINISHED_SESSION.
   * Outcome (správnost) do výpočtu záměrně NEVSTUPUJE.
   */
  async finish(id: string, ctx: OrgContext) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);

    const playedRounds = await this.prisma.liveSessionRound.count({
      where: { sessionId: id, completedAt: { not: null } },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const res = await tx.liveSession.updateMany({
        where: { id, status: LiveSessionStatus.RUNNING },
        data: {
          status: LiveSessionStatus.FINISHED,
          finishedAt: new Date(),
          xpAwarded: session.classSectionId != null,
        },
      });
      if (res.count === 0) {
        throw new ConflictException({
          code: 'ALREADY_FINISHED',
          message: 'Bleskovka už byla ukončena.',
        });
      }

      // Kampaňový postup — atomicky se session XP, idempotentně (unique
      // sessionId na unlocku). Správnost/outcome do postupu NEVSTUPUJE,
      // počítá se jen ≥ 1 odehrané kolo (decisions R3).
      let campaignAdvance: CampaignAdvanceResult | null = null;
      if (session.campaignProgressId) {
        campaignAdvance = await this.campaigns.advanceWithinTransaction(tx, {
          sessionId: id,
          campaignProgressId: session.campaignProgressId,
          roundsPlayed: playedRounds,
        });
      }

      if (!session.classSectionId) {
        return { partak: null, xpDelta: 0, stageUp: false, campaignAdvance };
      }

      const xpDelta =
        playedRounds * XP_PER_PLAYED_ROUND + XP_PER_FINISHED_SESSION;
      const existing = await tx.classPartak.upsert({
        where: { classSectionId: session.classSectionId },
        create: {
          organizationId: ctx.organizationId,
          classSectionId: session.classSectionId,
          xp: 0,
        },
        update: {},
      });
      const newXp = existing.xp + xpDelta;
      const newStage = computeStage(newXp);
      const partak = await tx.classPartak.update({
        where: { id: existing.id },
        data: { xp: newXp, stage: newStage },
      });
      await tx.classPartakXpEvent.createMany({
        data: [
          {
            classPartakId: partak.id,
            sessionId: id,
            type: 'ROUND_PLAYED',
            value: playedRounds * XP_PER_PLAYED_ROUND,
          },
          {
            classPartakId: partak.id,
            sessionId: id,
            type: 'SESSION_FINISHED',
            value: XP_PER_FINISHED_SESSION,
          },
        ],
      });
      return {
        partak: { xp: partak.xp, stage: partak.stage },
        xpDelta,
        stageUp: partak.stage > existing.stage,
        campaignAdvance,
      };
    });

    const outcomes = await this.prisma.liveSessionRound.groupBy({
      by: ['outcome'],
      where: { sessionId: id },
      _count: true,
    });

    return {
      id,
      status: LiveSessionStatus.FINISHED,
      playedRounds,
      outcomes: outcomes.map((o) => ({
        outcome: o.outcome,
        count: o._count,
      })),
      xpDelta: result.xpDelta,
      previousXp: result.partak ? result.partak.xp - result.xpDelta : null,
      partak: result.partak,
      stageUp: result.stageUp,
      campaignAdvance: result.campaignAdvance,
    };
  }

  /** Stav třídního parťáka. Žádný list/ranking endpoint záměrně neexistuje. */
  async getClassPartak(classSectionId: string, ctx: OrgContext) {
    const classSection = await this.prisma.classSection.findFirst({
      where: { id: classSectionId, orgId: ctx.organizationId },
      select: { id: true },
    });
    if (!classSection) {
      throw new NotFoundException({
        code: 'CLASS_SECTION_NOT_FOUND',
        message: 'Třída nebyla nalezena.',
      });
    }
    const partak = await this.prisma.classPartak.findUnique({
      where: { classSectionId },
      select: { xp: true, stage: true },
    });
    return { classSectionId, xp: partak?.xp ?? 0, stage: partak?.stage ?? 1 };
  }

  // ---------------------------------------------------------------

  private sessionSelect() {
    return {
      id: true,
      organizationId: true,
      status: true,
      mode: true,
      ageMode: true,
      countdownSec: true,
      classSectionId: true,
      campaignProgressId: true,
      testId: true,
      hostId: true,
      startedAt: true,
      finishedAt: true,
      test: { select: { title: true } },
    } satisfies Prisma.LiveSessionSelect;
  }

  /** Cizí org → 404 (neprozrazovat existenci), cizí host v téže org → 403. */
  private async getOwnedSession(id: string, ctx: OrgContext) {
    const session = await this.prisma.liveSession.findUnique({
      where: { id },
      select: this.sessionSelect(),
    });
    if (!session || session.organizationId !== ctx.organizationId) {
      throw new NotFoundException({
        code: 'LIVE_SESSION_NOT_FOUND',
        message: 'Bleskovka nebyla nalezena.',
      });
    }
    if (session.hostId !== ctx.membershipId) {
      throw new ForbiddenException({
        code: 'NOT_SESSION_HOST',
        message: 'Bleskovku může ovládat jen učitel, který ji spustil.',
      });
    }
    return session;
  }

  private async getRound(sessionId: string, roundId: string) {
    const round = await this.prisma.liveSessionRound.findFirst({
      where: { id: roundId, sessionId },
    });
    if (!round) {
      throw new NotFoundException({
        code: 'ROUND_NOT_FOUND',
        message: 'Kolo nebylo nalezeno.',
      });
    }
    return round;
  }

  private assertQuizRound(interactionType: RoundInteractionType) {
    if (interactionType !== RoundInteractionType.QUIZ) {
      throw new ConflictException({
        code: 'ROUND_NOT_QUIZ',
        message: 'Hlasování patří jen kvízovým kolům.',
      });
    }
  }

  /** Počet položek k umístění — jmenovatel prahů auto-outcome. */
  private roundItemCount(round: {
    contentSnapshot: Prisma.JsonValue | null;
  }): number {
    const content =
      round.contentSnapshot as unknown as InteractiveBoardContent | null;
    if (!content) return 0;
    if (content.kind === 'MATCH_PAIRS') return content.left.length;
    if (content.kind === 'SORT_BINS') return content.cards.length;
    return content.items.length;
  }

  private async incrementWrong(roundId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE live_session_rounds
      SET attempt_stats = jsonb_set(
        attempt_stats,
        '{wrong}',
        to_jsonb(COALESCE((attempt_stats ->> 'wrong')::int, 0) + 1)
      )
      WHERE live_session_round_id = ${roundId}
        AND completed_at IS NULL
    `;
  }

  /** PLACE typy: dokončí kolo, jakmile jsou usazené všechny položky. */
  private async maybeCompleteInteractive(
    roundId: string,
    itemCount: number,
  ): Promise<boolean> {
    const fresh = await this.prisma.liveSessionRound.findUnique({
      where: { id: roundId },
      select: { attemptStats: true, completedAt: true },
    });
    if (!fresh || fresh.completedAt) return false;
    const stats =
      (fresh.attemptStats as RoundAttemptStats | null) ?? EMPTY_ATTEMPT_STATS;
    if (Object.keys(stats.placed).length < itemCount) return false;
    return this.completeInteractive(roundId, itemCount);
  }

  /**
   * Dokončení interaktivního kola: completedAt (→ XP za odehrání), revealedAt
   * (řešení je od teď veřejné) a auto-outcome z pokusů. updateMany s WHERE
   * completed_at IS NULL — souběžný poslední tah dokončí kolo právě jednou.
   */
  private async completeInteractive(
    roundId: string,
    itemCount: number,
  ): Promise<boolean> {
    const fresh = await this.prisma.liveSessionRound.findUnique({
      where: { id: roundId },
      select: { attemptStats: true },
    });
    const stats =
      (fresh?.attemptStats as RoundAttemptStats | null) ?? EMPTY_ATTEMPT_STATS;
    const now = new Date();
    const res = await this.prisma.liveSessionRound.updateMany({
      where: { id: roundId, completedAt: null },
      data: {
        completedAt: now,
        revealedAt: now,
        outcome: computeAttemptOutcome(stats.wrong, itemCount),
      },
    });
    return res.count > 0;
  }

  private attemptResponse(
    roundId: string,
    round: {
      interactionType: RoundInteractionType;
      attemptStats: Prisma.JsonValue | null;
      completedAt: Date | null;
      outcome: LiveRoundOutcome | null;
      solutionSnapshot: Prisma.JsonValue | null;
    },
    itemCount: number,
    extra: {
      correct?: boolean;
      mask?: boolean[];
      justCompleted?: boolean;
      alreadyCompleted?: boolean;
    },
  ) {
    const stats =
      (round.attemptStats as RoundAttemptStats | null) ?? EMPTY_ATTEMPT_STATS;
    const solved = round.completedAt !== null;
    return {
      roundId,
      interactionType: round.interactionType,
      wrong: stats.wrong,
      checks: stats.checks,
      placed: stats.placed,
      placedCount: Object.keys(stats.placed).length,
      itemCount,
      solved,
      outcome: round.outcome,
      ...(extra.correct !== undefined ? { correct: extra.correct } : {}),
      ...(extra.mask ? { mask: extra.mask } : {}),
      ...(extra.justCompleted !== undefined
        ? { justCompleted: extra.justCompleted }
        : {}),
      ...(extra.alreadyCompleted ? { alreadyCompleted: true } : {}),
      // Řešení je veřejné až od dokončení kola (revealedAt) — board podle
      // něj dokreslí finální stav.
      ...(solved
        ? {
            solution: round.solutionSnapshot as unknown as InteractiveSolution,
          }
        : {}),
    };
  }

  private assertRunning(status: LiveSessionStatus) {
    if (status !== LiveSessionStatus.RUNNING) {
      throw new ConflictException({
        code: 'SESSION_NOT_RUNNING',
        message: 'Bleskovka neběží.',
      });
    }
  }

  private async loadCompatibleQuestions(
    testId: string,
  ): Promise<QuestionWithOptions[]> {
    const questions = await this.prisma.question.findMany({
      where: {
        testId,
        type: {
          in: [
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.TRUE_FALSE,
            ...INTERACTIVE_QUESTION_TYPES,
          ],
        },
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        text: true,
        type: true,
        order: true,
        correctAnswer: true,
        correctAnswers: true,
        content: true,
        options: { select: { id: true, text: true } },
      },
    });
    return questions.filter((q) => buildRoundSnapshot(q) !== null);
  }
}
