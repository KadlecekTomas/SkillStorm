/**
 * Single source for E2E org readiness: current academic year + at least one class section.
 * Use this before any test that hits endpoints guarded by ApplicationReadinessGuard
 * or RequireCurrentAcademicYearGuard / RequireOrgReadyGuard.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import type { PrismaService } from '@/prisma/prisma.service';
import { OrganizationType } from '@prisma/client';
import { $Enums } from '@prisma/client';

export type BootstrapOrgResult = {
  orgId: string;
  academicYearId: string;
  academicYearLabel: string;
  classSectionId: string;
};

const DEFAULT_START = new Date('2024-09-01');
const DEFAULT_END = new Date('2025-08-31');

/**
 * Ensures an org has exactly one current academic year and at least one class section.
 * If orgId is provided and the org already has a current year and a class, returns those ids.
 * Otherwise creates: org (if not provided), academic year (isCurrent: true), one ClassSection.
 */
export async function bootstrapOrg(
  prisma: PrismaService,
  options: {
    orgId?: string;
    orgName?: string;
    startDate?: Date;
    endDate?: Date;
    label?: string;
    grade?: $Enums.SchoolGrade;
    section?: string;
    classLabel?: string;
  } = {},
): Promise<BootstrapOrgResult> {
  const startDate = options.startDate ?? DEFAULT_START;
  const endDate = options.endDate ?? DEFAULT_END;
  const label = options.label ?? `AY_${startDate.getFullYear()}/${endDate.getFullYear()}`;
  const grade = options.grade ?? $Enums.SchoolGrade.GRADE_5;
  const section = options.section ?? 'A';
  const classLabel = options.classLabel ?? '5.A';

  let orgId = options.orgId;
  if (!orgId) {
    const org = await prisma.organization.create({
      data: {
        name: options.orgName ?? `E2E Org ${Date.now()}`,
        type: OrganizationType.SCHOOL,
      },
      select: { id: true },
    });
    orgId = org.id;
  }

  const existingActive = await prisma.academicYear.findFirst({
    where: { orgId, isCurrent: true },
    select: { id: true },
  });

  let academicYearId: string;
  let academicYearLabel = label;
  if (existingActive) {
    academicYearId = existingActive.id;
    const row = await prisma.academicYear.findUnique({
      where: { id: existingActive.id },
      select: { label: true },
    });
    if (row) academicYearLabel = row.label;
  } else {
    await prisma.academicYear.updateMany({
      where: { orgId, isCurrent: true },
      data: { isCurrent: false },
    });
    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label,
        startsAt: startDate,
        endsAt: endDate,
        isCurrent: true,
      },
      select: { id: true, label: true },
    });
    academicYearId = year.id;
    academicYearLabel = year.label;
  }

  const existingClass = await prisma.classSection.findFirst({
    where: { yearId: academicYearId },
    select: { id: true },
  });

  let classSectionId: string;
  if (existingClass) {
    classSectionId = existingClass.id;
  } else {
    const cls = await prisma.classSection.create({
      data: {
        orgId,
        yearId: academicYearId,
        grade,
        section,
        label: classLabel,
      },
      select: { id: true },
    });
    classSectionId = cls.id;
  }

  return { orgId, academicYearId, academicYearLabel, classSectionId };
}

/**
 * Calls GET /auth/me with the given token and asserts organization readiness === "READY".
 * Throws with an explicit message if not READY (missing active year or class section).
 */
export async function assertOrgReady(
  app: INestApplication,
  accessToken: string,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .get('/auth/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const body = res.body?.data ?? res.body;
  const readiness = body?.organization?.readiness ?? body?.org?.readiness;
  const bootstrap = body?.organization?.bootstrap ?? body?.org?.bootstrap;

  if (readiness !== 'READY') {
    const missing: string[] = [];
    if (!bootstrap?.hasAcademicYear) missing.push('current academic year');
    if (!(bootstrap?.hasClassroomsInCurrentYear ?? bootstrap?.hasClassroomsInActiveYear)) missing.push('at least one class section in current year');
    if (missing.length === 0) missing.push('readiness not READY');
    throw new Error(
      `E2E invariant: organization must be READY before calling student/classroom endpoints. ` +
        `Missing: ${missing.join(', ')}. ` +
        `Call bootstrapOrg() and use the token scoped to that org (e.g. POST /auth/use-org or login with organizationId). ` +
        `me payload: ${JSON.stringify(body)}`,
    );
  }
}

/**
 * Asserts that the given token is scoped to expectedOrgId (via GET /auth/me).
 * Throws with explicit message including the returned me payload if not.
 */
export async function assertTokenOrg(
  app: INestApplication,
  accessToken: string,
  expectedOrgId: string,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .get('/auth/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const body = res.body?.data ?? res.body;
  const orgId = body?.organization?.id ?? body?.org?.id;
  if (orgId !== expectedOrgId) {
    throw new Error(
      `E2E assertTokenOrg: expected organization.id === ${expectedOrgId}, got ${orgId}. ` +
        `me payload: ${JSON.stringify(body)}`,
    );
  }
}
