import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { subDays } from 'date-fns';
import { OrganizationRole, OrganizationStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  HEALTH_PLAYBOOK,
  ORG_ID_PLACEHOLDER,
  type HealthRecommendationCode,
  type PlaybookAction,
} from './health-playbook';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type HealthMetric = {
  key: string;
  label: string;
  raw: number;
  cap: number;
  normalized: number;
  weight: number;
  contribution: number;
};

export type TrendMetric = {
  rawA: number;
  rawB: number;
  deltaRaw: number;
  normA: number;
  normB: number;
  deltaNorm: number;
};

export type OrgTrend = {
  scorePrev30d: number;
  deltaScore: number;
  /** UP (delta >= +5) | DOWN (delta <= -5) | FLAT */
  trendLabel: 'UP' | 'DOWN' | 'FLAT';
  metrics: Record<string, TrendMetric>;
};

export type HealthRecommendation = {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  playbook: {
    title: string;
    why: string;
    actions: PlaybookAction[];
  };
};

export type OrgHealthRaw = {
  totalTeachers: number;
  totalStudents: number;
  activeCreators30d: number;
  activeGraders30d: number;
  activeSubmitters30d: number;
  testsCreated30d: number;
  completionSmoothed30d: number;
  inviteConversion30d: number;
};

export type OrgHealthSummary = {
  organizationId: string;
  organizationName: string;
  score: number;
  deltaScore: number;
  trendLabel: 'UP' | 'DOWN' | 'FLAT';
  signals: {
    totalTeachers: number;
    totalStudents: number;
    activeCreators30d: number;
    activeGraders30d: number;
    activeSubmitters30d: number;
    testsCreated30d: number;
  };
};

export type OrgHealthDetail = OrgHealthSummary & {
  organizationStatus: string;
  organizationCreatedAt: Date;
  raw: OrgHealthRaw;
  breakdown: HealthMetric[];
  trend: OrgTrend;
  recommendations: HealthRecommendation[];
};

export type PlatformAnalyticsOverview = {
  totalOrganizations: number;
  activeOrganizationsLast30Days: number;
  averageHealthScore: number;
  lowHealthOrganizations: OrgHealthSummary[];
  topOrganizations: OrgHealthSummary[];
};

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

// Use `unknown` for numeric fields: Prisma $queryRaw returns BigInt for COUNT()
// regardless of SQL cast (::int or ::bigint). toNumber() normalises everything.
type OrgCountRow = { organization_id: string; count: unknown };
type OrgInviteRow = {
  organization_id: string;
  used: unknown;
  max_uses: unknown;
  cnt: unknown;
};

// ---------------------------------------------------------------------------
// Internal window aggregate type
// ---------------------------------------------------------------------------

type WindowMetrics = {
  creators: Map<string, number>;
  graders: Map<string, number>;
  submitters: Map<string, number>;
  testsCreated: Map<string, number>;
  totalSubs: Map<string, number>;
  approvedSubs: Map<string, number>;
  invites: Map<string, { used: number; max: number; count: number }>;
};

// ---------------------------------------------------------------------------
// Score config (weights + key order for trend map)
// ---------------------------------------------------------------------------

const METRIC_KEYS = [
  'teacherActivity',
  'studentActivity',
  'contentVelocity',
  'completionQuality',
  'onboarding',
] as const;

// ---------------------------------------------------------------------------
// In-memory cache for overview (5 min TTL)
// ---------------------------------------------------------------------------

type CacheEntry<T> = { data: T; expiresAt: number };

// ---------------------------------------------------------------------------
// Defensive helpers
// ---------------------------------------------------------------------------

/**
 * Converts any DB count value to a finite JS number.
 * Handles: BigInt (Prisma $queryRaw), number, string, null, undefined.
 * Exported for unit testing only.
 */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Safe division — returns 0 when denominator is 0, negative, or non-finite. */
function safeDivide(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return n / d;
}

