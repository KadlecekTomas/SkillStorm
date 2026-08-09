import { Injectable } from '@nestjs/common';
import { LiveParticipantStatus } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassroomOrchestrationService } from './classroom-orchestration.service';
import {
  resolveNetworkedCoopState,
  type CoopMarker,
  type CoopPeer,
} from './networked-coop-state';

const ROLE_EVENTS = ['COOP_ROLE_HANDOFF', 'COOP_ROLE_ROTATED'] as const;
const PROGRAM_EVENT = 'COOP_PROGRAM_UPDATED';

const REACTOR_LEVELS = [
  { min: 0, key: 'BOOT', label: 'Boot sequence' },
  { min: 25, key: 'PULSE', label: 'Pulse online' },
  { min: 50, key: 'ORBIT', label: 'Orbit locked' },
  { min: 75, key: 'NOVA', label: 'Nova mode' },
] as const;

function numberFromPayload(payload: unknown, key: string, fallback: number): number {
  if (!payload || typeof payload !== 'object') return fallback;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

@Injectable()
export class AlgorithmLabAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classroom: ClassroomOrchestrationService,
  ) {}

  async get(sessionId: string, ctx: OrgContext) {
    const session = await this.classroom.getTeacherProjection(sessionId, ctx);
    const groupIds = session.groups.map((group) => group.id);
    const participantIds = session.participants.map((participant) => participant.id);

    const events = participantIds.length
      ? await this.prisma.liveSemanticEvent.findMany({
          where: {
            sessionId,
            participantId: { in: participantIds },
            eventType: {
              in: [
                'COOP_ROLE_HANDOFF',
                'COOP_ROLE_ROTATED',
                PROGRAM_EVENT,
                'PROGRAM_RUN',
                'TEST_FAILED',
                'HINT_REQUESTED',
                'DEBUG_HYPOTHESIS_SUBMITTED',
              ],
            },
          },
          orderBy: [{ receivedAt: 'asc' }],
          select: {
            participantId: true,
            eventType: true,
            payload: true,
            receivedAt: true,
          },
        })
      : [];

    const groups = session.groups.map((group) => {
      const members = session.participants
        .filter((participant) => participant.groupId === group.id)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
      const memberIds = new Set(members.map((member) => member.id));
      const groupEvents = events.filter(
        (event) => event.participantId && memberIds.has(event.participantId),
      );
      const latestRoleEvent = [...groupEvents]
        .reverse()
        .find((event) =>
          ROLE_EVENTS.includes(event.eventType as (typeof ROLE_EVENTS)[number]),
        );

      const marker: CoopMarker = latestRoleEvent
        ? {
            eventType:
              latestRoleEvent.eventType === 'COOP_ROLE_HANDOFF'
                ? 'COOP_ROLE_HANDOFF'
                : 'COOP_ROLE_ROTATED',
            round: Math.max(
              1,
              numberFromPayload(latestRoleEvent.payload, 'round', 1),
            ),
          }
        : null;

      const peers: CoopPeer[] = members.map((member) => ({
        participantId: member.id,
        nickname: member.nickname ?? 'Žák',
        joinedAt: new Date(member.joinedAt),
        connected: member.status === LiveParticipantStatus.CONNECTED,
      }));
      const coop = resolveNetworkedCoopState(peers, marker);
      const currentRound = coop.round;

      const currentRoundEvents = groupEvents.filter((event) => {
        if (!event.payload || typeof event.payload !== 'object') return true;
        const payloadRound = (event.payload as Record<string, unknown>).round;
        return typeof payloadRound !== 'number' || payloadRound === currentRound;
      });
      const latestProgram = [...currentRoundEvents]
        .reverse()
        .find((event) => event.eventType === PROGRAM_EVENT);
      const programCommands = (
        latestProgram?.payload as Record<string, unknown> | null
      )?.commands;
      const programLength = Array.isArray(programCommands)
        ? programCommands.length
        : 0;

      const failures = currentRoundEvents.filter(
        (event) => event.eventType === 'TEST_FAILED',
      ).length;
      const hints = currentRoundEvents.filter(
        (event) => event.eventType === 'HINT_REQUESTED',
      ).length;
      const runs = currentRoundEvents.filter(
        (event) => event.eventType === 'PROGRAM_RUN',
      ).length;
      const debugHypotheses = currentRoundEvents.filter(
        (event) => event.eventType === 'DEBUG_HYPOTHESIS_SUBMITTED',
      ).length;
      const rotated = groupEvents.some(
        (event) => event.eventType === 'COOP_ROLE_ROTATED',
      );
      const handedOff = currentRoundEvents.some(
        (event) => event.eventType === 'COOP_ROLE_HANDOFF',
      );
      const pairOnline =
        members.filter(
          (member) => member.status === LiveParticipantStatus.CONNECTED,
        ).length >= 2;

      const milestones = {
        pairOnline,
        handedOff,
        programStarted: runs > 0,
        debugLoop: failures > 0 && runs > 1,
        roleRotated: rotated,
        askedForHelp: hints > 0 || debugHypotheses > 0,
      };
      const missionEnergy = Object.values(milestones).filter(Boolean).length;
      const needsAttention =
        failures >= 2 ||
        (failures >= 1 && hints >= 1) ||
        members.some(
          (member) => member.status !== LiveParticipantStatus.CONNECTED,
        );

      return {
        groupId: group.id,
        label: group.label,
        round: currentRound,
        phase: coop.phase,
        plannerParticipantId: coop.plannerParticipantId,
        programmerParticipantId: coop.programmerParticipantId,
        members: members.map((member) => ({
          participantId: member.id,
          nickname: member.nickname ?? 'Žák',
          connected: member.status === LiveParticipantStatus.CONNECTED,
          role: coop.roleByParticipantId[member.id] ?? 'OBSERVER',
        })),
        programLength,
        programRevision: numberFromPayload(
          latestProgram?.payload,
          'programRevision',
          0,
        ),
        failures,
        hints,
        runs,
        debugHypotheses,
        needsAttention,
        missionEnergy,
        milestones,
        lastEventAt: groupEvents.at(-1)?.receivedAt.toISOString() ?? null,
      };
    });

    const maxEnergy = Math.max(1, groups.length * 6);
    const earnedEnergy = groups.reduce(
      (sum, group) => sum + group.missionEnergy,
      0,
    );
    const progressPct = Math.min(
      100,
      Math.round((earnedEnergy / maxEnergy) * 100),
    );
    const level = [...REACTOR_LEVELS]
      .reverse()
      .find((candidate) => progressPct >= candidate.min)!;

    const ungrouped = session.participants
      .filter(
        (participant) =>
          !participant.groupId || !groupIds.includes(participant.groupId),
      )
      .map((participant) => ({
        participantId: participant.id,
        nickname: participant.nickname ?? 'Žák',
        connected: participant.status === LiveParticipantStatus.CONNECTED,
      }));

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      session: {
        status: session.status,
        mode: session.mode,
        stateRevision: session.stateRevision,
        lessonTitle: session.lesson.title,
        stageTitle:
          session.lesson.stages.find(
            (stage) => stage.id === session.currentLessonStageId,
          )?.title ?? null,
      },
      summary: {
        groups: groups.length,
        connectedPairs: groups.filter(
          (group) => group.members.filter((member) => member.connected).length >= 2,
        ).length,
        needsAttention: groups.filter((group) => group.needsAttention).length,
        waiting: groups.filter((group) => group.phase === 'WAITING').length,
        totalProgramRuns: groups.reduce((sum, group) => sum + group.runs, 0),
        totalFailures: groups.reduce((sum, group) => sum + group.failures, 0),
      },
      reactor: {
        earnedEnergy,
        maxEnergy,
        progressPct,
        level: level.key,
        label: level.label,
        nextLevelAt:
          REACTOR_LEVELS.find((candidate) => candidate.min > progressPct)?.min ??
          100,
        rankingEnabled: false,
        masteryImpact: false,
      },
      groups: groups.sort(
        (a, b) =>
          Number(b.needsAttention) - Number(a.needsAttention) ||
          a.label.localeCompare(b.label),
      ),
      ungrouped,
      privacy: {
        pointerStreams: 0,
        publicLeaderboard: false,
        rawScreenTelemetry: false,
      },
    };
  }
}
