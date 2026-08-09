import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LiveParticipantStatus,
  LiveSessionSourceKind,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';

const TEACHER_ROLES = new Set<OrganizationRole>([
  OrganizationRole.TEACHER,
  OrganizationRole.DIRECTOR,
  OrganizationRole.OWNER,
]);

const BUILD_PC_COMPONENT_COUNT = 8;
const ATTENTION_REJECTION_THRESHOLD = 2;
const ATTENTION_HINT_THRESHOLD = 2;
const STALLED_AFTER_MS = 2 * 60 * 1000;

type SemanticEventRow = {
  participantId: string | null;
  eventType: string;
  payload: Prisma.JsonValue | null;
  occurredAt: Date;
};

type ParticipantSeed = {
  id: string;
  nickname: string | null;
  status: LiveParticipantStatus;
  lastSeenAt: Date | null;
};

type MutableParticipantAnalytics = {
  participantId: string;
  nickname: string;
  status: LiveParticipantStatus;
  installed: Set<string>;
  hintCount: number;
  rejectedPlacements: number;
  lastCheckpoint: string | null;
  lastEventAt: Date | null;
  completed: boolean;
};

function objectPayload(payload: Prisma.JsonValue | null): Record<string, unknown> {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return {};
  return payload as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function humanizeToken(value: string | null): string {
  if (!value) return 'neznámý cíl';
  const known: Record<string, string> = {
    cpu: 'CPU',
    cooler: 'chladič CPU',
    ram: 'RAM',
    ssd: 'SSD',
    gpu: 'GPU',
    psu: 'zdroj',
    atx24: '24pin ATX',
    eps8: 'CPU EPS',
    'cpu-socket': 'CPU socket',
    'cpu-cooler': 'uchycení chladiče',
    'ram-slot': 'RAM slot',
    'ssd-slot': 'SSD slot',
    'gpu-slot': 'PCIe slot',
    'psu-bay': 'pozice zdroje',
    'atx24-socket': '24pin ATX konektor',
    'eps8-socket': 'CPU EPS konektor',
  };
  return known[value] ?? value.replaceAll('-', ' ');
}

export type BuildPcAnalyticsProjection = {
  sessionId: string;
  generatedAt: string;
  classSummary: {
    total: number;
    connected: number;
    completed: number;
    needsAttention: number;
    averageProgressPct: number;
    totalHints: number;
    totalRejectedPlacements: number;
  };
  topMisconception: {
    key: string;
    label: string;
    count: number;
    participantCount: number;
  } | null;
  misconceptionClusters: Array<{
    key: string;
    label: string;
    componentId: string | null;
    slotId: string | null;
    count: number;
    participantCount: number;
  }>;
  participants: Array<{
    participantId: string;
    nickname: string;
    status: LiveParticipantStatus;
    installedCount: number;
    totalComponents: number;
    progressPct: number;
    hintCount: number;
    rejectedPlacements: number;
    lastCheckpoint: string | null;
    lastEventAt: string | null;
    completed: boolean;
    stalled: boolean;
    needsAttention: boolean;
  }>;
};

export function buildBuildPcAnalytics(
  sessionId: string,
  participants: ParticipantSeed[],
  events: SemanticEventRow[],
  now = new Date(),
): BuildPcAnalyticsProjection {
  const byParticipant = new Map<string, MutableParticipantAnalytics>();
  for (const participant of participants) {
    byParticipant.set(participant.id, {
      participantId: participant.id,
      nickname: participant.nickname?.trim() || 'Žák',
      status: participant.status,
      installed: new Set<string>(),
      hintCount: 0,
      rejectedPlacements: 0,
      lastCheckpoint: null,
      lastEventAt: null,
      completed: false,
    });
  }

  const clusters = new Map<
    string,
    { componentId: string | null; slotId: string | null; count: number; participants: Set<string> }
  >();

  for (const event of [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())) {
    if (!event.participantId) continue;
    const analytics = byParticipant.get(event.participantId);
    if (!analytics) continue;
    analytics.lastEventAt = event.occurredAt;
    const payload = objectPayload(event.payload);

    if (event.eventType === 'COMPONENT_PLACED') {
      const componentId = text(payload.componentId);
      if (componentId) analytics.installed.add(componentId);
    } else if (event.eventType === 'HINT_REQUESTED') {
      analytics.hintCount += 1;
    } else if (event.eventType === 'PLACEMENT_REJECTED') {
      analytics.rejectedPlacements += 1;
      const componentId = text(payload.componentId);
      const slotId = text(payload.slotId);
      const key = `${componentId ?? 'unknown'}:${slotId ?? 'unknown'}`;
      const cluster = clusters.get(key) ?? {
        componentId,
        slotId,
        count: 0,
        participants: new Set<string>(),
      };
      cluster.count += 1;
      cluster.participants.add(event.participantId);
      clusters.set(key, cluster);
    } else if (event.eventType === 'CHECKPOINT_COMPLETED') {
      const checkpoint = text(payload.checkpoint);
      analytics.lastCheckpoint = checkpoint;
      if (checkpoint === 'POST_OK') analytics.completed = true;
    }
  }

  const participantRows = [...byParticipant.values()].map((participant) => {
    const installedCount = participant.installed.size;
    const progressPct = participant.completed
      ? 100
      : Math.min(100, Math.round((installedCount / BUILD_PC_COMPONENT_COUNT) * 100));
    const lastSignalAt = participant.lastEventAt;
    const stalled =
      participant.status === LiveParticipantStatus.CONNECTED &&
      !participant.completed &&
      Boolean(lastSignalAt) &&
      now.getTime() - lastSignalAt!.getTime() >= STALLED_AFTER_MS;
    const needsAttention =
      !participant.completed &&
      (participant.rejectedPlacements >= ATTENTION_REJECTION_THRESHOLD ||
        participant.hintCount >= ATTENTION_HINT_THRESHOLD ||
        stalled);

    return {
      participantId: participant.participantId,
      nickname: participant.nickname,
      status: participant.status,
      installedCount,
      totalComponents: BUILD_PC_COMPONENT_COUNT,
      progressPct,
      hintCount: participant.hintCount,
      rejectedPlacements: participant.rejectedPlacements,
      lastCheckpoint: participant.lastCheckpoint,
      lastEventAt: participant.lastEventAt?.toISOString() ?? null,
      completed: participant.completed,
      stalled,
      needsAttention,
    };
  });

  participantRows.sort((a, b) => {
    if (a.needsAttention !== b.needsAttention) return a.needsAttention ? -1 : 1;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.progressPct - b.progressPct;
  });

  const misconceptionClusters = [...clusters.entries()]
    .map(([key, cluster]) => ({
      key,
      label: `${humanizeToken(cluster.componentId)} → ${humanizeToken(cluster.slotId)}`,
      componentId: cluster.componentId,
      slotId: cluster.slotId,
      count: cluster.count,
      participantCount: cluster.participants.size,
    }))
    .sort((a, b) => b.participantCount - a.participantCount || b.count - a.count)
    .slice(0, 6);

  const averageProgressPct = participantRows.length
    ? Math.round(
        participantRows.reduce((sum, participant) => sum + participant.progressPct, 0) /
          participantRows.length,
      )
    : 0;

  return {
    sessionId,
    generatedAt: now.toISOString(),
    classSummary: {
      total: participantRows.length,
      connected: participantRows.filter((participant) => participant.status === LiveParticipantStatus.CONNECTED).length,
      completed: participantRows.filter((participant) => participant.completed).length,
      needsAttention: participantRows.filter((participant) => participant.needsAttention).length,
      averageProgressPct,
      totalHints: participantRows.reduce((sum, participant) => sum + participant.hintCount, 0),
      totalRejectedPlacements: participantRows.reduce(
        (sum, participant) => sum + participant.rejectedPlacements,
        0,
      ),
    },
    topMisconception: misconceptionClusters[0]
      ? {
          key: misconceptionClusters[0].key,
          label: misconceptionClusters[0].label,
          count: misconceptionClusters[0].count,
          participantCount: misconceptionClusters[0].participantCount,
        }
      : null,
    misconceptionClusters,
    participants: participantRows,
  };
}

@Injectable()
export class BuildPcAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(sessionId: string, ctx: OrgContext): Promise<BuildPcAnalyticsProjection> {
    if (!TEACHER_ROLES.has(ctx.role)) {
      throw new ForbiddenException({
        code: 'CLASSROOM_TEACHER_REQUIRED',
        message: 'Analytiku hodiny může zobrazit pouze učitel nebo vedení školy.',
      });
    }

    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        organizationId: true,
        hostId: true,
        sourceKind: true,
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            nickname: true,
            status: true,
            lastSeenAt: true,
          },
        },
      },
    });

    if (
      !session ||
      session.organizationId !== ctx.organizationId ||
      session.sourceKind !== LiveSessionSourceKind.LESSON_EXPERIENCE
    ) {
      throw new NotFoundException({
        code: 'CLASSROOM_SESSION_NOT_FOUND',
        message: 'Interaktivní hodina nebyla nalezena.',
      });
    }
    if (session.hostId !== ctx.membershipId) {
      throw new ForbiddenException({
        code: 'NOT_SESSION_HOST',
        message: 'Analytiku hodiny může zobrazit jen učitel, který ji spustil.',
      });
    }

    const events = await this.prisma.liveSemanticEvent.findMany({
      where: {
        sessionId,
        eventType: {
          in: [
            'COMPONENT_PLACED',
            'PLACEMENT_REJECTED',
            'HINT_REQUESTED',
            'CHECKPOINT_COMPLETED',
          ],
        },
      },
      orderBy: { occurredAt: 'asc' },
      select: {
        participantId: true,
        eventType: true,
        payload: true,
        occurredAt: true,
      },
    });

    return buildBuildPcAnalytics(sessionId, session.participants, events);
  }
}