/** Clamps to [0, 1]. Non-finite values (NaN, Infinity) map to 0. */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Extracts non-PII error metadata for structured logging. */
function safeError(err: unknown): {
  name: string;
  message: string;
  stackTop: string;
} {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stackTop: (err.stack ?? '').split('\n').slice(0, 8).join('\n'),
    };
  }
  return { name: 'UnknownError', message: String(err), stackTop: '' };
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function getCaps(totalTeachers: number, totalStudents: number) {
  const teacher = Math.max(2, Math.ceil(toNumber(totalTeachers) * 0.4));
  const student = Math.max(5, Math.ceil(toNumber(totalStudents) * 0.3));
  const tests = Math.max(1, Math.ceil(toNumber(totalTeachers) * 0.5));
  return {
    teacher: Number.isFinite(teacher) ? teacher : 2,
    student: Number.isFinite(student) ? student : 5,
    tests: Number.isFinite(tests) ? tests : 1,
  };
}

function buildRawFromWindow(
  orgId: string,
  sizes: { totalTeachers: number; totalStudents: number },
  w: WindowMetrics,
): OrgHealthRaw {
  const totalSubs = w.totalSubs.get(orgId) ?? 0;
  const approvedSubs = w.approvedSubs.get(orgId) ?? 0;
  const inv = w.invites.get(orgId) ?? { used: 0, max: 0, count: 0 };

  // Smoothed Laplace completion: denominator >= 10, so div-by-zero is impossible,
  // but safeDivide + clamp01 guard against any future NaN path.
  const completionSmoothed = clamp01(
    safeDivide(approvedSubs + 5, totalSubs + 10),
  );
  const inviteConversion = clamp01(safeDivide(inv.used, inv.max));

  return {
    totalTeachers: sizes.totalTeachers,
    totalStudents: sizes.totalStudents,
    activeCreators30d: w.creators.get(orgId) ?? 0,
    activeGraders30d: w.graders.get(orgId) ?? 0,
    activeSubmitters30d: w.submitters.get(orgId) ?? 0,
    testsCreated30d: w.testsCreated.get(orgId) ?? 0,
    completionSmoothed30d: Math.round(completionSmoothed * 100) / 100,
    inviteConversion30d: Math.round(inviteConversion * 100) / 100,
  };
}

function buildBreakdown(raw: OrgHealthRaw): HealthMetric[] {
  const caps = getCaps(raw.totalTeachers, raw.totalStudents);

  const defs: Array<{
    key: (typeof METRIC_KEYS)[number];
    label: string;
    raw: number;
    cap: number;
    weight: number;
  }> = [
    {
      key: 'teacherActivity',
      label: 'Teacher activity (creators)',
      raw: raw.activeCreators30d,
      cap: caps.teacher,
      weight: 0.3,
    },
    {
      key: 'studentActivity',
      label: 'Student activity (submitters)',
      raw: raw.activeSubmitters30d,
      cap: caps.student,
      weight: 0.25,
    },
    {
      key: 'contentVelocity',
      label: 'Tests created (30 d)',
      raw: raw.testsCreated30d,
      cap: caps.tests,
      weight: 0.15,
    },
    {
      key: 'completionQuality',
      label: 'Completion quality (smoothed)',
      raw: Math.round(raw.completionSmoothed30d * 100) / 100,
      cap: 1,
      weight: 0.2,
    },
    {
      key: 'onboarding',
      label: 'Invite conversion',
      raw: Math.round(raw.inviteConversion30d * 100) / 100,
      cap: 1,
      weight: 0.1,
    },
  ];

  return defs.map((m) => {
    const normalized = clamp01(safeDivide(m.raw, m.cap));
    const contribution = normalized * m.weight;
    return {
      key: m.key,
      label: m.label,
      raw: m.raw,
      cap: m.cap,
      normalized: Math.round(normalized * 100) / 100,
      weight: m.weight,
      contribution: Number.isFinite(contribution)
        ? Math.round(contribution * 100) / 100
        : 0,
    };
  });
}

