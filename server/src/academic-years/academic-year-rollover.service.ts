import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '@/prisma/prisma.service';
import { AcademicYearCacheRef } from '@/common/year-cache/academic-year-cache.ref';
import { deriveCzechSchoolYearFromStartYear } from '@/shared/czech-school-year';

/** Days before a year ends that we proactively create the NEXT year. */
const PREPARATION_WINDOW_DAYS = 60;
const PREPARATION_WINDOW_MS = PREPARATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

type CurrentYear = {
  id: string;
  orgId: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
};

/**
 * Academic year background service — two distinct responsibilities:
 *
 * 1. PROACTIVE PREPARATION (primary, runs every hour):
 *    When a current year is within 60 days of expiry and has no successor,
 *    creates the next year with isCurrent=false so directors can review
 *    and activate it at their chosen time.
 *    Log: ACADEMIC_YEAR_NEXT_PREPARED
 *
 * 2. REACTIVE SAFETY-NET (secondary, runs every hour after preparation):
 *    If a year has already expired AND the director has not activated the
 *    pre-created next year, automatically activates it (or creates+activates
 *    if preparation also failed). This ensures teachers are never blocked
 *    for more than one cron cycle (~1 hour) in the worst case.
 *    Log: ACADEMIC_YEAR_AUTO_ROLLOVER
 *
 * Director control is preserved:
 * - Directors see "Další školní rok X/Y je připraven" 60 days ahead.
 * - They activate when ready via PATCH /academic-years/:id/activate.
 * - If they act before expiry, the safety-net never triggers.
 * - If they pre-create a year manually, preparation deduplicates via upsert.
 */
