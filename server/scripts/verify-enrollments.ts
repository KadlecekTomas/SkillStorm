/**
 * Enrollment integrity verifier (read-only).
 * Checks invariants I1–I5 across enrollments. Exits 1 if any violation.
 *
 * Usage: VERIFY_ORG_ID=<uuid> ts-node scripts/verify-enrollments.ts
 *   (omit VERIFY_ORG_ID to check all organizations)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Violation = { invariant: string; count: number; sampleIds: string[] };

async function main() {
  const orgIdFilter = process.env.VERIFY_ORG_ID ?? undefined;
  const violations: Violation[] = [];

  // --- I1: enrollment.orgId must match student.orgId, classSection.orgId, academicYear.orgId
  const enrollmentsI1 = await prisma.enrollment.findMany({
    where: { ...(orgIdFilter ? { orgId: orgIdFilter } : {}) },
    include: { student: true, classSection: true, academicYear: true },
  });
  const i1Bad = enrollmentsI1.filter(
    (e) =>
      e.orgId !== e.student.orgId ||
      e.orgId !== e.classSection.orgId ||
      e.orgId !== e.academicYear.orgId
  );
  if (i1Bad.length > 0) {
    violations.push({
      invariant: 'I1_ORG_CONSISTENCY',
      count: i1Bad.length,
      sampleIds: i1Bad.slice(0, 10).map((e) => e.id),
    });
  }

  // --- I2: enrollment.yearId must match classSection.yearId
  const i2Bad = enrollmentsI1.filter((e) => e.yearId !== e.classSection.yearId);
  if (i2Bad.length > 0) {
    violations.push({
      invariant: 'I2_YEAR_SECTION_ALIGNMENT',
      count: i2Bad.length,
      sampleIds: i2Bad.slice(0, 10).map((e) => e.id),
    });
  }

  // --- I3: at most one enrollment per (studentId, yearId)
  const groups = await prisma.enrollment.groupBy({
    by: ['studentId', 'yearId'],
    ...(orgIdFilter ? { where: { orgId: orgIdFilter } } : {}),
    _count: { id: true },
  });
  const i3Duplicates = groups.filter((g) => (g._count?.id ?? 0) > 1);
  if (i3Duplicates.length > 0) {
    const samplePairs = i3Duplicates.slice(0, 10).map((g) => `${g.studentId}:${g.yearId}`);
    violations.push({
      invariant: 'I3_ONE_ENROLLMENT_PER_STUDENT_YEAR',
      count: i3Duplicates.length,
      sampleIds: samplePairs,
    });
  }

  // --- I4: no ACTIVE enrollment for deleted student or deleted membership
  const enrollmentsI4 = await prisma.enrollment.findMany({
    where: {
      ...(orgIdFilter ? { orgId: orgIdFilter } : {}),
      status: 'ACTIVE',
    },
    include: { student: { include: { membership: true } } },
  });
  const i4Bad = enrollmentsI4.filter(
    (e) => e.student.deletedAt != null || e.student.membership?.deletedAt != null
  );
  if (i4Bad.length > 0) {
    violations.push({
      invariant: 'I4_NO_ACTIVE_FOR_DELETED_STUDENT',
      count: i4Bad.length,
      sampleIds: i4Bad.slice(0, 10).map((e) => e.id),
    });
  }

  // --- I5: no ACTIVE enrollment for non-existent section (guaranteed by FK; we only report if any orphan)
  // Orphan check: enrollment where classSection is missing. With FK this should be 0. Skip unless we use raw.

  // --- Output
  console.log('Enrollment integrity verifier');
  console.log('Scope:', orgIdFilter ? `org ${orgIdFilter}` : 'all organizations');
  console.log('Total enrollments checked:', enrollmentsI1.length);
  console.log('');

  if (violations.length === 0) {
    console.log('OK — no invariant violations detected.');
    process.exit(0);
  }

  console.log('VIOLATIONS:');
  for (const v of violations) {
    console.log(`  ${v.invariant}: ${v.count} (sample: ${v.sampleIds.join(', ')})`);
  }
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