function computeHealthScore(breakdown: HealthMetric[]): number {
  if (breakdown.length === 0) return 0;
  const raw = breakdown.reduce((acc, m) => acc + m.normalized * m.weight, 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

function buildTrend(
  orgId: string,
  sizes: { totalTeachers: number; totalStudents: number },
  wA: WindowMetrics,
  wB: WindowMetrics,
  scoreA: number,
): OrgTrend {
  const rawA = buildRawFromWindow(orgId, sizes, wA);
  const rawB = buildRawFromWindow(orgId, sizes, wB);
  const bdA = buildBreakdown(rawA);
  const bdB = buildBreakdown(rawB);
  const scoreB = computeHealthScore(bdB);
  const deltaScore = scoreA - scoreB;

  const metricsA = Object.fromEntries(bdA.map((m) => [m.key, m]));
  const metricsB = Object.fromEntries(bdB.map((m) => [m.key, m]));

  const metrics: Record<string, TrendMetric> = {};
  for (const key of METRIC_KEYS) {
    const mA = metricsA[key];
    const mB = metricsB[key];
    if (!mA || !mB) continue;
    metrics[key] = {
      rawA: mA.raw,
      rawB: mB.raw,
      deltaRaw: Math.round((mA.raw - mB.raw) * 100) / 100,
      normA: mA.normalized,
      normB: mB.normalized,
      deltaNorm: Math.round((mA.normalized - mB.normalized) * 100) / 100,
    };
  }

  return {
    scorePrev30d: scoreB,
    deltaScore,
    trendLabel: deltaScore >= 5 ? 'UP' : deltaScore <= -5 ? 'DOWN' : 'FLAT',
    metrics,
  };
}

function buildRecommendations(
  raw: OrgHealthRaw,
  score: number,
  invitesCreated30d: number,
  orgId: string,
): HealthRecommendation[] {
  const codes: HealthRecommendationCode[] = [];

  if (raw.activeCreators30d === 0) codes.push('NO_TEACHER_ACTIVITY');
  if (raw.activeSubmitters30d === 0) codes.push('NO_STUDENT_ACTIVITY');
  if (raw.testsCreated30d === 0) codes.push('NO_NEW_CONTENT');
  if (raw.inviteConversion30d < 0.2 && invitesCreated30d > 5)
    codes.push('LOW_INVITE_CONVERSION');
  if (score < 40) codes.push('AT_RISK');

  return codes.map((code) => {
    const entry = HEALTH_PLAYBOOK[code];
    const actions = entry.actions.map((a) => ({
      ...a,
      value: a.value.replace(new RegExp(ORG_ID_PLACEHOLDER, 'g'), orgId),
    }));
    return {
      code,
      severity: entry.severity,
      message: entry.why,
      playbook: {
        title: entry.title,
        why: entry.why,
        actions,
      },
    };
  });
}

function trendLabel(delta: number): 'UP' | 'DOWN' | 'FLAT' {
  if (delta >= 5) return 'UP';
  if (delta <= -5) return 'DOWN';
  return 'FLAT';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class PlatformHealthService {
  private readonly logger = new Logger(PlatformHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  private overviewCache: CacheEntry<PlatformAnalyticsOverview> | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ── Empty-state factory ──────────────────────────────────────────────────

  private emptyOverview(totalOrganizations: number): PlatformAnalyticsOverview {
    return {
      totalOrganizations,
      activeOrganizationsLast30Days: 0,
      averageHealthScore: 0,
      lowHealthOrganizations: [],
      topOrganizations: [],
    };
  }

  // ── Window metric fetchers ───────────────────────────────────────────────

  /**
   * Fetch all window-specific metric aggregates for a set of orgs between from/to.
   * Runs 7 queries in parallel.
   *
   * Resilience guarantees:
   * - Empty orgIds → returns empty maps immediately (no DB round-trip).
   * - Each query is wrapped with .catch() so a single bad query degrades
   *   gracefully to zeros rather than failing the entire overview.
   * - All maps are pre-initialised to 0 for every orgId so map.get(id)
   *   is always a number, never undefined.
   * - All counts pass through toNumber() to normalise BigInt from Prisma.
   */
  private async fetchWindowMetrics(
    orgIds: string[],
    from: Date,
    to: Date,
  ): Promise<WindowMetrics> {
    if (orgIds.length === 0) {
      return {
        creators: new Map(),
        graders: new Map(),
        submitters: new Map(),
        testsCreated: new Map(),
        totalSubs: new Map(),
        approvedSubs: new Map(),
        invites: new Map(),
      };
    }

    // Inline warn-and-fallback helpers (no PII in log — only metric name).
    const countFallback =
      (metric: string) =>
      (err: unknown): OrgCountRow[] => {
        this.logger.warn(
          `PLATFORM_HEALTH_QUERY_FAILED metric=${metric} ${safeError(err).message}`,
        );
        return [];
      };
    const inviteFallback = (err: unknown): OrgInviteRow[] => {
      this.logger.warn(
        `PLATFORM_HEALTH_QUERY_FAILED metric=invites ${safeError(err).message}`,
      );
      return [];
    };

    const [
      creatorRows,
      graderRows,
      submitterRows,
      testRows,
      totalSubRows,
      approvedSubRows,
      inviteRows,
    ] = await Promise.all([
      this.prisma.$queryRaw<OrgCountRow[]>`
          SELECT organization_id, COUNT(DISTINCT creator_id)::int AS count
          FROM tests
          WHERE organization_id = ANY(${orgIds}::text[])
            AND created_at >= ${from} AND created_at < ${to}
            AND deleted_at IS NULL
          GROUP BY organization_id
        `.catch(countFallback('creators')),

      this.prisma.$queryRaw<OrgCountRow[]>`
          SELECT organization_id, COUNT(DISTINCT created_by_id)::int AS count
          FROM assignments
          WHERE organization_id = ANY(${orgIds}::text[])
            AND created_at >= ${from} AND created_at < ${to}
          GROUP BY organization_id
        `.catch(countFallback('graders')),

      this.prisma.$queryRaw<OrgCountRow[]>`
          SELECT organization_id, COUNT(DISTINCT student_id)::int AS count
          FROM submissions
          WHERE organization_id = ANY(${orgIds}::text[])
            AND created_at >= ${from} AND created_at < ${to}
            AND deleted_at IS NULL
          GROUP BY organization_id
        `.catch(countFallback('submitters')),

      this.prisma.$queryRaw<OrgCountRow[]>`
          SELECT organization_id, COUNT(*)::bigint AS count
          FROM tests
          WHERE organization_id = ANY(${orgIds}::text[])
            AND created_at >= ${from} AND created_at < ${to}
            AND deleted_at IS NULL
          GROUP BY organization_id
        `.catch(countFallback('testsCreated')),

      this.prisma.$queryRaw<OrgCountRow[]>`
          SELECT organization_id, COUNT(*)::bigint AS count
          FROM submissions
          WHERE organization_id = ANY(${orgIds}::text[])
            AND created_at >= ${from} AND created_at < ${to}
            AND deleted_at IS NULL
          GROUP BY organization_id
        `.catch(countFallback('totalSubs')),

      this.prisma.$queryRaw<OrgCountRow[]>`
          SELECT organization_id, COUNT(*)::bigint AS count
          FROM submissions
          WHERE organization_id = ANY(${orgIds}::text[])
            AND status = 'APPROVED'
            AND created_at >= ${from} AND created_at < ${to}
            AND deleted_at IS NULL
          GROUP BY organization_id
        `.catch(countFallback('approvedSubs')),

      this.prisma.$queryRaw<OrgInviteRow[]>`
          SELECT organization_id,
                 COALESCE(SUM(used_count), 0)::bigint AS used,
                 COALESCE(SUM(max_uses), 0)::bigint   AS max_uses,
                 COUNT(*)::bigint                     AS cnt
          FROM invites
          WHERE organization_id = ANY(${orgIds}::text[])
            AND created_at >= ${from} AND created_at < ${to}
          GROUP BY organization_id
        `.catch(inviteFallback),
    ]);

    // Pre-initialise maps to 0 for every requested orgId so lookups are always
    // defined even for orgs that have no activity in this window.
    function initCountMap(): Map<string, number> {
      const m = new Map<string, number>();
      for (const id of orgIds) m.set(id, 0);
      return m;
    }

    const creators = initCountMap();
    const graders = initCountMap();
    const submitters = initCountMap();
    const testsCreated = initCountMap();
    const totalSubs = initCountMap();
    const approvedSubs = initCountMap();
    const invites = new Map<
      string,
      { used: number; max: number; count: number }
    >();
    for (const id of orgIds) invites.set(id, { used: 0, max: 0, count: 0 });

    for (const r of creatorRows)
      creators.set(r.organization_id, toNumber(r.count));
    for (const r of graderRows)
      graders.set(r.organization_id, toNumber(r.count));
    for (const r of submitterRows)
      submitters.set(r.organization_id, toNumber(r.count));
    for (const r of testRows)
      testsCreated.set(r.organization_id, toNumber(r.count));
    for (const r of totalSubRows)
      totalSubs.set(r.organization_id, toNumber(r.count));
    for (const r of approvedSubRows)
      approvedSubs.set(r.organization_id, toNumber(r.count));
    for (const r of inviteRows) {
      invites.set(r.organization_id, {
        used: toNumber(r.used),
        max: toNumber(r.max_uses),
        count: toNumber(r.cnt),
      });
    }

    return {
      creators,
      graders,
      submitters,
      testsCreated,
      totalSubs,
      approvedSubs,
      invites,
    };
  }

  /**
   * Fetch window metrics for a single org.
   * Wrapped in try/catch — returns safe zero baseline on any query failure.
   */
  private async fetchWindowMetricsSingle(
    orgId: string,
    from: Date,
    to: Date,
  ): Promise<WindowMetrics> {
    const zero = (): WindowMetrics => ({
      creators: new Map([[orgId, 0]]),
      graders: new Map([[orgId, 0]]),
      submitters: new Map([[orgId, 0]]),
      testsCreated: new Map([[orgId, 0]]),
      totalSubs: new Map([[orgId, 0]]),
      approvedSubs: new Map([[orgId, 0]]),
      invites: new Map([[orgId, { used: 0, max: 0, count: 0 }]]),
    });

    try {
      const [
        creatorRows,
        graderRows,
        submitterRows,
        testsCount,
        totalSubsCount,
        approvedSubsCount,
        inviteAgg,
      ] = await Promise.all([
        this.prisma.$queryRaw<OrgCountRow[]>`
            SELECT COUNT(DISTINCT creator_id)::int AS count FROM tests
            WHERE organization_id = ${orgId}::text AND created_at >= ${from} AND created_at < ${to} AND deleted_at IS NULL
          `,
        this.prisma.$queryRaw<OrgCountRow[]>`
            SELECT COUNT(DISTINCT created_by_id)::int AS count FROM assignments
            WHERE organization_id = ${orgId}::text AND created_at >= ${from} AND created_at < ${to}
          `,
        this.prisma.$queryRaw<OrgCountRow[]>`
            SELECT COUNT(DISTINCT student_id)::int AS count FROM submissions
            WHERE organization_id = ${orgId}::text AND created_at >= ${from} AND created_at < ${to} AND deleted_at IS NULL
          `,
        this.prisma.test.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: from, lt: to },
            deletedAt: null,
          },
        }),
        this.prisma.submission.count({
          where: {
            organizationId: orgId,
            createdAt: { gte: from, lt: to },
            deletedAt: null,
          },
        }),
        this.prisma.submission.count({
          where: {
            organizationId: orgId,
            status: 'APPROVED',
            createdAt: { gte: from, lt: to },
            deletedAt: null,
          },
        }),
        this.prisma.invite.aggregate({
          where: { organizationId: orgId, createdAt: { gte: from, lt: to } },
          _sum: { usedCount: true, maxUses: true },
          _count: { id: true },
        }),
      ]);

      const inv = {
        used: toNumber(inviteAgg._sum.usedCount),
        max: toNumber(inviteAgg._sum.maxUses),
        count: inviteAgg._count.id,
      };

      return {
        creators: new Map([[orgId, toNumber(creatorRows[0]?.count ?? 0)]]),
        graders: new Map([[orgId, toNumber(graderRows[0]?.count ?? 0)]]),
        submitters: new Map([[orgId, toNumber(submitterRows[0]?.count ?? 0)]]),
        testsCreated: new Map([[orgId, testsCount]]),
        totalSubs: new Map([[orgId, totalSubsCount]]),
        approvedSubs: new Map([[orgId, approvedSubsCount]]),
        invites: new Map([[orgId, inv]]),
      };
    } catch (err) {
      this.logger.warn(
        `PLATFORM_HEALTH_SINGLE_QUERY_FAILED: ${safeError(err).message}`,
      );
      return zero();
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Platform-wide analytics overview with trend delta.
   *
   * Always returns 200 with a sane response:
   * - 0 active orgs → { items: [], kpis: zeros }.
   * - Any compute failure → logs error and returns zero-filled baseline.
   *
   * Round-trip 1: org list + membership counts (parallel).
   * Round-trip 2: windowA aggregates (7 queries, parallel).
   * Round-trip 3: windowB aggregates (7 queries, parallel).
   *
   * Results are cached for CACHE_TTL_MS (5 min). Pass nocache=true to bypass.
   */
  async computePlatformOverview(
    nocache = false,
  ): Promise<PlatformAnalyticsOverview> {
    const now = Date.now();
    if (!nocache && this.overviewCache && this.overviewCache.expiresAt > now) {
      return this.overviewCache.data;
    }

    const nowDate = new Date();
    const cutoffA = subDays(nowDate, 30); // windowA: last 30d
    const cutoffB = subDays(nowDate, 60); // windowB: prev 30d

    // `totalOrganizations` is hoisted so the catch block can include it in the
    // fallback response even if only the org query succeeded before failure.
    let totalOrganizations = 0;

    try {
      // ── Round-trip 1 ──────────────────────────────────────────────────────
      const [total, activeOrgs, membershipCountRows] = await Promise.all([
        this.prisma.organization.count({ where: { deletedAt: null } }),
        this.prisma.organization.findMany({
          where: { status: OrganizationStatus.ACTIVE, deletedAt: null },
          select: { id: true, name: true },
        }),
        this.prisma.membership.groupBy({
          by: ['organizationId', 'role'],
          where: {
            role: {
              in: [
                OrganizationRole.TEACHER,
                OrganizationRole.DIRECTOR,
                OrganizationRole.STUDENT,
              ],
            },
            deletedAt: null,
          },
          _count: { id: true },
        }),
      ]);

      totalOrganizations = total;

      if (activeOrgs.length === 0) {
        const result = this.emptyOverview(totalOrganizations);
        this.overviewCache = {
          data: result,
          expiresAt: now + this.CACHE_TTL_MS,
        };
        return result;
      }

      const orgIds = activeOrgs.map((o) => o.id);

      // Build size maps (teacher/student counts per org — same for both windows)
      const teacherMap = new Map<string, number>();
      const studentMap = new Map<string, number>();
      for (const id of orgIds) {
        teacherMap.set(id, 0);
        studentMap.set(id, 0);
      }
      for (const r of membershipCountRows) {
        if (!orgIds.includes(r.organizationId)) continue;
        if (r.role === OrganizationRole.STUDENT) {
          studentMap.set(
            r.organizationId,
            (studentMap.get(r.organizationId) ?? 0) + r._count.id,
          );
        } else {
          teacherMap.set(
            r.organizationId,
            (teacherMap.get(r.organizationId) ?? 0) + r._count.id,
          );
        }
      }

      // ── Round-trips 2 + 3 (parallel) ──────────────────────────────────────
      // fetchWindowMetrics has per-query catch handlers, so one bad query
      // degrades gracefully rather than throwing here.
      const [wA, wB] = await Promise.all([
        this.fetchWindowMetrics(orgIds, cutoffA, nowDate),
        this.fetchWindowMetrics(orgIds, cutoffB, cutoffA),
      ]);

      // Compute per-org scores
      let activeOrganizationsLast30Days = 0;
      const orgSummaries: OrgHealthSummary[] = [];

      for (const org of activeOrgs) {
        const sizes = {
          totalTeachers: teacherMap.get(org.id) ?? 0,
          totalStudents: studentMap.get(org.id) ?? 0,
        };
        const rawA = buildRawFromWindow(org.id, sizes, wA);
        const bdA = buildBreakdown(rawA);
        const scoreA = computeHealthScore(bdA);

        const rawB = buildRawFromWindow(org.id, sizes, wB);
        const bdB = buildBreakdown(rawB);
        const scoreB = computeHealthScore(bdB);
        const delta = scoreA - scoreB;

        const totalSubsA = wA.totalSubs.get(org.id) ?? 0;
        const testsCreatedA = wA.testsCreated.get(org.id) ?? 0;
        if (totalSubsA > 0 || testsCreatedA > 0) {
          activeOrganizationsLast30Days++;
        }

        orgSummaries.push({
          organizationId: org.id,
          organizationName: org.name,
          score: scoreA,
          deltaScore: delta,
          trendLabel: trendLabel(delta),
          signals: {
            totalTeachers: sizes.totalTeachers,
            totalStudents: sizes.totalStudents,
            activeCreators30d: rawA.activeCreators30d,
            activeGraders30d: rawA.activeGraders30d,
            activeSubmitters30d: rawA.activeSubmitters30d,
            testsCreated30d: rawA.testsCreated30d,
          },
        });
      }

      orgSummaries.sort((a, b) => b.score - a.score);

      const averageHealthScore =
        orgSummaries.length > 0
          ? Math.round(
              orgSummaries.reduce((s, o) => s + o.score, 0) /
                orgSummaries.length,
            )
          : 0;

      const result: PlatformAnalyticsOverview = {
        totalOrganizations,
        activeOrganizationsLast30Days,
        averageHealthScore: Number.isFinite(averageHealthScore)
          ? averageHealthScore
          : 0,
        lowHealthOrganizations: [...orgSummaries]
          .filter((o) => o.score < 40)
          .reverse()
          .slice(0, 10),
        topOrganizations: orgSummaries.slice(0, 5),
      };

      this.overviewCache = { data: result, expiresAt: now + this.CACHE_TTL_MS };
      return result;
    } catch (err) {
      this.logger.error(
        `PLATFORM_HEALTH_OVERVIEW_FAILED: ${safeError(err).message}\n${safeError(err).stackTop}`,
      );
      // Return zero-filled baseline — never propagate 500 to the client.
      return this.emptyOverview(totalOrganizations);
    }
  }

  /** Invalidate the overview cache (called after SUPERADMIN nocache refresh). */
  invalidateOverviewCache(): void {
    this.overviewCache = null;
  }

  /**
   * Full health detail for a single org, including trend vs prev 30d window.
   *
   * Round-trip 1: org meta + membership counts.
   * Round-trip 2: windowA metrics.
   * Round-trip 3: windowB metrics.
   */
  async computeOrgHealth(orgId: string): Promise<OrgHealthDetail> {
    const nowDate = new Date();
    const cutoffA = subDays(nowDate, 30);
    const cutoffB = subDays(nowDate, 60);

    // NotFoundException is intentional and propagated — no catch around this.
    const [org, membershipCounts] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: orgId, deletedAt: null },
        select: { id: true, name: true, status: true, createdAt: true },
      }),
      this.prisma.membership.groupBy({
        by: ['role'],
        where: {
          organizationId: orgId,
          deletedAt: null,
          role: {
            in: [
              OrganizationRole.TEACHER,
              OrganizationRole.DIRECTOR,
              OrganizationRole.STUDENT,
            ],
          },
        },
        _count: { id: true },
      }),
    ]);

    if (!org) throw new NotFoundException('Organization not found');

    let totalTeachers = 0;
    let totalStudents = 0;
    for (const r of membershipCounts) {
      if (r.role === OrganizationRole.STUDENT) {
        totalStudents += r._count.id;
      } else {
        totalTeachers += r._count.id;
      }
    }

    const sizes = { totalTeachers, totalStudents };

    try {
      // ── Round-trips 2 + 3 (parallel) ──────────────────────────────────────
      const [wA, wB] = await Promise.all([
        this.fetchWindowMetricsSingle(orgId, cutoffA, nowDate),
        this.fetchWindowMetricsSingle(orgId, cutoffB, cutoffA),
      ]);

      const rawA = buildRawFromWindow(orgId, sizes, wA);
      const bdA = buildBreakdown(rawA);
      const scoreA = computeHealthScore(bdA);

      const invCount = wA.invites.get(orgId)?.count ?? 0;
      const recommendations = buildRecommendations(
        rawA,
        scoreA,
        invCount,
        orgId,
      );
      const trend = buildTrend(orgId, sizes, wA, wB, scoreA);

      return {
        organizationId: org.id,
        organizationName: org.name,
        organizationStatus: org.status,
        organizationCreatedAt: org.createdAt,
        score: scoreA,
        deltaScore: trend.deltaScore,
        trendLabel: trend.trendLabel,
        signals: {
          totalTeachers,
          totalStudents,
          activeCreators30d: rawA.activeCreators30d,
          activeGraders30d: rawA.activeGraders30d,
          activeSubmitters30d: rawA.activeSubmitters30d,
          testsCreated30d: rawA.testsCreated30d,
        },
        raw: rawA,
        breakdown: bdA,
        trend,
        recommendations,
      };
    } catch (err) {
      this.logger.error(
        `PLATFORM_HEALTH_ORG_DETAIL_FAILED orgId=${orgId}: ${safeError(err).message}`,
      );
      // Return a safe zero-score baseline — NotFoundException was already
      // thrown above if the org doesn't exist, so we know it exists here.
      const zeroRaw: OrgHealthRaw = {
        totalTeachers,
        totalStudents,
        activeCreators30d: 0,
        activeGraders30d: 0,
        activeSubmitters30d: 0,
        testsCreated30d: 0,
        completionSmoothed30d: 0,
        inviteConversion30d: 0,
      };
      const zeroBd = buildBreakdown(zeroRaw);
      return {
        organizationId: org.id,
        organizationName: org.name,
        organizationStatus: org.status,
        organizationCreatedAt: org.createdAt,
        score: 0,
        deltaScore: 0,
        trendLabel: 'FLAT',
        signals: {
          totalTeachers,
          totalStudents,
          activeCreators30d: 0,
          activeGraders30d: 0,
          activeSubmitters30d: 0,
          testsCreated30d: 0,
        },
        raw: zeroRaw,
        breakdown: zeroBd,
        trend: {
          scorePrev30d: 0,
          deltaScore: 0,
          trendLabel: 'FLAT',
          metrics: {},
        },
        recommendations: buildRecommendations(zeroRaw, 0, 0, orgId),
      };
    }
  }
}
