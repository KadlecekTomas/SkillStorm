// src/stats/stats.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { Prisma } from '@prisma/client';
import {
  SystemRole,
  SubmissionStatus,
  AuditEntityType,
  OrganizationRole,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import {
  buildVersionedListKey,
  cacheGetOrSet,
  getOrgVersion,
} from '@/shared/cache/org-cache.utils';
import type { StatsOverviewResponse } from './dto/overview.dto';

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ----- Audit helper --------------------------------------------------------
  private audit(opts: {
    userId?: string;
    orgId?: string | null;
    action: string;
    meta?: Prisma.InputJsonValue;
  }) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: opts.userId ?? null,
      organizationId: opts.orgId ?? null,
      entityType: AuditEntityType.ORGANIZATION,
      entityId: opts.orgId ?? null,
      action: opts.action,
    };
    if (opts.meta !== undefined) {
      data.metadata = opts.meta;
    }
    return this.prisma.auditLog.create({ data });
  }

  // ----- Helpers -------------------------------------------------------------
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

  private async resolveMembership(
    user: JwtPayload,
    organizationId: string | null,
  ) {
    if (user.systemRole === SystemRole.SUPERADMIN) return null;
    if (!organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.userId, organizationId, deletedAt: null },
      select: { id: true, role: true, organizationId: true },
    });
    if (!membership) throw new ForbiddenException('Access denied.');
    return membership;
  }

  private anonymizeId(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 12);
  }

  // ===== ORG OVERVIEW ========================================================
  async getOrgOverview(
    organizationId: string | null,
    user: JwtPayload,
    scope: 'evaluated' | 'all' = 'evaluated',
  ): Promise<StatsOverviewResponse> {
    await this.ensureOrgContext(user, organizationId);
    const membership = await this.resolveMembership(user, organizationId);
    const role = membership?.role ?? user.organizationRole ?? null;

    // TVRDÁ normalizace scope – cokoliv mimo 'all' => 'evaluated'
    const safeScope: 'evaluated' | 'all' =
      scope === 'all' ? 'all' : 'evaluated';

    // v test prostředí nepoužívej cache
    const isTestEnv =
      process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    const useCache = !isTestEnv;

    const scopeId = organizationId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const baseTestWhere: Prisma.TestWhereInput = {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    };
    const cacheKey = buildVersionedListKey({
      namespace: 'stats:overview',
      scopeId,
      version: ver,
      filters:
        role === OrganizationRole.STUDENT || role === OrganizationRole.TEACHER
          ? { membershipId: membership?.id ?? null, role }
          : {},
    });

    const compute = async (): Promise<StatsOverviewResponse> => {
      if (
        (role === OrganizationRole.STUDENT || role === OrganizationRole.TEACHER) &&
        membership
      ) {
        const teacher = await this.prisma.teacher.findFirst({
          where: { membershipId: membership.id, deletedAt: null },
          select: { id: true },
        });
        const submissionScope: Prisma.SubmissionWhereInput =
          role === OrganizationRole.STUDENT
            ? { studentId: membership.id, deletedAt: null, test: { deletedAt: null } }
            : {
                assignment: {
                  organizationId: membership.organizationId,
                  OR: [
                    { createdById: membership.id },
                    ...(teacher ? [{ classSection: { teacherId: teacher.id } }] : []),
                  ],
                },
                deletedAt: null,
                test: { deletedAt: null },
              };

        const [approved, rejected, pending, all, maxAgg, avgAgg, testIds] =
          await this.prisma.$transaction([
            this.prisma.submission.count({
              where: { ...submissionScope, status: SubmissionStatus.APPROVED },
            }),
            this.prisma.submission.count({
              where: { ...submissionScope, status: SubmissionStatus.REJECTED },
            }),
            this.prisma.submission.count({
              where: { ...submissionScope, status: SubmissionStatus.PENDING },
            }),
            this.prisma.submission.count({ where: submissionScope }),
            this.prisma.submission.aggregate({
              where: { ...submissionScope, submittedAt: { not: null } },
              _max: { submittedAt: true },
            }),
            this.prisma.submission.aggregate({
              where: { ...submissionScope, score: { not: null } },
              _avg: { score: true },
            }),
            this.prisma.submission.findMany({
              where: submissionScope,
              distinct: ['testId'],
              select: { testId: true },
            }),
          ]);

        const avgScoreValue = avgAgg._avg?.score ?? null;
        const lastSubmittedAt = maxAgg._max?.submittedAt ?? null;
        const totalTests = testIds.length;
        const evaluated = approved + rejected;
        const passRateEvaluated = evaluated > 0 ? approved / evaluated : 0;
        const passRateAll = all > 0 ? approved / all : 0;

        return {
          scope: safeScope,
          totalTests,
          counts: { approved, rejected, pending, all },
          totalSubmissions: safeScope === 'evaluated' ? evaluated : all,
          pendingSubmissions: pending,
          passRate: safeScope === 'evaluated' ? passRateEvaluated : passRateAll,
          passRateEvaluated,
          passRateAll,
          avgScore: avgScoreValue,
          lastSubmittedAt,
        };
      }

      // žádný filtr na submittedAt – chceme současný stav
      // OPRAVA: počítej všechny submission pokusy (všechny attemptNo), ne jen první
      const [approved, rejected, pending, all, maxAgg, totalTests, avgAgg] =
        await this.prisma.$transaction([
          this.prisma.submission.count({
            where: {
              deletedAt: null,
              test: { is: baseTestWhere },
              status: SubmissionStatus.APPROVED,
            },
          }),
          this.prisma.submission.count({
            where: {
              deletedAt: null,
              test: { is: baseTestWhere },
              status: SubmissionStatus.REJECTED,
            },
          }),
          this.prisma.submission.count({
            where: {
              deletedAt: null,
              test: { is: baseTestWhere },
              status: SubmissionStatus.PENDING,
            },
          }),
          this.prisma.submission.count({
            where: { deletedAt: null, test: { is: baseTestWhere } },
          }),
          this.prisma.submission.aggregate({
            where: {
              deletedAt: null,
              test: { is: baseTestWhere },
              submittedAt: { not: null },
            },
            _max: { submittedAt: true },
          }),
          this.prisma.test.count({ where: baseTestWhere }),
          this.prisma.submission.aggregate({
            // průměr jen ze skutečně vyhodnocených (score != null)
            where: {
              deletedAt: null,
              test: { is: baseTestWhere },
              score: { not: null },
            },
            _avg: { score: true },
          }),
        ]);

      const avgScoreValue = avgAgg._avg?.score ?? null;
      const lastSubmittedAt = maxAgg._max?.submittedAt ?? null;

      // evaluated = všechny schválené + zamítnuté (všechny attempty)
      const evaluated = approved + rejected;
      const passRateEvaluated = evaluated > 0 ? approved / evaluated : 0;
      const passRateAll = all > 0 ? approved / all : 0;

      return {
        // preference z volání – už bezpečně normalizovaná
        scope: safeScope,

        // základní sumáře
        totalTests,
        counts: { approved, rejected, pending, all },

        // ALIASY pro zpětnou kompatibilitu (na to míří tvoje e2e testy)
        totalSubmissions: safeScope === 'evaluated' ? evaluated : all,
        pendingSubmissions: pending,

        // primární hodnoty
        passRate: safeScope === 'evaluated' ? passRateEvaluated : passRateAll,
        passRateEvaluated,
        passRateAll,
        avgScore: avgScoreValue,
        lastSubmittedAt,
      };
    };

    const data = useCache
      ? await cacheGetOrSet(this.cache, cacheKey, 60_000, compute)
      : await compute();

    void this.audit({
      userId: user.userId,
      orgId: organizationId,
      action: 'STATS_ORG_OVERVIEW_READ',
      meta: { scope: safeScope },
    });

    return data;
  }

  // ===== STUDENT DASHBOARD ===================================================
  async getStudentDashboard(
    ids: { membershipId?: string; organizationId: string | null },
    user: JwtPayload,
  ) {
    // AUTH: self v rámci organizace (kromě SUPERADMIN)
    if (user.systemRole !== SystemRole.SUPERADMIN) {
      if (!ids.organizationId || user.organizationId !== ids.organizationId) {
        throw new ForbiddenException('Foreign organization.');
      }
    }

    // Resolve membershipId
    let effectiveMembershipId = ids.membershipId;
    if (!effectiveMembershipId) {
      const m = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          deletedAt: null,
          ...(ids.organizationId ? { organizationId: ids.organizationId } : {}),
        },
        select: { id: true },
      });
      if (!m) throw new ForbiddenException('No membership found.');
      effectiveMembershipId = m.id;
    }

    // Self-check
    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId === ids.organizationId &&
      (user as any)['membershipId'] &&
      (user as any)['membershipId'] !== effectiveMembershipId
    ) {
      throw new ForbiddenException('Can view only own dashboard.');
    }

    // Ověř existenci člena
    const member = await this.prisma.membership.findFirst({
      where: {
        id: effectiveMembershipId,
        deletedAt: null,
        ...(ids.organizationId ? { organizationId: ids.organizationId } : {}),
      },
      include: { user: true, organization: true },
    });
    if (!member) throw new NotFoundException('Membership not found.');

    // Caching
    const scopeId = ids.organizationId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'dashboard:student',
      scopeId,
      version: ver,
      filters: { membershipId: effectiveMembershipId },
    });

    return cacheGetOrSet(this.cache, cacheKey, 60_000, async () => {
      const baseTestWhere: Prisma.TestWhereInput = {
        deletedAt: null,
        ...(ids.organizationId ? { organizationId: ids.organizationId } : {}),
      };

      const baseSubmissionWhere: Prisma.SubmissionWhereInput = {
        studentId: effectiveMembershipId,
        deletedAt: null,
        test: { is: baseTestWhere },
      };

      const [testsTaken, agg, lastSubmissions, allSubs] = await Promise.all([
        this.prisma.submission.count({ where: baseSubmissionWhere }),
        this.prisma.submission.aggregate({
          where: { ...baseSubmissionWhere, score: { not: null } },
          _avg: { score: true },
        }),
        this.prisma.submission.findMany({
          where: { ...baseSubmissionWhere, submittedAt: { not: null } },
          include: { test: { select: { id: true, title: true } } },
          orderBy: { submittedAt: 'desc' },
          take: 5,
        }),
        this.prisma.submission.findMany({
          where: { ...baseSubmissionWhere, submittedAt: { not: null } },
          select: { id: true, testId: true, score: true, submittedAt: true },
          orderBy: [{ testId: 'asc' }, { submittedAt: 'desc' }],
        }),
      ]);

      // byTest: latest + best
      const byTestMap = new Map<string, { latest?: any; best?: any }>();
      for (const s of allSubs) {
        const entry = byTestMap.get(s.testId) ?? {};
        if (!entry.latest) entry.latest = s; // první pro daný test je nejnovější (řadili jsme desc)
        if (
          typeof s.score === 'number' &&
          (!entry.best || (entry.best.score ?? -Infinity) < s.score)
        ) {
          entry.best = s;
        }
        byTestMap.set(s.testId, entry);
      }
      const byTest = Array.from(byTestMap.entries()).map(([testId, v]) => ({
        testId,
        latest: v.latest,
        best: v.best ?? null,
      }));

      return {
        member: {
          id: this.anonymizeId(member.id),
          name: member.user?.name ?? null,
          organization: member.organization?.name ?? null,
          xp: (member as any).xp, // pokud používáš XP/level na membershipu
          level: (member as any).level,
        },
        testsTaken,
        avgScore: agg._avg.score ?? null,
        lastSubmissions: lastSubmissions.map((s) => ({
          id: s.id,
          testId: s.testId,
          testTitle: s.test.title,
          score: s.score,
          submittedAt: s.submittedAt,
          status: (s as any).status,
        })),
        byTest,
      };
    });
  }

  // ===== TEACHER DASHBOARD ===================================================
  async getTeacherDashboard(
    organizationId: string | null,
    user: JwtPayload,
  ) {
    await this.ensureOrgContext(user, organizationId);
    const membership = await this.resolveMembership(user, organizationId);
    if (!membership || membership.role !== OrganizationRole.TEACHER) {
      throw new ForbiddenException('Teacher dashboard requires TEACHER role.');
    }

    // Neshoď 403, když Teacher záznam neexistuje – dashboard má fungovat
    const teacher = await this.prisma.teacher.findFirst({
      where: { membershipId: membership.id, deletedAt: null },
      select: { id: true, organizationId: true },
    });

    const scopeId = organizationId ?? 'GLOBAL';
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'dashboard:teacher',
      scopeId,
      version: ver,
      filters: { membershipId: membership.id },
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
          where: {
            deletedAt: null,
            ...(organizationId ? { orgId: organizationId } : {}),
          },
        }),
        this.prisma.test.count({
          where: { creatorId: membership.id, deletedAt: null },
        }),
        this.prisma.submission.aggregate({
          where: {
            deletedAt: null,
            test: { creatorId: membership.id, deletedAt: null },
            score: { not: null },
          },
          _avg: { score: true },
        }),
        this.prisma.submission.count({
          where: {
            deletedAt: null,
            test: { creatorId: membership.id, deletedAt: null },
            status: SubmissionStatus.PENDING,
          },
        }),
        this.prisma.submission.findMany({
          where: {
            deletedAt: null,
            test: { creatorId: membership.id, deletedAt: null },
          },
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
