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
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { OrgContext } from '@/common/org-context/org-context.types';
import {
  CampaignsService,
  CampaignAdvanceResult,
} from '@/campaigns/campaigns.service';
import { CreateLiveSessionDto } from './dto/create-live-session.dto';
import {
  OPTION_KEYS,
  OptionKey,
  RoundOptionSnapshot,
  XP_PER_FINISHED_SESSION,
  XP_PER_PLAYED_ROUND,
  computeStage,
  resolveDefaultLiveAgeMode,
} from './live-sessions.constants';

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
  options: { id: string; text: string }[];
};

/** Kolo pro projekci — correctKey jen u už odhalených kol (refresh mid-session). */
export interface ProjectionRound {
  id: string;
  order: number;
  questionText: string;
  options: RoundOptionSnapshot[];
  outcome: LiveRoundOutcome | null;
  revealedAt: Date | null;
  completedAt: Date | null;
  correctKey?: string;
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
 * Otázka je použitelná v bleskovce, pokud ji lze zobrazit jako single-choice
 * A/B/C/D: TRUE_FALSE vždy, MULTIPLE_CHOICE jen single-mode (correctAnswer,
 * ne correctAnswers[]) s 2–4 možnostmi, z nichž právě jedna je správná.
 */
function buildRoundSnapshot(
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
          snap: NonNullable<ReturnType<typeof buildRoundSnapshot>>;
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
        data: snapshots.map(({ q, snap }, i) => ({
          sessionId: id,
          order: i + 1,
          questionId: q.id,
          questionText: q.text,
          optionsSnapshot: snap.options as unknown as Prisma.InputJsonValue,
          correctKeySnapshot: snap.correctKey,
        })),
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
          options: r.optionsSnapshot as unknown as RoundOptionSnapshot[],
          outcome: r.outcome,
          revealedAt: r.revealedAt,
          completedAt: r.completedAt,
        };
        if (r.revealedAt) base.correctKey = r.correctKeySnapshot;
        return base;
      }),
    };
  }

  /** Odhalí správnou odpověď — až teď correctKey opouští server. Idempotentní. */
  async reveal(id: string, roundId: string, ctx: OrgContext) {
    const session = await this.getOwnedSession(id, ctx);
    this.assertRunning(session.status);
    const round = await this.getRound(id, roundId);

    if (!round.revealedAt) {
      await this.prisma.liveSessionRound.update({
        where: { id: roundId },
        data: { revealedAt: new Date() },
      });
    }
    return { roundId, correctKey: round.correctKeySnapshot };
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
        type: { in: [QuestionType.MULTIPLE_CHOICE, QuestionType.TRUE_FALSE] },
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        text: true,
        type: true,
        order: true,
        correctAnswer: true,
        correctAnswers: true,
        options: { select: { id: true, text: true } },
      },
    });
    return questions.filter((q) => buildRoundSnapshot(q) !== null);
  }
}
