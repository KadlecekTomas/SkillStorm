import { PreconditionFailedException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import { deriveOrgReadiness } from '@/shared/org-readiness-v2';

/**
 * Organization readiness is DERIVED, not commanded. NOT_READY is a valid, expected state.
 * READY ⇔ current academic year (isCurrent=true) AND at least one class in that year.
 * Never stored as a mutable flag; recomputed from DB on each /auth/me.
 */

export const ORG_NOT_READY = 'ORG_NOT_READY';
export const ORG_SUSPENDED = 'ORG_SUSPENDED';
export const ORG_PENDING = 'ORG_PENDING';

export type OrgReadiness = 'READY' | 'NOT_READY';

export type OrgBootstrap = {
  hasAcademicYear: boolean;
  /** At least one ClassSection exists in the org (any academic year). */
  hasClassrooms: boolean;
  /** At least one ClassSection in the current academic year. Readiness uses this. */
  hasClassroomsInCurrentYear: boolean;
  /** @deprecated Use hasClassroomsInCurrentYear. Same value, kept for one release. */
  hasClassroomsInActiveYear?: boolean;
};

/**
 * Compute organization bootstrap (for /auth/me). Uses current year (isCurrent=true).
 */
export async function getOrgBootstrap(
  prisma: PrismaService,
  orgId: string | null,
): Promise<OrgBootstrap> {
  if (!orgId) {
    return {
      hasAcademicYear: false,
      hasClassrooms: false,
      hasClassroomsInCurrentYear: false,
      hasClassroomsInActiveYear: false,
    };
  }
  const currentYear = await prisma.academicYear.findFirst({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });
  const anyClassCount = await prisma.classSection.count({
    where: { academicYear: { orgId } },
  });
  if (!currentYear) {
    return {
      hasAcademicYear: false,
      hasClassrooms: anyClassCount > 0,
      hasClassroomsInCurrentYear: false,
      hasClassroomsInActiveYear: false,
    };
  }
  const classCountInCurrentYear = await prisma.classSection.count({
    where: { yearId: currentYear.id },
  });
  return {
    hasAcademicYear: true,
    hasClassrooms: anyClassCount > 0,
    hasClassroomsInCurrentYear: classCountInCurrentYear > 0,
    hasClassroomsInActiveYear: classCountInCurrentYear > 0, // deprecated alias
  };
}

/**
 * Compute organization readiness (for /auth/me). READY when canExecute from v2 (state >= R2).
 * Delegates to deriveOrgReadiness for single source of truth.
 */
export async function getOrgReadiness(
  prisma: PrismaService,
  orgId: string | null,
): Promise<OrgReadiness> {
  const derived = await deriveOrgReadiness(prisma, orgId);
  return derived.canExecute ? 'READY' : 'NOT_READY';
}

/**
 * Readiness: current AcademicYear (isCurrent=true) + at least one ClassSection in that year.
 */
export async function assertOrgReady(
  prisma: PrismaService,
  orgId: string | null,
): Promise<void> {
  if (!orgId) {
    throw new PreconditionFailedException({
      statusCode: 412,
      code: ORG_NOT_READY,
      message: 'Organization context required',
    });
  }

  const currentYear = await prisma.academicYear.findFirst({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });
  if (!currentYear) {
    throw new PreconditionFailedException({
      statusCode: 412,
      code: ORG_NOT_READY,
      message: 'Organization has no current academic year',
    });
  }

  const classCount = await prisma.classSection.count({
    where: { yearId: currentYear.id },
  });
  if (classCount === 0) {
    throw new PreconditionFailedException({
      statusCode: 412,
      code: ORG_NOT_READY,
      message: 'Organization has no class section in current year',
    });
  }
}
