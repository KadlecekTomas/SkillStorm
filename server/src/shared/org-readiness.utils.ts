import { PreconditionFailedException } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';

export const ORG_NOT_READY = 'ORG_NOT_READY';
export const ORG_SUSPENDED = 'ORG_SUSPENDED';
export const ORG_PENDING = 'ORG_PENDING';

/**
 * Readiness: active AcademicYear + at least one ClassSection in that year.
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

  const activeYear = await prisma.academicYear.findFirst({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });
  if (!activeYear) {
    throw new PreconditionFailedException({
      statusCode: 412,
      code: ORG_NOT_READY,
      message: 'Organization has no active academic year',
    });
  }

  const classCount = await prisma.classSection.count({
    where: { yearId: activeYear.id },
  });
  if (classCount === 0) {
    throw new PreconditionFailedException({
      statusCode: 412,
      code: ORG_NOT_READY,
      message: 'Organization has no class section in active year',
    });
  }
}
