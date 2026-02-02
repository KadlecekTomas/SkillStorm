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
}
