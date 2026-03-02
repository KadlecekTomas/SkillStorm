/**
 * Unit tests for PlatformHealthService.
 *
 * Focus areas:
 *   1. toNumber() — converts BigInt / null / string / number safely.
 *   2. computePlatformOverview() with empty DB — never throws, returns zeros.
 *   3. computePlatformOverview() with BigInt counts from $queryRaw — returns
 *      finite score in [0, 100] with no NaN or serialisation errors.
 */
import { PlatformHealthService, toNumber } from './platform-health.service';
import type { PrismaService } from '@/prisma/prisma.service';

// ---------------------------------------------------------------------------
// toNumber helper
// ---------------------------------------------------------------------------

describe('toNumber()', () => {
  it('converts BigInt to number', () => {
    expect(toNumber(BigInt(42))).toBe(42);
    expect(toNumber(BigInt(0))).toBe(0);
  });

  it('returns 0 for null and undefined', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it('passes through finite numbers', () => {
    expect(toNumber(7)).toBe(7);
    expect(toNumber(0)).toBe(0);
  });

  it('returns 0 for non-finite numbers', () => {
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(-Infinity)).toBe(0);
  });

  it('parses numeric strings', () => {
    expect(toNumber('5')).toBe(5);
    expect(toNumber('0')).toBe(0);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber('')).toBe(0);
  });

  it('returns 0 for objects', () => {
    expect(toNumber({})).toBe(0);
    expect(toNumber([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers to build minimal Prisma mocks
// ---------------------------------------------------------------------------

const ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

/** Creates a PrismaService mock. All unspecified methods throw by default. */
function makePrismaMock(overrides: {
  orgCount?: number;
  activeOrgs?: { id: string; name: string }[];
  membershipGroupBy?: { organizationId: string; role: string; _count: { id: number } }[];
  queryRawReturns?: unknown[][];
}): PrismaService {
  const {
    orgCount = 0,
    activeOrgs = [],
    membershipGroupBy = [],
    queryRawReturns = [],
  } = overrides;

  let queryRawCallIndex = 0;

  const mockQueryRaw = jest.fn().mockImplementation(() => {
    const value = queryRawReturns[queryRawCallIndex] ?? [];
    queryRawCallIndex++;
    return Promise.resolve(value);
  });

  return {
    organization: {
      count: jest.fn().mockResolvedValue(orgCount),
      findMany: jest.fn().mockResolvedValue(activeOrgs),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    membership: {
      groupBy: jest.fn().mockResolvedValue(membershipGroupBy),
    },
    $queryRaw: mockQueryRaw,
  } as unknown as PrismaService;
}

// ---------------------------------------------------------------------------
// Test 1: Empty database
// ---------------------------------------------------------------------------

describe('computePlatformOverview() — empty database', () => {
  it('returns zero-filled overview without throwing when there are no active orgs', async () => {
    const prisma = makePrismaMock({ orgCount: 0, activeOrgs: [], membershipGroupBy: [] });
    const service = new PlatformHealthService(prisma);

    const result = await service.computePlatformOverview();

    expect(result).toBeDefined();
    expect(result.totalOrganizations).toBe(0);
    expect(result.activeOrganizationsLast30Days).toBe(0);
    expect(result.averageHealthScore).toBe(0);
    expect(result.lowHealthOrganizations).toEqual([]);
    expect(result.topOrganizations).toEqual([]);
  });

  it('returns zero-filled overview even when org count is non-zero but none are ACTIVE', async () => {
    // totalOrgs is 3 (total DB count) but no ACTIVE orgs
    const prisma = makePrismaMock({ orgCount: 3, activeOrgs: [], membershipGroupBy: [] });
    const service = new PlatformHealthService(prisma);

    const result = await service.computePlatformOverview();

    expect(result.totalOrganizations).toBe(3);
    expect(result.topOrganizations).toHaveLength(0);
    expect(result.lowHealthOrganizations).toHaveLength(0);
    expect(Number.isFinite(result.averageHealthScore)).toBe(true);
  });

  it('does not call $queryRaw when there are no active orgs', async () => {
    const prisma = makePrismaMock({ orgCount: 0, activeOrgs: [] });
    const service = new PlatformHealthService(prisma);

    await service.computePlatformOverview();

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 2: BigInt counts from $queryRaw
// ---------------------------------------------------------------------------

describe('computePlatformOverview() — BigInt counts', () => {
  /**
   * Builds the 14 $queryRaw return values consumed by fetchWindowMetrics
   * (called twice: wA and wB). Both windows get the same counts.
   *
   * Order within each window (matches Promise.all in fetchWindowMetrics):
   *   0: creators, 1: graders, 2: submitters, 3: testsCreated,
   *   4: totalSubs, 5: approvedSubs, 6: invites
   */
  function makeWindowReturns(orgId: string, counts: {
    creators?: bigint;
    graders?: bigint;
    submitters?: bigint;
    tests?: bigint;
    totalSubs?: bigint;
    approvedSubs?: bigint;
    inviteUsed?: bigint;
    inviteMax?: bigint;
  }) {
    const c = {
      creators: counts.creators ?? BigInt(0),
      graders: counts.graders ?? BigInt(0),
      submitters: counts.submitters ?? BigInt(0),
      tests: counts.tests ?? BigInt(0),
      totalSubs: counts.totalSubs ?? BigInt(0),
      approvedSubs: counts.approvedSubs ?? BigInt(0),
      inviteUsed: counts.inviteUsed ?? BigInt(0),
      inviteMax: counts.inviteMax ?? BigInt(0),
    };
    return [
      [{ organization_id: orgId, count: c.creators }],
      [{ organization_id: orgId, count: c.graders }],
      [{ organization_id: orgId, count: c.submitters }],
      [{ organization_id: orgId, count: c.tests }],
      [{ organization_id: orgId, count: c.totalSubs }],
      [{ organization_id: orgId, count: c.approvedSubs }],
      [{ organization_id: orgId, used: c.inviteUsed, max_uses: c.inviteMax, cnt: BigInt(1) }],
    ];
  }

  it('produces a finite score in [0, 100] when $queryRaw returns BigInt counts', async () => {
    const windowReturns = makeWindowReturns(ORG_ID, {
      creators: BigInt(3),
      graders: BigInt(2),
      submitters: BigInt(10),
      tests: BigInt(5),
      totalSubs: BigInt(20),
      approvedSubs: BigInt(15),
      inviteUsed: BigInt(3),
      inviteMax: BigInt(10),
    });

    const prisma = makePrismaMock({
      orgCount: 1,
      activeOrgs: [{ id: ORG_ID, name: 'Test School' }],
      membershipGroupBy: [
        { organizationId: ORG_ID, role: 'TEACHER', _count: { id: 3 } },
        { organizationId: ORG_ID, role: 'STUDENT', _count: { id: 30 } },
      ],
      // wA (7 calls) + wB (7 calls) — order matches Promise.all inside fetchWindowMetrics
      queryRawReturns: [...windowReturns, ...windowReturns],
    });

    const service = new PlatformHealthService(prisma);
    const result = await service.computePlatformOverview();

    expect(result.totalOrganizations).toBe(1);
    expect(result.topOrganizations).toHaveLength(1);

    const org = result.topOrganizations[0]!;
    expect(Number.isFinite(org.score)).toBe(true);
    expect(org.score).toBeGreaterThanOrEqual(0);
    expect(org.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(org.deltaScore)).toBe(true);
    expect(['UP', 'DOWN', 'FLAT']).toContain(org.trendLabel);
  });

  it('handles all-zero BigInt counts without producing NaN or throwing', async () => {
    // All counts are BigInt(0) — edge case: org exists but has zero activity
    const windowReturns = makeWindowReturns(ORG_ID, {});

    const prisma = makePrismaMock({
      orgCount: 1,
      activeOrgs: [{ id: ORG_ID, name: 'Inactive School' }],
      membershipGroupBy: [],
      queryRawReturns: [...windowReturns, ...windowReturns],
    });

    const service = new PlatformHealthService(prisma);
    const result = await service.computePlatformOverview();

    const org = result.topOrganizations[0]!;
    expect(org).toBeDefined();
    expect(Number.isFinite(org.score)).toBe(true);
    expect(Number.isNaN(org.score)).toBe(false);
    // Zero-activity org gets a non-zero score from the smoothed completion baseline
    expect(org.score).toBeGreaterThanOrEqual(0);
    expect(org.score).toBeLessThanOrEqual(100);
  });

  it('result is JSON-serialisable (no BigInt in output)', async () => {
    const windowReturns = makeWindowReturns(ORG_ID, { creators: BigInt(2), tests: BigInt(3) });

    const prisma = makePrismaMock({
      orgCount: 1,
      activeOrgs: [{ id: ORG_ID, name: 'Serialise Test' }],
      membershipGroupBy: [{ organizationId: ORG_ID, role: 'TEACHER', _count: { id: 1 } }],
      queryRawReturns: [...windowReturns, ...windowReturns],
    });

    const service = new PlatformHealthService(prisma);
    const result = await service.computePlatformOverview();

    // This throws if any value is BigInt
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 3: Resilience — query failures
// ---------------------------------------------------------------------------

describe('computePlatformOverview() — query failure resilience', () => {
  it('returns zero-filled baseline when the org query itself throws', async () => {
    const prisma = {
      organization: {
        count: jest.fn().mockRejectedValue(new Error('DB connection failed')),
        findMany: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      },
      membership: { groupBy: jest.fn() },
      $queryRaw: jest.fn(),
    } as unknown as PrismaService;

    const service = new PlatformHealthService(prisma);
    // Should not throw
    const result = await service.computePlatformOverview();

    expect(result).toBeDefined();
    expect(result.totalOrganizations).toBe(0);
    expect(result.topOrganizations).toEqual([]);
  });
});
