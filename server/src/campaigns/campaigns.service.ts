import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignProgressStatus,
  CampaignType,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { CampaignContentService } from './campaign-content.service';
import type {
  CampaignDefinition,
  CampaignStep,
} from './campaign-content.schema';

/** Výsledek advance — vrací se v odpovědi finish pro animaci na projekci. */
export interface CampaignAdvanceResult {
  progressId: string;
  stepIndex: number;
  stepKey: string;
  position: number;
  totalSteps: number;
  status: CampaignProgressStatus;
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: CampaignContentService,
  ) {}

  // ----- Listování a start -----

  /** Kampaně dostupné pro třídu (dle ročníku) + stav rozehrání. */
  async listForClass(classSectionId: string, ctx: OrgContext) {
    const classSection = await this.assertClassAccess(classSectionId, ctx);
    const campaigns = this.content.forGrade(classSection.grade);
    const progresses = await this.prisma.campaignProgress.findMany({
      where: { classSectionId, campaignId: { in: campaigns.map((c) => c.id) } },
      select: {
        id: true,
        campaignId: true,
        status: true,
        position: true,
        totalSteps: true,
      },
    });
    const byCampaign = new Map(progresses.map((p) => [p.campaignId, p]));
    return campaigns.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      subtitle: c.subtitle ?? null,
      intro: c.intro,
      reviewStatus: c.reviewStatus,
      totalSteps: c.steps.length,
      progress: byCampaign.get(c.id) ?? null,
    }));
  }

  /** Všechny rozehrané kampaně třídy (i ty, jejichž obsah už není v registru). */
  async listProgress(classSectionId: string, ctx: OrgContext) {
    await this.assertClassAccess(classSectionId, ctx);
    const progresses = await this.prisma.campaignProgress.findMany({
      where: { classSectionId },
      orderBy: { startedAt: 'asc' },
      include: { _count: { select: { stepUnlocks: true } } },
    });
    return progresses.map((p) => this.progressSummary(p));
  }

  async startCampaign(
    campaignId: string,
    classSectionId: string,
    ctx: OrgContext,
  ) {
    const classSection = await this.assertClassAccess(classSectionId, ctx);
    const campaign = this.content.byId(campaignId);
    if (!campaign) {
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Kampaň nebyla nalezena.',
      });
    }
    const available = this.content
      .forGrade(classSection.grade)
      .some((c) => c.id === campaignId);
    if (!available) {
      throw new BadRequestException({
        code: 'CAMPAIGN_GRADE_MISMATCH',
        message: 'Kampaň není určena pro ročník této třídy.',
      });
    }

    // Snapshot zdroje vzkazu minulé třídy (decisions R6): nejnovější
    // dokončený progress téže kampaně v téže org s neprázdným vzkazem,
    // mimo vlastní třídu. Vzkaz se zobrazí až po explicitním revealu.
    const predecessor = await this.prisma.campaignProgress.findFirst({
      where: {
        organizationId: ctx.organizationId,
        campaignId,
        status: CampaignProgressStatus.COMPLETED,
        epilogueMessage: { not: null },
        classSectionId: { not: classSectionId },
      },
      orderBy: { epilogueSubmittedAt: 'desc' },
      select: { id: true },
    });

    try {
      const progress = await this.prisma.campaignProgress.create({
        data: {
          organizationId: ctx.organizationId,
          classSectionId,
          campaignId,
          campaignType: campaign.type as CampaignType,
          totalSteps: campaign.steps.length,
          predecessorProgressId: predecessor?.id ?? null,
        },
        include: { _count: { select: { stepUnlocks: true } } },
      });
      return this.progressSummary(progress);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CAMPAIGN_ALREADY_STARTED',
          message: 'Třída už má tuto kampaň rozehranou.',
        });
      }
      throw e;
    }
  }

  // ----- Detail pro mapu/nástěnku -----

  /**
   * Detail postupu pro projekci i učitele. Kroky se vracejí jen odemčené
   * (plný obsah) + silueta následujícího (key/title) — budoucí kroky se na
   * projekci nespoilerují. Vzkaz minulé třídy se vrací JEN po revealu.
   */
  async getProgressDetail(progressId: string, ctx: OrgContext) {
    const progress = await this.getOwnedProgress(progressId, ctx);
    const campaign = this.content.byId(progress.campaignId) ?? null;
    const unlocks = await this.prisma.campaignStepUnlock.findMany({
      where: { progressId },
      orderBy: { stepIndex: 'asc' },
    });

    const unlockedSteps = unlocks.map((u) => ({
      stepIndex: u.stepIndex,
      stepKey: u.stepKey,
      roundsPlayed: u.roundsPlayed,
      unlockedAt: u.unlockedAt,
      content: this.stepAt(campaign, u.stepIndex),
    }));
    const nextStep =
      progress.status === CampaignProgressStatus.ACTIVE
        ? this.stepSilhouette(campaign, progress.position + 1)
        : null;

    const predecessorMessage = progress.predecessorMessageRevealedAt
      ? await this.loadPredecessorMessage(progress.predecessorProgressId)
      : null;

    return {
      id: progress.id,
      classSectionId: progress.classSectionId,
      campaignId: progress.campaignId,
      campaignType: progress.campaignType,
      campaign: campaign
        ? {
            title: campaign.title,
            subtitle: campaign.subtitle ?? null,
            intro: campaign.intro,
            reviewStatus: campaign.reviewStatus,
            epiloguePrompt:
              campaign.type === 'MISSION' && campaign.epilogue?.enabled
                ? campaign.epilogue.prompt
                : null,
          }
        : null,
      status: progress.status,
      position: progress.position,
      totalSteps: progress.totalSteps,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      epilogueMessage: progress.epilogueMessage,
      epilogueSubmittedAt: progress.epilogueSubmittedAt,
      unlockedSteps,
      nextStep,
      predecessorMessageAvailable: progress.predecessorProgressId != null,
      predecessorMessageRevealedAt: progress.predecessorMessageRevealedAt,
      predecessorMessage,
    };
  }

  // ----- Epilogue (vzkaz budoucí třídě) + reveal pojistka -----

  async submitEpilogue(progressId: string, message: string, ctx: OrgContext) {
    const progress = await this.getOwnedProgress(progressId, ctx);
    if (progress.campaignType !== CampaignType.MISSION) {
      throw new BadRequestException({
        code: 'EPILOGUE_NOT_SUPPORTED',
        message: 'Vzkaz do archivu podporují jen Mise.',
      });
    }
    if (progress.status !== CampaignProgressStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'CAMPAIGN_NOT_COMPLETED',
        message: 'Vzkaz lze nahrát až po dokončení kampaně.',
      });
    }
    const updated = await this.prisma.campaignProgress.update({
      where: { id: progressId },
      data: { epilogueMessage: message, epilogueSubmittedAt: new Date() },
      select: { id: true, epilogueMessage: true, epilogueSubmittedAt: true },
    });
    return updated;
  }

  /**
   * Teacher-only náhled vzkazu minulé třídy — učitel si ho přečte PRVNÍ
   * a teprve explicitním revealem ho pustí na projekci (decisions R6).
   * Tento endpoint reveal NEPROVÁDÍ.
   */
  async previewPredecessorMessage(progressId: string, ctx: OrgContext) {
    const progress = await this.getOwnedProgress(progressId, ctx);
    const message = await this.loadPredecessorMessage(
      progress.predecessorProgressId,
    );
    if (!message) {
      throw new NotFoundException({
        code: 'NO_PREDECESSOR_MESSAGE',
        message: 'Pro tuto kampaň není k dispozici žádný vzkaz minulé třídy.',
      });
    }
    return {
      ...message,
      revealedAt: progress.predecessorMessageRevealedAt,
    };
  }

  /** Explicitní potvrzení: od teď smí projekce vzkaz zobrazit. Idempotentní. */
  async revealPredecessorMessage(progressId: string, ctx: OrgContext) {
    const progress = await this.getOwnedProgress(progressId, ctx);
    const message = await this.loadPredecessorMessage(
      progress.predecessorProgressId,
    );
    if (!message) {
      throw new NotFoundException({
        code: 'NO_PREDECESSOR_MESSAGE',
        message: 'Pro tuto kampaň není k dispozici žádný vzkaz minulé třídy.',
      });
    }
    if (!progress.predecessorMessageRevealedAt) {
      await this.prisma.campaignProgress.update({
        where: { id: progressId },
        data: { predecessorMessageRevealedAt: new Date() },
      });
    }
    return { progressId, revealed: true };
  }

  // ----- Vazba na LiveSession -----

  /**
   * Validace při zakládání kampaňové bleskovky (volá LiveSessionsService):
   * progress v téže org, ACTIVE, a session musí mířit na tutéž třídu.
   */
  async assertSessionLink(
    campaignProgressId: string,
    classSectionId: string | undefined,
    ctx: OrgContext,
  ) {
    const progress = await this.getOwnedProgress(campaignProgressId, ctx);
    if (!classSectionId || classSectionId !== progress.classSectionId) {
      throw new BadRequestException({
        code: 'CAMPAIGN_CLASS_MISMATCH',
        message: 'Kampaňová bleskovka musí být spuštěna pro třídu kampaně.',
      });
    }
    if (progress.status !== CampaignProgressStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'CAMPAIGN_ALREADY_COMPLETED',
        message: 'Kampaň je už dokončená — nelze na ni navázat bleskovku.',
      });
    }
  }

  /**
   * Advance uvnitř finish transakce bleskovky — atomicky se session XP.
   * Pravidla (decisions R3, R4):
   *  - postup POUZE za dokončenou session s ≥ 1 odehraným kolem,
   *  - outcome/správnost NIKDY nevstupuje,
   *  - FOR UPDATE zámek serializuje souběžné finishe téže třídy,
   *  - sessionId @unique na unlocku = idempotenční kotva.
   */
  async advanceWithinTransaction(
    tx: TxClient,
    args: {
      sessionId: string;
      campaignProgressId: string;
      roundsPlayed: number;
    },
  ): Promise<CampaignAdvanceResult | null> {
    if (args.roundsPlayed < 1) return null;

    await tx.$queryRaw`
      SELECT campaign_progress_id FROM campaign_progresses
      WHERE campaign_progress_id = ${args.campaignProgressId}
      FOR UPDATE`;

    const progress = await tx.campaignProgress.findUnique({
      where: { id: args.campaignProgressId },
    });
    if (
      !progress ||
      progress.status !== CampaignProgressStatus.ACTIVE ||
      progress.position >= progress.totalSteps
    ) {
      return null;
    }

    const alreadyUnlocked = await tx.campaignStepUnlock.findUnique({
      where: { sessionId: args.sessionId },
      select: { id: true },
    });
    if (alreadyUnlocked) return null;

    const nextIndex = progress.position + 1;
    const campaign = this.content.byId(progress.campaignId) ?? null;
    const stepKey =
      this.stepAt(campaign, nextIndex)?.key ?? `krok-${nextIndex}`;
    const completed = nextIndex >= progress.totalSteps;

    await tx.campaignStepUnlock.create({
      data: {
        progressId: progress.id,
        stepIndex: nextIndex,
        stepKey,
        sessionId: args.sessionId,
        roundsPlayed: args.roundsPlayed,
      },
    });
    const updated = await tx.campaignProgress.update({
      where: { id: progress.id },
      data: {
        position: nextIndex,
        ...(completed
          ? {
              status: CampaignProgressStatus.COMPLETED,
              completedAt: new Date(),
            }
          : {}),
      },
      select: { position: true, totalSteps: true, status: true },
    });

    return {
      progressId: progress.id,
      stepIndex: nextIndex,
      stepKey,
      position: updated.position,
      totalSteps: updated.totalSteps,
      status: updated.status,
    };
  }

  // ----- Helpers -----

  private progressSummary(p: {
    id: string;
    campaignId: string;
    campaignType: CampaignType;
    classSectionId: string;
    status: CampaignProgressStatus;
    position: number;
    totalSteps: number;
    startedAt: Date;
    completedAt: Date | null;
    predecessorProgressId: string | null;
    _count: { stepUnlocks: number };
  }) {
    const campaign = this.content.byId(p.campaignId);
    return {
      id: p.id,
      classSectionId: p.classSectionId,
      campaignId: p.campaignId,
      campaignType: p.campaignType,
      title: campaign?.title ?? p.campaignId,
      status: p.status,
      position: p.position,
      totalSteps: p.totalSteps,
      unlockedCount: p._count.stepUnlocks,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      predecessorMessageAvailable: p.predecessorProgressId != null,
      contentMissing: campaign == null,
    };
  }

  private stepAt(
    campaign: CampaignDefinition | null,
    stepIndex: number,
  ): CampaignStep | null {
    if (!campaign) return null;
    return campaign.steps[stepIndex - 1] ?? null;
  }

  /** Silueta dalšího kroku — jen key/title, žádný spoiler scény/samolepky. */
  private stepSilhouette(
    campaign: CampaignDefinition | null,
    stepIndex: number,
  ) {
    const step = this.stepAt(campaign, stepIndex);
    if (!step) return null;
    return { stepIndex, key: step.key, title: step.title };
  }

  private async loadPredecessorMessage(predecessorProgressId: string | null) {
    if (!predecessorProgressId) return null;
    const source = await this.prisma.campaignProgress.findUnique({
      where: { id: predecessorProgressId },
      select: {
        epilogueMessage: true,
        epilogueSubmittedAt: true,
        classSection: {
          select: { label: true, grade: true, section: true },
        },
      },
    });
    if (!source?.epilogueMessage) return null;
    return {
      message: source.epilogueMessage,
      submittedAt: source.epilogueSubmittedAt,
      sourceClassLabel:
        source.classSection.label ??
        `${source.classSection.grade}/${source.classSection.section}`,
    };
  }

  /** Cizí org → 404 (neprozrazovat existenci). */
  private async getOwnedProgress(progressId: string, ctx: OrgContext) {
    const progress = await this.prisma.campaignProgress.findUnique({
      where: { id: progressId },
    });
    if (!progress || progress.organizationId !== ctx.organizationId) {
      throw new NotFoundException({
        code: 'CAMPAIGN_PROGRESS_NOT_FOUND',
        message: 'Postup kampaně nebyl nalezen.',
      });
    }
    await this.assertClassAccess(progress.classSectionId, ctx);
    return progress;
  }

  /**
   * RBAC: třída musí patřit do org (jinak 404). Role TEACHER navíc musí
   * třídu učit (homeroom nebo platný TeacherClassSection úvazek), jinak 403.
   * DIRECTOR/OWNER mají přístup k celé org.
   */
  private async assertClassAccess(classSectionId: string, ctx: OrgContext) {
    const classSection = await this.prisma.classSection.findFirst({
      where: { id: classSectionId, orgId: ctx.organizationId },
      select: { id: true, grade: true, teacherId: true },
    });
    if (!classSection) {
      throw new NotFoundException({
        code: 'CLASS_SECTION_NOT_FOUND',
        message: 'Třída nebyla nalezena.',
      });
    }
    if (
      ctx.role === OrganizationRole.DIRECTOR ||
      ctx.role === OrganizationRole.OWNER
    ) {
      return classSection;
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        membershipId: ctx.membershipId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (teacher) {
      if (classSection.teacherId === teacher.id) return classSection;
      const now = new Date();
      const assignment = await this.prisma.teacherClassSection.findFirst({
        where: {
          teacherId: teacher.id,
          classSectionId,
          deletedAt: null,
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validTo: null }, { validTo: { gte: now } }] },
          ],
        },
        select: { id: true },
      });
      if (assignment) return classSection;
    }
    throw new ForbiddenException({
      code: 'NOT_CLASS_TEACHER',
      message: 'Kampaně třídy může spravovat jen její učitel.',
    });
  }
}
