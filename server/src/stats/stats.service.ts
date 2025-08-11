import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { SystemRole, SubmissionStatus, AuditEntityType } from '@prisma/client';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import {
  buildVersionedListKey,
  cacheGetOrSet,
  getOrgVersion,
} from 'shared/cache/org-cache.utils';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ----- Audit helper (statické akce jen pro dohled) -----
  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    meta?: Record<string, any> | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.ORGANIZATION,
        entityId: opts.orgId ?? null,
        action: opts.action,
        metadata: opts.meta ?? null,
      },
    });
  }

  // ----- Helpers ---------------------------------------------------
  private async ensureOrgContext(
    user: JwtPayload,
    organizationId?: string | null,
  ) {
    if (user.systemRole === SystemRole.SUPERADMIN) return;
    if (!organizationId || user.organizationId !== organizationId) {
      throw new ForbiddenException('Missing or foreign organization context.');
    }
    const member = await this.prisma.membership.findFirst({
      where: { userId: user.userId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Access denied.');
  }

  // ===== ORG OVERVIEW ==============================================
  async getOrgOverview(
    organizationId: string | null,
    user: JwtPayload,
    scope: 'evaluated' | 'all' = 'evaluated',
  ) {
    await this.ensureOrgContext(user, organizationId);

    const isTestEnv =
      process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    const useCache = !isTestEnv;

    const scopeId = organizationId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);

    const baseTestWhere = {
      organizationId: organizationId ?? undefined,
      deletedAt: null,
    } as const;

    // Robustní podpis dat: počty dle statusu + total + max(submittedAt)
    const [approved, rejected, pending, all, maxAgg] =
      await this.prisma.$transaction([
        this.prisma.submission.count({
          where: { test: baseTestWhere, status: SubmissionStatus.APPROVED },
        }),
        this.prisma.submission.count({
          where: { test: baseTestWhere, status: SubmissionStatus.REJECTED },
        }),
        this.prisma.submission.count({
          where: { test: baseTestWhere, status: SubmissionStatus.PENDING },
        }),
        this.prisma.submission.count({
          where: { test: baseTestWhere },
        }),
        this.prisma.submission.aggregate({
          where: { test: baseTestWhere },
          _max: { submittedAt: true },
        }),
      ]);

    const dataSig = `A:${approved}|R:${rejected}|P:${pending}|T:${all}|M:${
      maxAgg._max.submittedAt?.getTime() ?? 0
    }`;

    const cacheKey = buildVersionedListKey({
      namespace: 'stats:overview',
      scopeId,
      version: ver,
      filters: { scope, dataSig },
    });

    const compute = async () => {
      const [totalTests, avgAgg] = await Promise.all([
        this.prisma.test.count({ where: baseTestWhere }),
        this.prisma.submission.aggregate({
          where: { test: baseTestWhere, score: { not: null } },
          _avg: { score: true },
        }),
      ]);

      if (scope === 'evaluated') {
        const evaluatedCount = approved + rejected; // jen APPROVED + REJECTED
        const passRate = evaluatedCount > 0 ? approved / evaluatedCount : 0;

        return {
          scope,
          totalTests,
          totalSubmissions: evaluatedCount,
          pendingSubmissions: pending,
          avgScore: avgAgg._avg.score ?? null,
          passRate,
        };
      } else {
        // scope === 'all'
        const passRate = all > 0 ? approved / all : 0;

        return {
          scope,
          totalTests,
          totalSubmissions: all,
          pendingSubmissions: pending,
          avgScore: avgAgg._avg.score ?? null,
          passRate,
        };
      }
    };

    const data = useCache
      ? await cacheGetOrSet(this.cache, cacheKey, 60_000, compute)
      : await compute();

    void this.audit({
      userId: user.userId,
      orgId: organizationId,
      action: 'STATS_ORG_OVERVIEW_READ',
      meta: { scope },
    });

    return data;
  }

  // ===== STUDENT DASHBOARD =========================================
  async getStudentDashboard(
    ids: { membershipId?: string; organizationId: string | null },
    user: JwtPayload,
  ) {
    // --- AUTH: self v rámci organizace (kromě SUPERADMIN) ---
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!ids.organizationId || user.organizationId !== ids.organizationId) {
        throw new ForbiddenException('Foreign organization.');
      }
    }

    // --- Resolve membershipId: preferuj JWT, jinak dohledej z DB ---
    let effectiveMembershipId = ids.membershipId;
    if (!effectiveMembershipId) {
      const m = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId: ids.organizationId ?? undefined,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!m) throw new ForbiddenException('No membership found.');
      effectiveMembershipId = m.id;
    }

    // --- Self-check ---
    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId === ids.organizationId &&
      (user as any)['membershipId'] &&
      (user as any)['membershipId'] !== effectiveMembershipId
    ) {
      throw new ForbiddenException('Can view only own dashboard.');
    }

    // --- Ověř existenci člena ---
    const member = await this.prisma.membership.findFirst({
      where: {
        id: effectiveMembershipId,
        organizationId: ids.organizationId ?? undefined,
        deletedAt: null,
      },
      include: { user: true, organization: true },
    });
    if (!member) throw new NotFoundException('Membership not found.');

    // --- Caching (org-scoped verze + člen) ---
    const scopeId = ids.organizationId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'dashboard:student',
      scopeId,
      version: ver,
      filters: { membershipId: effectiveMembershipId },
    });

    return cacheGetOrSet(this.cache, cacheKey, 60_000, async () => {
      const baseTestWhere = {
        deletedAt: null,
        organizationId: ids.organizationId ?? undefined,
      } as const;

      const baseSubmissionWhere = {
        studentId: effectiveMembershipId,
        test: baseTestWhere,
      } as const;

      const [testsTaken, agg, lastSubmissions, allSubs] = await Promise.all([
        this.prisma.submission.count({ where: baseSubmissionWhere }),
        this.prisma.submission.aggregate({
          where: { ...baseSubmissionWhere, score: { not: null } },
          _avg: { score: true },
        }),
        this.prisma.submission.findMany({
          where: baseSubmissionWhere,
          include: { test: { select: { id: true, title: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
        this.prisma.submission.findMany({
          where: baseSubmissionWhere,
          select: { id: true, testId: true, score: true, submittedAt: true },
          orderBy: [{ testId: 'asc' }, { submittedAt: 'desc' }],
        }),
      ]);

      // byTest: latest + best pro každý test
      const byTestMap = new Map<string, { latest?: any; best?: any }>();
      for (const s of allSubs) {
        const entry = byTestMap.get(s.testId) ?? {};
        if (!entry.latest) entry.latest = s; // první pro daný test je nejnovější (desc)
        if (
          !entry.best ||
          (s.score ?? -Infinity) > (entry.best.score ?? -Infinity)
        ) {
          entry.best = s;
        }
        byTestMap.set(s.testId, entry);
      }
      const byTest = Array.from(byTestMap.entries()).map(([testId, v]) => ({
        testId,
        latest: v.latest,
        best: v.best,
      }));

      return {
        member: {
          id: member.id,
          name: member.user?.name ?? null,
          organization: member.organization?.name ?? null,
          xp: member.xp,
          level: member.level,
        },
        testsTaken,
        avgScore: agg._avg.score ?? null,
        lastSubmissions: lastSubmissions.map((s) => ({
          id: s.id,
          testId: s.testId,
          testTitle: s.test.title,
          score: s.score,
          submittedAt: s.submittedAt,
          status: s.status,
        })),
        byTest,
      };
    });
  }

  // ===== TEACHER DASHBOARD ========================================
  async getTeacherDashboard(
    ids: { membershipId: string; organizationId: string | null },
    user: JwtPayload,
  ) {
    await this.ensureOrgContext(user, ids.organizationId);

    const teacher = await this.prisma.teacher.findFirst({
      where: { membershipId: ids.membershipId },
      select: { id: true, organizationId: true },
    });
    if (!teacher && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Teacher entity not found.');
    }

    const scopeId = ids.organizationId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'dashboard:teacher',
      scopeId,
      version: ver,
      filters: { membershipId: ids.membershipId },
    });

    return cacheGetOrSet(this.cache, cacheKey, 60_000, async () => {
      const [
        classroomsCount,
        studentsCount,
        testsCreated,
        scoreAgg,
        pending,
        recent,
      ] = await Promise.all([
        this.prisma.classSection.count({
          where: { teacherId: teacher?.id ?? '___none___' },
        }),
        this.prisma.student.count({
          where: { orgId: ids.organizationId ?? undefined, deletedAt: null },
        }),
        this.prisma.test.count({
          where: { creatorId: ids.membershipId, deletedAt: null },
        }),
        this.prisma.submission.aggregate({
          where: {
            test: { creatorId: ids.membershipId, deletedAt: null },
            score: { not: null },
          },
          _avg: { score: true },
        }),
        this.prisma.submission.count({
          where: {
            test: { creatorId: ids.membershipId, deletedAt: null },
            status: SubmissionStatus.PENDING,
          },
        }),
        this.prisma.submission.findMany({
          where: { test: { creatorId: ids.membershipId, deletedAt: null } },
          include: {
            test: { select: { id: true, title: true } },
            student: { include: { user: { select: { name: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        }),
      ]);

      return {
        classroomsCount,
        studentsCount,
        testsCreated,
        avgScoreOnMyTests: scoreAgg._avg.score ?? null,
        pendingSubmissions: pending,
        recentActivity: recent.map((s) => ({
          id: s.id,
          testId: s.testId,
          testTitle: s.test.title,
          studentName: s.student.user?.name ?? null,
          score: s.score,
          status: s.status,
          submittedAt: s.submittedAt,
        })),
      };
    });
  }
}
