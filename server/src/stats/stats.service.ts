// src/stats/stats.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  Logger,
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
  EnrollmentStatus,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import {
  buildVersionedListKey,
  cacheGetOrSet,
  getResourceVersion,
} from '@/shared/cache/org-cache.utils';
import type { StatsOverviewResponse } from './dto/overview.dto';
import { RiskService } from '@/risk/risk.service';
import { isSchoolStaffRole, teacherClassScope } from '@/shared/access.utils';

const DASHBOARD_SUBMISSION_LIMIT = 2_000;
export function invalidateDirectorDashboardCache(
  _organizationId: string,
): void {}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  /**
   * Centrální service pro dashboardové statistiky a přehledy podle role.
   *
   * Soustřeďuje:
   * - organizační overview,
   * - studentský dashboard,
   * - director dashboard,
   * - pomocné kontroly scope a membershipu,
   * - jednoduchou cache pro dražší agregace.
   *
   * Soubor je větší záměrně: drží statistickou logiku pohromadě na jednom místě,
   * aby výpočty nad submissions, testy a rolemi zůstaly konzistentní.
   */
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private readonly riskService: RiskService,
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

  private daysSince(date: Date | null, now: Date): number {
    if (!date) return Number.POSITIVE_INFINITY;
    const ms = Math.abs(now.getTime() - date.getTime());
    return Math.floor(ms / (24 * 60 * 60 * 1000));
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

    // Guardian audit D5: org-wide overview jen pro školní role; STUDENT má
    // níže zúženou větev. Pozitivní allowlist — neznámá role = 403.
    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      role !== OrganizationRole.STUDENT &&
      !isSchoolStaffRole(role)
    ) {
      throw new ForbiddenException('Access denied');
    }

    // TVRDÁ normalizace scope – cokoliv mimo 'all' => 'evaluated'
    const safeScope: 'evaluated' | 'all' =
      scope === 'all' ? 'all' : 'evaluated';

    // v test prostředí nepoužívej cache
    const isTestEnv =
      process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    const useCache = !isTestEnv;

    const scopeId = organizationId ?? 'GLOBAL';
    const ver = await getResourceVersion(this.cache, scopeId, 'dashboard');
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
        (role === OrganizationRole.STUDENT ||
          role === OrganizationRole.TEACHER) &&
        membership
      ) {
        const teacher = await this.prisma.teacher.findFirst({
          where: { membershipId: membership.id, deletedAt: null },
          select: { id: true },
        });
        const submissionScope: Prisma.SubmissionWhereInput =
          role === OrganizationRole.STUDENT
            ? {
                studentId: membership.id,
                deletedAt: null,
                test: { deletedAt: null },
              }
            : {
                assignment: {
                  organizationId: membership.organizationId,
                  OR: [
                    { createdById: membership.id },
                    // homeroom NEBO aktivní úvazek (audit homeroom-only)
                    ...(teacher
                      ? [{ classSection: teacherClassScope(teacher.id) }]
                      : []),
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
              take: 5000, // safety cap — one row per distinct test
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

      // Počítáme aktuální stav napříč všemi pokusy.
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
            // Průměr pouze z vyhodnocených submission.
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
    const ver = await getResourceVersion(this.cache, scopeId, 'dashboard');
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
          orderBy: { createdAt: 'desc' },
          take: DASHBOARD_SUBMISSION_LIMIT,
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

  // ===== DIRECTOR DASHBOARD ==================================================
  private async buildDirectorDashboard(organizationId: string) {
    // ── Time windows ──────────────────────────────────────────────────────────
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Active academic year ──────────────────────────────────────────────────
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { orgId: organizationId, isCurrent: true, deletedAt: null },
      select: { id: true },
    });

    // ── Parallel root queries ─────────────────────────────────────────────────
    const [testsThisMonth, submissionsThisWeek, classes, teacherMemberships] =
      await Promise.all([
        // Tests created this month
        this.prisma.test.count({
          where: {
            organizationId,
            deletedAt: null,
            createdAt: { gte: startOfMonth },
          },
        }),
        // Submissions this week (all students, any status)
        this.prisma.submission.count({
          where: {
            organizationId,
            deletedAt: null,
            createdAt: { gte: startOfWeek },
          },
        }),
        // Class sections for current year (no deletedAt on ClassSection)
        this.prisma.classSection.findMany({
          where: {
            orgId: organizationId,
            ...(currentYear ? { yearId: currentYear.id } : {}),
          },
          take: 500, // safety cap — classes of one school year
          select: {
            id: true,
            label: true,
            grade: true,
            section: true,
            teacher: {
              select: {
                membership: { select: { user: { select: { name: true } } } },
              },
            },
            _count: {
              select: {
                enrollments: {
                  where: { status: EnrollmentStatus.ACTIVE },
                },
              },
            },
          },
        }),
        // Same teacher source as GET /teachers so homepage and teacher manager stay aligned.
        this.prisma.teacher.findMany({
          where: { organizationId, deletedAt: null },
          take: 1000, // safety cap — teachers of one org
          select: {
            membershipId: true,
            membership: {
              select: { id: true, user: { select: { name: true } } },
            },
          },
        }),
      ]);

    // ── Per-class score + weekly activity ────────────────────────────────────
    const classIds = classes.map((c) => c.id);
    const allClassSubs = classIds.length
      ? await this.prisma.submission.findMany({
          where: {
            organizationId,
            deletedAt: null,
            score: { not: null },
            assignment: {
              classSectionId: { in: classIds },
              // Scope to current year — prevents cross-year score pollution
              ...(currentYear ? { yearId: currentYear.id } : {}),
            },
          },
          select: {
            earnedPoints: true,
            maxPoints: true,
            submittedAt: true,
            createdAt: true,
            studentId: true,
            assignment: { select: { classSectionId: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: DASHBOARD_SUBMISSION_LIMIT,
        })
      : [];

    // scoreMap uses weighted points (not raw average) to avoid scale mismatch
    const classScoreMap = new Map<
      string,
      { points: number; maxPoints: number; lastAt: Date | null }
    >();
    // Per-student weighted score for at-risk computation (reuses allClassSubs data)
    const studentScoreMap = new Map<
      string,
      { points: number; maxPoints: number; lastAt: Date | null }
    >();
    const classWeekCount = new Map<string, number>();
    for (const s of allClassSubs) {
      const cid = s.assignment?.classSectionId;
      if (!cid) continue;
      const maxScore = s.maxPoints ?? 0;
      if (maxScore <= 0) continue; // skip submissions for tests with no scored questions
      const prev = classScoreMap.get(cid) ?? {
        points: 0,
        maxPoints: 0,
        lastAt: null,
      };
      prev.points += s.earnedPoints ?? 0;
      prev.maxPoints += maxScore;
      if (s.submittedAt && (!prev.lastAt || s.submittedAt > prev.lastAt))
        prev.lastAt = s.submittedAt;
      classScoreMap.set(cid, prev);
      if (s.createdAt >= startOfWeek) {
        classWeekCount.set(cid, (classWeekCount.get(cid) ?? 0) + 1);
      }
      // Accumulate per-student weighted scores for at-risk list
      if (s.studentId && s.earnedPoints != null) {
        const sPrev = studentScoreMap.get(s.studentId) ?? {
          points: 0,
          maxPoints: 0,
          lastAt: null,
        };
        sPrev.points += s.earnedPoints ?? 0;
        sPrev.maxPoints += maxScore;
        if (s.submittedAt && (!sPrev.lastAt || s.submittedAt > sPrev.lastAt))
          sPrev.lastAt = s.submittedAt;
        studentScoreMap.set(s.studentId, sPrev);
      }
    }

    const classesResult = classes
      .map((c) => {
        const stats = classScoreMap.get(c.id);
        // Weighted average: SUM(points) / SUM(maxPoints) * 100
        const avgScore =
          stats && stats.maxPoints > 0
            ? Math.round((stats.points / stats.maxPoints) * 10000) / 100
            : null;
        const weekSubs = classWeekCount.get(c.id) ?? 0;
        // Třída bez jediného ohodnoceného odevzdání = NO_DATA, ne HIGH —
        // prázdná/nová třída nesmí na ředitelském dashboardu svítit jako požár.
        const riskLevel: import('@/shared/risk-model').RiskAssessment =
          avgScore === null
            ? 'NO_DATA'
            : this.riskService.computeStudentRisk({
                averageScorePercent: avgScore,
                daysSinceLastActivity: this.daysSince(stats?.lastAt ?? null, now),
                trendPercent: 0,
              });
        return {
          id: c.id,
          label: c.label ?? `${c.grade}.${c.section}`,
          teacherName: c.teacher?.membership?.user?.name ?? null,
          studentCount: c._count.enrollments,
          avgScore: avgScore !== null ? Math.round(avgScore) : null,
          submissionsThisWeek: weekSubs,
          lastActivityAt: stats?.lastAt?.toISOString() ?? null,
          riskLevel,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    // ── Per-teacher activity ──────────────────────────────────────────────────
    const teacherIds = teacherMemberships.map((m) => m.membershipId);
    const [teacherTestCounts, teacherWeekSubs] = await Promise.all([
      this.prisma.test.groupBy({
        by: ['creatorId'],
        where: {
          organizationId,
          deletedAt: null,
          creatorId: { in: teacherIds },
        },
        _count: { id: true },
      }),
      teacherIds.length
        ? this.prisma.submission.findMany({
            where: {
              organizationId,
              deletedAt: null,
              createdAt: { gte: startOfWeek },
              test: { creatorId: { in: teacherIds }, deletedAt: null },
            },
            select: {
              test: { select: { creatorId: true } },
              submittedAt: true,
            },
            take: DASHBOARD_SUBMISSION_LIMIT,
          })
        : Promise.resolve(
            [] as {
              test: { creatorId: string } | null;
              submittedAt: Date | null;
            }[],
          ),
    ]);

    const testCountByTeacher = new Map(
      teacherTestCounts.map((t) => [t.creatorId, t._count.id]),
    );
    const lastSubByTeacher = new Map<string, Date>();
    const weekSubCountByTeacher = new Map<string, number>();
    for (const s of teacherWeekSubs) {
      const tid = s.test?.creatorId;
      if (!tid) continue;
      weekSubCountByTeacher.set(tid, (weekSubCountByTeacher.get(tid) ?? 0) + 1);
      if (s.submittedAt) {
        const prev = lastSubByTeacher.get(tid);
        if (!prev || s.submittedAt > prev)
          lastSubByTeacher.set(tid, s.submittedAt);
      }
    }
    const teachersResult = teacherMemberships
      .map((m) => ({
        membershipId: m.membershipId,
        name: m.membership?.user?.name ?? '—',
        testsCreated: testCountByTeacher.get(m.membershipId) ?? 0,
        submissionsThisWeek: weekSubCountByTeacher.get(m.membershipId) ?? 0,
        lastActivityAt:
          lastSubByTeacher.get(m.membershipId)?.toISOString() ?? null,
        activeThisWeek: weekSubCountByTeacher.has(m.membershipId),
      }))
      .sort((a, b) => b.submissionsThisWeek - a.submissionsThisWeek);

    // ── At-risk students: unified risk model over weighted score + inactivity ──
    // studentScoreMap was built in the allClassSubs loop above.
    const riskMembershipIds = Array.from(studentScoreMap.entries())
      .filter(([, v]) => {
        if (v.maxPoints <= 0) return false;
        return (
          this.riskService.computeStudentRisk({
            averageScorePercent: (v.points / v.maxPoints) * 100,
            daysSinceLastActivity: this.daysSince(v.lastAt, now),
            trendPercent: 0,
          }) !== 'LOW'
        );
      })
      .map(([studentId]) => studentId);

    const [riskMemberships, riskStudents] = await Promise.all([
      riskMembershipIds.length
        ? this.prisma.membership.findMany({
            where: { id: { in: riskMembershipIds } },
            select: { id: true, user: { select: { name: true } } },
          })
        : Promise.resolve(
            [] as { id: string; user: { name: string | null } | null }[],
          ),
      riskMembershipIds.length
        ? this.prisma.student.findMany({
            where: { membershipId: { in: riskMembershipIds }, deletedAt: null },
            select: {
              membershipId: true,
              enrollments: {
                where: {
                  status: EnrollmentStatus.ACTIVE,
                  ...(currentYear ? { yearId: currentYear.id } : {}),
                },
                select: {
                  classSection: {
                    select: { label: true, grade: true, section: true },
                  },
                },
                take: 1,
              },
            },
          })
        : Promise.resolve(
            [] as {
              membershipId: string;
              enrollments: {
                classSection: {
                  label: string | null;
                  grade: string;
                  section: string;
                } | null;
              }[];
            }[],
          ),
    ]);

    const nameMap = new Map(
      riskMemberships.map((m) => [m.id, m.user?.name ?? '—']),
    );
    const classLabelMap = new Map(
      riskStudents.map((s) => {
        const cs = s.enrollments[0]?.classSection;
        return [
          s.membershipId,
          cs?.label ?? `${cs?.grade ?? ''}.${cs?.section ?? ''}`,
        ];
      }),
    );

    const atRiskStudents = Array.from(studentScoreMap.entries())
      .filter(([, v]) => {
        if (v.maxPoints <= 0) return false;
        return (
          this.riskService.computeStudentRisk({
            averageScorePercent: (v.points / v.maxPoints) * 100,
            daysSinceLastActivity: this.daysSince(v.lastAt, now),
            trendPercent: 0,
          }) !== 'LOW'
        );
      })
      .sort(
        (a, b) => a[1].points / a[1].maxPoints - b[1].points / b[1].maxPoints,
      )
      .slice(0, 10)
      .map(([studentId, v]) => ({
        studentId,
        displayName: nameMap.get(studentId) ?? '—',
        classLabel: classLabelMap.get(studentId) ?? '—',
        averageScorePercent: Math.round((v.points / v.maxPoints) * 10000) / 100,
        lastActivityAt: v.lastAt?.toISOString() ?? null,
      }));

    const activeTeachersThisWeek = teachersResult.filter(
      (t) => t.activeThisWeek,
    ).length;
    const activeClassesThisWeek = classesResult.filter(
      (c) => c.submissionsThisWeek > 0,
    ).length;

    return {
      testsThisMonth,
      submissionsThisWeek,
      activeTeachersThisWeek,
      activeClassesThisWeek,
      classes: classesResult,
      teachers: teachersResult,
      atRiskStudents,
    };
  }

  async getDirectorDashboard(organizationId: string | null, user: JwtPayload) {
    await this.ensureOrgContext(user, organizationId);
    const membership = await this.resolveMembership(user, organizationId);
    const isDirectorLevel =
      membership?.role === OrganizationRole.DIRECTOR ||
      (membership?.role as string) === 'OWNER';
    if (!isDirectorLevel && user.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Director dashboard requires DIRECTOR or OWNER role.',
      );
    }
    if (!organizationId) {
      throw new ForbiddenException('Organization context required.');
    }

    const dashboard = await this.buildDirectorDashboard(organizationId);
    return dashboard;
  }

  // ===== TEACHER DASHBOARD ===================================================
  async getTeacherDashboard(organizationId: string | null, user: JwtPayload) {
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
    const ver = await getResourceVersion(this.cache, scopeId, 'dashboard');
    const cacheKey = buildVersionedListKey({
      namespace: 'dashboard:teacher',
      scopeId,
      version: ver,
      filters: { membershipId: membership.id },
    });

    return cacheGetOrSet(this.cache, cacheKey, 60_000, async () => {
      const currentYear = organizationId
        ? await this.prisma.academicYear.findFirst({
            where: { orgId: organizationId, isCurrent: true, deletedAt: null },
            select: { id: true },
          })
        : null;

      const [
        classroomsCount,
        studentsCount,
        testsCreated,
        scoredSubs,
        pending,
        recent,
      ] = await Promise.all([
        this.prisma.classSection.count({
          where: {
            // homeroom NEBO aktivní úvazek (audit homeroom-only)
            ...teacherClassScope(teacher?.id ?? '___none___'),
            ...(organizationId ? { orgId: organizationId } : {}),
            ...(currentYear ? { yearId: currentYear.id } : {}),
          },
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
        // Weighted avgScore: SUM(score)/SUM(maxPoints)*100, scoped to current year.
        // _avg: { score } is wrong because score is raw points (not 0–1 fraction).
        this.prisma.submission.findMany({
          where: {
            deletedAt: null,
            earnedPoints: { not: null },
            test: { creatorId: membership.id, deletedAt: null },
            ...(currentYear ? { assignment: { yearId: currentYear.id } } : {}),
          },
          select: {
            earnedPoints: true,
            maxPoints: true,
          },
          take: 2000, // performance cap — sufficient for teacher-level stats
        }),
        this.prisma.submission.count({
          where: {
            deletedAt: null,
            test: { creatorId: membership.id, deletedAt: null },
            status: SubmissionStatus.PENDING,
            // Rozpracovaný pokus není „čeká na vyhodnocení" — až po odevzdání
            submittedAt: { not: null },
            ...(currentYear ? { assignment: { yearId: currentYear.id } } : {}),
          },
        }),
        this.prisma.submission.findMany({
          where: {
            deletedAt: null,
            // „Poslední odevzdání" = jen skutečně odevzdané pokusy; jinak se
            // null submittedAt formátoval jako epocha („před 20653 dny")
            submittedAt: { not: null },
            test: { creatorId: membership.id, deletedAt: null },
            ...(currentYear ? { assignment: { yearId: currentYear.id } } : {}),
          },
          include: {
            test: { select: { id: true, title: true } },
            student: { include: { user: { select: { name: true } } } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 10,
        }),
      ]);

      // Weighted average: SUM(pointsEarned) / SUM(pointsPossible) * 100
      let totalPts = 0;
      let totalMaxPts = 0;
      for (const s of scoredSubs) {
        const maxScore = s.maxPoints ?? 0;
        if (maxScore > 0) {
          totalPts += s.earnedPoints ?? 0;
          totalMaxPts += maxScore;
        }
      }
      const avgScoreOnMyTests =
        totalMaxPts > 0
          ? Math.round((totalPts / totalMaxPts) * 10000) / 100
          : null;

      return {
        classroomsCount,
        studentsCount,
        testsCreated,
        avgScoreOnMyTests,
        pendingSubmissions: pending,
        recentActivity: recent.map((s) => ({
          id: s.id,
          testId: s.testId,
          testTitle: s.test.title,
          studentName: s.student.user?.name ?? null,
          // score je normalizovaný zlomek 0–1 → klient zobrazuje procenta
          score: s.score != null ? Math.round(s.score * 100) : null,
          status: s.status,
          submittedAt: s.submittedAt,
        })),
      };
    });
  }
}