@Injectable()
export class AcademicYearRolloverService {
  private readonly logger = new Logger(AcademicYearRolloverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yearCache: AcademicYearCacheRef,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API (also called directly from tests)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Proactive preparation: ensures each org whose current year expires within
   * PREPARATION_WINDOW_DAYS has a successor year created (isCurrent=false).
   *
   * Never auto-activates — directors control when the switch happens.
   * Idempotent: safe to call multiple times; uses the @@unique(orgId, label)
   * constraint to prevent duplicates from concurrent instances.
   */
  async runPreparation(): Promise<void> {
    const cutoff = new Date(Date.now() + PREPARATION_WINDOW_MS);

    // All current years expiring within 60 days.
    // @@index([orgId, isCurrent]) makes this scan O(N_orgs).
    const approaching = await this.prisma.academicYear.findMany({
      where: {
        isCurrent: true,
        deletedAt: null,
        endsAt: { lte: cutoff },
      },
      select: { id: true, orgId: true, label: true, startsAt: true, endsAt: true },
    });

    if (approaching.length === 0) return;

    for (const current of approaching) {
      try {
        await this.prepareNextYear(current);
      } catch (err) {
        this.logger.error(
          JSON.stringify({
            action: 'ACADEMIC_YEAR_PREPARATION_ERROR',
            orgId: current.orgId,
            currentYearId: current.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  /**
   * Reactive safety-net: activates the successor year for any org whose
   * current year has ALREADY expired. This is the last resort for orgs
   * where the director did not activate the prepared year in time.
   *
   * If no successor exists at all (preparation also failed), creates and
   * activates one within the same transaction.
   */
  async runRollover(): Promise<void> {
    const now = new Date();

    const expiredCurrentYears = await this.prisma.academicYear.findMany({
      where: {
        isCurrent: true,
        endsAt: { lt: now },
        deletedAt: null,
      },
      select: { id: true, orgId: true, label: true, startsAt: true, endsAt: true },
    });

    if (expiredCurrentYears.length === 0) return;

    this.logger.log(
      JSON.stringify({
        action: 'ACADEMIC_YEAR_ROLLOVER_RUN_START',
        candidateCount: expiredCurrentYears.length,
        timestamp: now.toISOString(),
      }),
    );

    for (const expired of expiredCurrentYears) {
      try {
        await this.activateOrCreateNext(expired);
      } catch (err) {
        this.logger.error(
          JSON.stringify({
            action: 'ACADEMIC_YEAR_ROLLOVER_ERROR',
            orgId: expired.orgId,
            expiredYearId: expired.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Creates the next CZ school year for the org with isCurrent=false.
   * Uses upsert on @@unique(orgId, label) so concurrent cron instances
   * are idempotent and director pre-creation is not overwritten.
   */
  private async prepareNextYear(current: CurrentYear): Promise<void> {
    const nextStartYear = current.startsAt.getUTCFullYear() + 1;
    const { startDate, endDate, label } =
      deriveCzechSchoolYearFromStartYear(nextStartYear);

    // Check if a future year already exists (any year, not just next).
    // If director already set up their own next year, don't create another.
    const existingNext = await this.prisma.academicYear.findFirst({
      where: {
        orgId: current.orgId,
        startsAt: { gt: current.startsAt },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingNext) return;

    try {
      // isCurrent=false — directors activate when ready.
      const prepared = await this.prisma.academicYear.create({
        data: {
          orgId: current.orgId,
          label,
          startsAt: startDate,
          endsAt: endDate,
          isCurrent: false,
        },
        select: { id: true },
      });

      this.yearCache.invalidate(current.orgId);

      this.logger.log(
        JSON.stringify({
          action: 'ACADEMIC_YEAR_NEXT_PREPARED',
          organizationId: current.orgId,
          currentYearId: current.id,
          currentYearLabel: current.label,
          nextYearId: prepared.id,
          nextYearLabel: label,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (err) {
      // P2002 = unique constraint violation — a concurrent cron instance or
      // a director already created this exact year. Treat as success.
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  }

  /**
   * Safety-net: activates the next year (or creates+activates if none exists)
   * for an org whose current year has already expired.
   * All mutations happen inside a single transaction with a re-check to guard
   * against concurrent execution across multiple backend instances.
   */
  private async activateOrCreateNext(expired: CurrentYear): Promise<void> {
    const { orgId } = expired;
    const nextStartYear = expired.startsAt.getUTCFullYear() + 1;
    const { startDate: nextStartsAt, endDate: nextEndsAt, label: nextLabel } =
      deriveCzechSchoolYearFromStartYear(nextStartYear);

    type Outcome = {
      newYearId: string;
      newYearLabel: string;
      wasPreExisting: boolean;
    } | null;

    const outcome: Outcome = await this.prisma.$transaction(async (tx) => {
      // Re-check: guard against concurrent rollover or director activation
      // that happened between the outer query and this transaction.
      const recheck = await tx.academicYear.findUnique({
        where: { id: expired.id },
        select: { isCurrent: true, endsAt: true },
      });
      if (!recheck?.isCurrent || recheck.endsAt >= new Date()) {
        return null; // Already handled.
      }

      // Find the immediate next year (director may have pre-created it).
      const existing = await tx.academicYear.findFirst({
        where: {
          orgId,
          startsAt: nextStartsAt,
          deletedAt: null,
        },
        select: { id: true, isCurrent: true, label: true },
      });

      // Deactivate the expired year.
      await tx.academicYear.updateMany({
        where: { orgId, isCurrent: true },
        data: { isCurrent: false },
      });

      if (existing) {
        // Director pre-created it — just activate.
        await tx.academicYear.update({
          where: { id: existing.id },
          data: { isCurrent: true },
        });
        return { newYearId: existing.id, newYearLabel: existing.label, wasPreExisting: true };
      }

      // Neither director nor prep created a next year — create and activate.
      const created = await tx.academicYear.create({
        data: {
          orgId,
          label: nextLabel,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          isCurrent: true,
        },
        select: { id: true },
      });

      return { newYearId: created.id, newYearLabel: nextLabel, wasPreExisting: false };
    });

    if (!outcome) return;

    this.yearCache.invalidate(orgId);

    this.logger.log(
      JSON.stringify({
        action: 'ACADEMIC_YEAR_AUTO_ROLLOVER',
        organizationId: orgId,
        previousYearId: expired.id,
        previousYearLabel: expired.label,
        newYearId: outcome.newYearId,
        newYearLabel: outcome.newYearLabel,
        wasPreExisting: outcome.wasPreExisting,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CRON ENTRY POINT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Runs every hour. Preparation first (proactive), then rollover (safety-net).
   * Separated into two public methods so tests can call each independently.
   */
  @Cron('0 * * * *')
  async scheduledJob(): Promise<void> {
    await this.runPreparation();
    await this.runRollover();
  }
}
