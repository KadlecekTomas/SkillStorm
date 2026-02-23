import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma, AnalyticsEvent } from '@prisma/client';
import { OrganizationRole } from '@prisma/client';
import type { LogAnalyticsEventDto } from './dto/log-analytics-event.dto';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { subDays } from 'date-fns';

type AnalyticsSummaryItem = { category: string; action: string; count: number };
type AnalyticsSummary = { since: Date; items: AnalyticsSummaryItem[] };

export enum TrendLabel {
  BETTER = 'BETTER',
  SAME = 'SAME',
  WORSE = 'WORSE',
}

export type StudentErrorAnalyticsItem = {
  errorCategoryId: string;
  errorCategoryLabel: string;
  count: number;
  share: number;
  trend: TrendLabel;
};

export type StudentTopicAnalyticsItem = {
  topicId: string;
  topicName: string;
  successRate: number;
  trend: TrendLabel;
};

export type TeacherErrorAnalyticsItem = {
  errorCategoryId: string;
  errorCategoryLabel: string;
  count: number;
  distributionLabel: string;
  trend: TrendLabel;
};

export type TeacherTopicAnalyticsItem = {
  topicId: string;
  topicName: string;
  avgSuccess: number;
  dispersionLabel: string;
  trend: TrendLabel;
};

export type StudentTimelineItem = {
  submissionId: string;
  assignmentId: string;
  testTitle: string;
  submittedAt: string | null;
  score: number | null;
  status: string;
  attemptNo: number;
  openAt: string;
  closeAt: string;
};

