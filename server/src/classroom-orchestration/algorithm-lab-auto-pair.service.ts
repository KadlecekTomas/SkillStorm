import { Injectable } from '@nestjs/common';
import { LiveSessionMode } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';
import type { JoinClassroomSessionDto } from './dto/classroom-orchestration.dto';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';

@Injectable()
export class AlgorithmLabAutoPairService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classroom: ClassroomOrchestrationService,
  ) {}

  async join(sessionId: string, dto: JoinClassroomSessionDto, ctx: OrgContext) {
    const joined = await this.classroom.joinAsStudent(sessionId, dto, ctx);
    if (dto.groupId || joined.groupId) return joined;

    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { mode: true },
    });
    if (session?.mode !== LiveSessionMode.HYBRID) return joined;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${sessionId}:algorithm-auto-pair`}))`;

      const current = await tx.liveSessionParticipant.findUnique({
        where: { id: joined.id },
      });
      if (!current || current.groupId) return current ?? joined;

      const groups = await tx.liveSessionGroup.findMany({
        where: { sessionId },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: { id: true, orderIndex: true },
      });
      const counts = await tx.liveSessionParticipant.groupBy({
        by: ['groupId'],
        where: {
          sessionId,
          membershipId: { not: null },
          groupId: { not: null },
        },
        _count: { _all: true },
      });
      const countByGroup = new Map(
        counts
          .filter((row) => row.groupId)
          .map((row) => [row.groupId!, row._count._all]),
      );
      let group = groups.find((candidate) => (countByGroup.get(candidate.id) ?? 0) < 2);

      if (!group) {
        const created = await tx.liveSessionGroup.create({
          data: {
            sessionId,
            label: `Dvojice ${groups.length + 1}`,
            orderIndex: groups.length,
          },
          select: { id: true, orderIndex: true },
        });
        group = created;
      }

      return tx.liveSessionParticipant.update({
        where: { id: current.id },
        data: { groupId: group.id },
      });
    });
  }
}