export type ClassHeatmapItem = {
  classSectionId: string;
  grade: string;
  section: string;
  assignmentId: string;
  testTitle: string;
  avgScore: number | null;
  submissionCount: number;
  totalStudents: number;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(
    dto: LogAnalyticsEventDto,
    actor: JwtPayload,
  ): Promise<AnalyticsEvent> {
    const data: Prisma.AnalyticsEventUncheckedCreateInput = {
      userId: actor.userId ?? null,
      organizationId: actor.organizationId ?? null,
      category: dto.category,
      action: dto.action,
      label: dto.label ?? null,
      value: dto.value ?? null,
    };
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    return this.prisma.analyticsEvent.create({ data });
  }

  /** Cap for analytics summary when no org filter (e.g. superadmin) to avoid unbounded load. */
  private static readonly SUMMARY_EVENTS_CAP = 500;

  async summary(
    days = 7,
    organizationId?: string | null,
  ): Promise<AnalyticsSummary> {
    const since = subDays(new Date(), days);
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        category: true,
        action: true,
      },
      ...(organizationId ? {} : { take: AnalyticsService.SUMMARY_EVENTS_CAP }),
    });

    const aggregated = new Map<string, AnalyticsSummaryItem>();
    for (const event of events) {
      const key = `${event.category}::${event.action}`;
      const next = aggregated.get(key) ?? {
        category: event.category,
        action: event.action,
        count: 0,
      };
      next.count += 1;
      aggregated.set(key, next);
    }
    const items = Array.from(aggregated.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);

    return {
      since,
      items,
    };
  }

  /**
   * Student timeline: submissions for a student in a given year.
   * STUDENT: only own data. TEACHER/DIRECTOR/OWNER: can query studentId in same org.
   */
  async studentTimeline(
    yearId: string,
    user: JwtPayload,
    studentId: string | null,
  ): Promise<{ items: StudentTimelineItem[] }> {
    if (!yearId || typeof yearId !== 'string') {
      throw new BadRequestException('yearId is required');
    }
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      throw new ForbiddenException('Missing organization context');
    }

    const role = user.organizationRole ?? null;
    const membershipId = user.membershipId ?? null;

    let targetStudentId: string;
    if (role === OrganizationRole.STUDENT) {
      if (!membershipId) {
        throw new ForbiddenException('Student membership not found');
      }
      targetStudentId = membershipId;
    } else if (
      role === OrganizationRole.TEACHER ||
      role === OrganizationRole.DIRECTOR ||
      role === OrganizationRole.OWNER
    ) {
      const sid = studentId ?? null;
      if (!sid || typeof sid !== 'string') {
        throw new BadRequestException('studentId is required for teacher/director/owner');
      }
      targetStudentId = sid;
      const membership = await this.prisma.membership.findFirst({
        where: {
          id: targetStudentId,
          organizationId: orgId,
          role: OrganizationRole.STUDENT,
          deletedAt: null,
        },
      });
      if (!membership) {
        throw new ForbiddenException('Student not found or not in your organization');
      }
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }

    const submissions = await this.prisma.submission.findMany({
      where: {
        studentId: targetStudentId,
        deletedAt: null,
        assignment: {
          yearId,
          organizationId: orgId,
        },
      },
      include: {
        assignment: {
          include: {
            test: { select: { title: true } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const items: StudentTimelineItem[] = submissions.map((s) => ({
      submissionId: s.id,
      assignmentId: s.assignmentId,
      testTitle: s.assignment.test.title,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      score: s.score,
      status: s.status,
      attemptNo: s.attemptNo,
      openAt: s.assignment.openAt.toISOString(),
      closeAt: s.assignment.closeAt.toISOString(),
    }));

    return { items };
  }

  /**
   * Class heatmap: aggregated by classSection + assignment. No student identifiers.
   */
  async classHeatmap(
    yearId: string,
    orgId: string | null,
  ): Promise<{ items: ClassHeatmapItem[] }> {
    if (!yearId || typeof yearId !== 'string') {
      throw new BadRequestException('yearId is required');
    }
    if (!orgId) {
      throw new ForbiddenException('Missing organization context');
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        class_section_id: string;
        grade: string;
        section: string;
        assignment_id: string;
        test_title: string;
        avg_score: number | null;
        submission_count: bigint;
        total_students: bigint;
      }>
    >`
      SELECT
        cs.class_section_id,
        cs.grade::text AS grade,
        cs.section,
        a.assignment_id,
        t.title AS test_title,
        AVG(s.score) AS avg_score,
        COUNT(s.submission_id)::bigint AS submission_count,
        (
          SELECT COUNT(*)::bigint
          FROM enrollments e
          WHERE e.class_section_id = cs.class_section_id
            AND e.status = 'ACTIVE'
        ) AS total_students
      FROM class_sections cs
      JOIN assignments a ON a.class_section_id = cs.class_section_id
      JOIN tests t ON a.test_id = t.test_id
      LEFT JOIN submissions s ON s.assignment_id = a.assignment_id AND s.deleted_at IS NULL
      WHERE a.academic_year_id = ${yearId}
        AND cs.organization_id = ${orgId}
      GROUP BY cs.class_section_id, cs.grade, cs.section, a.assignment_id, t.title
      ORDER BY cs.grade, cs.section, t.title
    `;

    const items: ClassHeatmapItem[] = rows.map((r) => ({
      classSectionId: r.class_section_id,
      grade: r.grade,
      section: r.section,
      assignmentId: r.assignment_id,
      testTitle: r.test_title,
      avgScore: r.avg_score,
      submissionCount: Number(r.submission_count),
      totalStudents: Number(r.total_students),
    }));

    return { items };
  }

  async studentErrorOverview(
    yearId: string,
    user: JwtPayload,
  ): Promise<{ items: StudentErrorAnalyticsItem[] }> {
    if (!yearId || typeof yearId !== 'string') {
      throw new BadRequestException('yearId is required');
    }
    const orgId = user.organizationId ?? null;
    const membershipId = user.membershipId ?? null;
    if (!orgId || !membershipId) {
      throw new ForbiddenException('Missing organization or membership context');
    }
    if (user.organizationRole !== OrganizationRole.STUDENT) {
      throw new ForbiddenException('Only students can access student analytics');
    }

    const now = new Date();
    const currentSince = subDays(now, 30);
    const previousSince = subDays(currentSince, 30);

    const responses = await this.prisma.response.findMany({
      where: {
        submission: {
          studentId: membershipId,
          deletedAt: null,
          assignment: {
            yearId,
            organizationId: orgId,
          },
          createdAt: {
            gte: previousSince,
          },
        },
      },
      select: {
        isCorrect: true,
        submission: {
          select: {
            createdAt: true,
          },
        },
        question: {
          select: {
            id: true,
            text: true,
          },
        },
      },
    });

    type Bucket = {
      label: string;
      currentCount: number;
      previousCount: number;
    };
    const buckets = new Map<string, Bucket>();

    for (const r of responses) {
      if (r.isCorrect === true) continue;
      const createdAt = r.submission.createdAt;
      const key = r.question.id;
      const bucket =
        buckets.get(key) ??
        {
          label: r.question.text,
          currentCount: 0,
          previousCount: 0,
        };
      if (createdAt >= currentSince) {
        bucket.currentCount += 1;
      } else {
        bucket.previousCount += 1;
      }
      buckets.set(key, bucket);
    }

    const totalCurrentErrors = Array.from(buckets.values()).reduce(
      (acc, b) => acc + b.currentCount,
      0,
    );

    const items: StudentErrorAnalyticsItem[] = Array.from(
      buckets.entries(),
    ).map(([questionId, b]) => {
      const share =
        totalCurrentErrors > 0 ? b.currentCount / totalCurrentErrors : 0;
      let trend = TrendLabel.SAME;
      if (b.currentCount > b.previousCount) {
        trend = TrendLabel.WORSE;
      } else if (b.currentCount < b.previousCount) {
        trend = TrendLabel.BETTER;
      }
      return {
        errorCategoryId: questionId,
        errorCategoryLabel: b.label,
        count: b.currentCount,
        share,
        trend,
      };
    });

    items.sort((a, b) => b.count - a.count);

    return { items };
  }

  async studentTopicOverview(
    yearId: string,
    user: JwtPayload,
  ): Promise<{ items: StudentTopicAnalyticsItem[] }> {
    if (!yearId || typeof yearId !== 'string') {
      throw new BadRequestException('yearId is required');
    }
    const orgId = user.organizationId ?? null;
    const membershipId = user.membershipId ?? null;
    if (!orgId || !membershipId) {
      throw new ForbiddenException('Missing organization or membership context');
    }
    if (user.organizationRole !== OrganizationRole.STUDENT) {
      throw new ForbiddenException('Only students can access student analytics');
    }

    const now = new Date();
    const currentSince = subDays(now, 30);
    const previousSince = subDays(currentSince, 30);

    const responses = await this.prisma.response.findMany({
      where: {
        submission: {
          studentId: membershipId,
          deletedAt: null,
          assignment: {
            yearId,
            organizationId: orgId,
          },
          createdAt: {
            gte: previousSince,
          },
        },
      },
      select: {
        isCorrect: true,
        submission: {
          select: {
            createdAt: true,
            assignment: {
              select: {
                topicLevelId: true,
                topicLevel: {
                  select: {
                    id: true,
                    name: true,
                    catalogTopic: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    type TopicBucket = {
      name: string;
      currentCorrect: number;
      currentTotal: number;
      previousCorrect: number;
      previousTotal: number;
    };

    const topicBuckets = new Map<string, TopicBucket>();

    for (const r of responses) {
      const assignment = r.submission.assignment;
      const topicLevel = assignment.topicLevel;
      const topicId = assignment.topicLevelId ?? topicLevel?.id;
      if (!topicId) continue;
      const name =
        topicLevel?.name ??
        topicLevel?.catalogTopic?.name ??
        'Neznámé téma';
      const bucket =
        topicBuckets.get(topicId) ??
        {
          name,
          currentCorrect: 0,
          currentTotal: 0,
          previousCorrect: 0,
          previousTotal: 0,
        };
      const createdAt = r.submission.createdAt;
      const isCorrect = r.isCorrect === true;
      if (createdAt >= currentSince) {
        bucket.currentTotal += 1;
        if (isCorrect) bucket.currentCorrect += 1;
      } else {
        bucket.previousTotal += 1;
        if (isCorrect) bucket.previousCorrect += 1;
      }
      topicBuckets.set(topicId, bucket);
    }

    const items: StudentTopicAnalyticsItem[] = Array.from(
      topicBuckets.entries(),
    ).map(([topicId, b]) => {
      const currentRate =
        b.currentTotal > 0 ? b.currentCorrect / b.currentTotal : 0;
      const previousRate =
        b.previousTotal > 0 ? b.previousCorrect / b.previousTotal : 0;
      let trend = TrendLabel.SAME;
      if (currentRate > previousRate) {
        trend = TrendLabel.BETTER;
      } else if (currentRate < previousRate) {
        trend = TrendLabel.WORSE;
      }
      return {
        topicId,
        topicName: b.name,
        successRate: currentRate,
        trend,
      };
    });

    items.sort((a, b) => a.successRate - b.successRate);

    return { items };
  }

  async teacherClassErrorOverview(
    yearId: string,
    classId: string,
    user: JwtPayload,
  ): Promise<{ items: TeacherErrorAnalyticsItem[] }> {
    if (!yearId || typeof yearId !== 'string') {
      throw new BadRequestException('yearId is required');
    }
    if (!classId || typeof classId !== 'string') {
      throw new BadRequestException('classId is required');
    }
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      throw new ForbiddenException('Missing organization context');
    }
    const role = user.organizationRole ?? null;
    if (
      role !== OrganizationRole.TEACHER &&
      role !== OrganizationRole.DIRECTOR &&
      role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const classSection = await this.prisma.classSection.findFirst({
      where: {
        id: classId,
        orgId,
      },
      select: { id: true },
    });
    if (!classSection) {
      throw new ForbiddenException('Class not found in your organization');
    }

    const now = new Date();
    const currentSince = subDays(now, 30);
    const previousSince = subDays(currentSince, 30);

    const responses = await this.prisma.response.findMany({
      where: {
        submission: {
          deletedAt: null,
          assignment: {
            yearId,
            organizationId: orgId,
            classSectionId: classId,
          },
          createdAt: {
            gte: previousSince,
          },
        },
      },
      select: {
        isCorrect: true,
        submission: {
          select: {
            createdAt: true,
            studentId: true,
          },
        },
        question: {
          select: {
            id: true,
            text: true,
          },
        },
      },
    });

    type ErrorBucket = {
      label: string;
      studentIds: Set<string>;
      currentCount: number;
      previousCount: number;
    };
    const errorBuckets = new Map<string, ErrorBucket>();

    for (const r of responses) {
      if (r.isCorrect === true) continue;
      const createdAt = r.submission.createdAt;
      const questionId = r.question.id;
      const bucket =
        errorBuckets.get(questionId) ??
        {
          label: r.question.text,
          studentIds: new Set<string>(),
          currentCount: 0,
          previousCount: 0,
        };
      bucket.studentIds.add(r.submission.studentId);
      if (createdAt >= currentSince) {
        bucket.currentCount += 1;
      } else {
        bucket.previousCount += 1;
      }
      errorBuckets.set(questionId, bucket);
    }

    const totalStudentsInErrors = new Set<string>();
    for (const bucket of errorBuckets.values()) {
      for (const sid of bucket.studentIds) {
        totalStudentsInErrors.add(sid);
      }
    }
    const totalStudentsCount = totalStudentsInErrors.size || 1;

    const items: TeacherErrorAnalyticsItem[] = Array.from(
      errorBuckets.entries(),
    ).map(([questionId, b]) => {
      const affectedShare = b.studentIds.size / totalStudentsCount;
      const distributionLabel =
        affectedShare > 0.5 ? 'většina žáků' : 'menší část třídy';
      let trend = TrendLabel.SAME;
      if (b.currentCount > b.previousCount) {
        trend = TrendLabel.WORSE;
      } else if (b.currentCount < b.previousCount) {
        trend = TrendLabel.BETTER;
      }
      return {
        errorCategoryId: questionId,
        errorCategoryLabel: b.label,
        count: b.currentCount,
        distributionLabel,
        trend,
      };
    });

    items.sort((a, b) => b.count - a.count);

    return { items };
  }

  async teacherClassTopicOverview(
    yearId: string,
    classId: string,
    user: JwtPayload,
  ): Promise<{ items: TeacherTopicAnalyticsItem[] }> {
    if (!yearId || typeof yearId !== 'string') {
      throw new BadRequestException('yearId is required');
    }
    if (!classId || typeof classId !== 'string') {
      throw new BadRequestException('classId is required');
    }
    const orgId = user.organizationId ?? null;
    if (!orgId) {
      throw new ForbiddenException('Missing organization context');
    }
    const role = user.organizationRole ?? null;
    if (
      role !== OrganizationRole.TEACHER &&
      role !== OrganizationRole.DIRECTOR &&
      role !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const classSection = await this.prisma.classSection.findFirst({
      where: {
        id: classId,
        orgId,
      },
      select: { id: true },
    });
    if (!classSection) {
      throw new ForbiddenException('Class not found in your organization');
    }

    const now = new Date();
    const currentSince = subDays(now, 30);
    const previousSince = subDays(currentSince, 30);

    const responses = await this.prisma.response.findMany({
      where: {
        submission: {
          deletedAt: null,
          assignment: {
            yearId,
            organizationId: orgId,
            classSectionId: classId,
          },
          createdAt: {
            gte: previousSince,
          },
        },
      },
      select: {
        isCorrect: true,
        submission: {
          select: {
            createdAt: true,
            studentId: true,
            assignment: {
              select: {
                topicLevelId: true,
                topicLevel: {
                  select: {
                    id: true,
                    name: true,
                    catalogTopic: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    type TopicBucket = {
      name: string;
      studentIds: Set<string>;
      currentCorrect: number;
      currentTotal: number;
      previousCorrect: number;
      previousTotal: number;
    };

    const topicBuckets = new Map<string, TopicBucket>();

    for (const r of responses) {
      const assignment = r.submission.assignment;
      const topicLevel = assignment.topicLevel;
      const topicId = assignment.topicLevelId ?? topicLevel?.id;
      if (!topicId) continue;
      const name =
        topicLevel?.name ??
        topicLevel?.catalogTopic?.name ??
        'Neznámé téma';
      const bucket =
        topicBuckets.get(topicId) ??
        {
          name,
          studentIds: new Set<string>(),
          currentCorrect: 0,
          currentTotal: 0,
          previousCorrect: 0,
          previousTotal: 0,
        };
      bucket.studentIds.add(r.submission.studentId);
      const createdAt = r.submission.createdAt;
      const isCorrect = r.isCorrect === true;
      if (createdAt >= currentSince) {
        bucket.currentTotal += 1;
        if (isCorrect) bucket.currentCorrect += 1;
      } else {
        bucket.previousTotal += 1;
        if (isCorrect) bucket.previousCorrect += 1;
      }
      topicBuckets.set(topicId, bucket);
    }

    const items: TeacherTopicAnalyticsItem[] = Array.from(
      topicBuckets.entries(),
    ).map(([topicId, b]) => {
      const currentRate =
        b.currentTotal > 0 ? b.currentCorrect / b.currentTotal : 0;
      const previousRate =
        b.previousTotal > 0 ? b.previousCorrect / b.previousTotal : 0;
      let trend = TrendLabel.SAME;
      if (currentRate > previousRate) {
        trend = TrendLabel.BETTER;
      } else if (currentRate < previousRate) {
        trend = TrendLabel.WORSE;
      }
      const affectedShare =
        b.studentIds.size > 0 ? b.studentIds.size / b.studentIds.size : 1;
      const dispersionLabel =
        affectedShare > 0.5 ? 'většina žáků' : 'menší část třídy';
      return {
        topicId,
        topicName: b.name,
        avgSuccess: currentRate,
        dispersionLabel,
        trend,
      };
    });

    items.sort((a, b) => a.avgSuccess - b.avgSuccess);

    return { items };
  }
}
