import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LiveParticipantStatus,
  LiveSessionMode,
  LiveSessionStatus,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';
import {
  NetworkedCoopAction,
  type NetworkedCoopTransitionDto,
} from './dto/networked-coop.dto';
import {
  resolveNetworkedCoopState,
  type CoopMarker,
  type CoopPeer,
} from './networked-coop-state';

const HANDOFF_EVENT = 'COOP_ROLE_HANDOFF';
const ROTATED_EVENT = 'COOP_ROLE_ROTATED';

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NetworkedCoopService {
  constructor(private readonly prisma: PrismaService) {}

  async get(sessionId: string, ctx: OrgContext) {
    this.assertStudent(ctx);
    return this.loadProjection(this.prisma, sessionId, ctx);
  }

  async transition(
    sessionId: string,
    dto: NetworkedCoopTransitionDto,
    ctx: OrgContext,
  ) {
    this.assertStudent(ctx);

    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.liveSessionParticipant.findFirst({
        where: {
          sessionId,
          membershipId: ctx.membershipId,
          status: LiveParticipantStatus.CONNECTED,
        },
        select: { id: true, groupId: true },
      });
      if (!participant?.groupId) {
        throw new ConflictException({
          code: 'COOP_GROUP_REQUIRED',
          message: 'Síťová spolupráce vyžaduje přiřazení do dvojice.',
        });
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${sessionId}:${participant.groupId}:coop`}))`;

      const replay = await tx.liveSemanticEvent.findUnique({
        where: { sessionId_eventId: { sessionId, eventId: dto.transitionId } },
        select: { id: true },
      });
      if (replay) {
        return {
          replayed: true,
          state: await this.loadProjection(tx, sessionId, ctx),
        };
      }

      const projection = await this.loadProjection(tx, sessionId, ctx);
      if (projection.sessionStatus !== LiveSessionStatus.RUNNING) {
        throw new ConflictException({
          code: 'COOP_SESSION_NOT_RUNNING',
          message: 'Role lze předávat jen během spuštěné hodiny.',
        });
      }
      if (!projection.stageId) {
        throw new ConflictException({
          code: 'COOP_STAGE_REQUIRED',
          message: 'Spolupráce nemá aktivní stage.',
        });
      }

      let eventType: string;
      let nextRound: number;
      if (dto.action === NetworkedCoopAction.HANDOFF) {
        if (projection.phase !== 'PLAN' || projection.myRole !== 'PLANNER') {
          throw new ForbiddenException({
            code: 'COOP_PLANNER_HANDOFF_REQUIRED',
            message: 'Zařízení může předat řízení jen tehdy, když má aktivní roli Planner.',
          });
        }
        eventType = HANDOFF_EVENT;
        nextRound = projection.round;
      } else {
        if (projection.phase !== 'PROGRAM' || projection.myRole !== 'PROGRAMMER') {
          throw new ForbiddenException({
            code: 'COOP_PROGRAMMER_ROTATE_REQUIRED',
            message: 'Nové kolo může zahájit jen aktivní Programmer po běhu programu.',
          });
        }
        eventType = ROTATED_EVENT;
        nextRound = projection.round + 1;
      }

      await tx.liveSemanticEvent.create({
        data: {
          sessionId,
          participantId: projection.participantId,
          stageId: projection.stageId,
          eventId: dto.transitionId,
          eventType,
          payload: {
            round: nextRound,
            action: dto.action,
            reason: dto.reason ?? null,
            groupId: projection.groupId,
          } as Prisma.InputJsonValue,
          sessionRevision: projection.sessionRevision,
          occurredAt: new Date(),
        },
      });

      return {
        replayed: false,
        state: await this.loadProjection(tx, sessionId, ctx),
      };
    });
  }

  private async loadProjection(client: DbClient, sessionId: string, ctx: OrgContext) {
    const participant = await client.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        membershipId: ctx.membershipId,
      },
      select: {
        id: true,
        nickname: true,
        groupId: true,
        status: true,
        session: {
          select: {
            organizationId: true,
            sourceKind: true,
            mode: true,
            status: true,
            stateRevision: true,
            currentLessonStageId: true,
          },
        },
      },
    });

    if (!participant || participant.session.organizationId !== ctx.organizationId) {
      throw new NotFoundException({
        code: 'SESSION_PARTICIPANT_NOT_FOUND',
        message: 'Účast v hodině nebyla nalezena.',
      });
    }
    if (!participant.groupId) {
      throw new ConflictException({
        code: 'COOP_GROUP_REQUIRED',
        message: 'Síťová spolupráce vyžaduje přiřazení do dvojice.',
      });
    }
    if (participant.session.mode !== LiveSessionMode.HYBRID) {
      throw new ConflictException({
        code: 'COOP_REQUIRES_HYBRID_MODE',
        message: 'Dvě žákovská zařízení ve stejné dvojici vyžadují HYBRID režim.',
      });
    }

    const members = await client.liveSessionParticipant.findMany({
      where: {
        sessionId,
        groupId: participant.groupId,
        membershipId: { not: null },
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        nickname: true,
        joinedAt: true,
        status: true,
      },
    });

    const peerIds = members.map((member) => member.id);
    const latest = peerIds.length
      ? await client.liveSemanticEvent.findFirst({
          where: {
            sessionId,
            participantId: { in: peerIds },
            eventType: { in: [HANDOFF_EVENT, ROTATED_EVENT] },
          },
          orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
          select: { eventType: true, payload: true },
        })
      : null;

    const payload = latest?.payload as { round?: unknown } | null;
    const marker: CoopMarker = latest
      ? {
          eventType:
            latest.eventType === HANDOFF_EVENT ? HANDOFF_EVENT : ROTATED_EVENT,
          round:
            typeof payload?.round === 'number' && Number.isInteger(payload.round)
              ? Math.max(1, payload.round)
              : 1,
        }
      : null;

    const peers: CoopPeer[] = members.map((member) => ({
      participantId: member.id,
      nickname: member.nickname,
      joinedAt: member.joinedAt,
      connected: member.status === LiveParticipantStatus.CONNECTED,
    }));
    const state = resolveNetworkedCoopState(peers, marker);
    const myRole = state.roleByParticipantId[participant.id] ?? 'OBSERVER';

    return {
      sessionId,
      sessionStatus: participant.session.status,
      sessionRevision: participant.session.stateRevision,
      stageId: participant.session.currentLessonStageId,
      groupId: participant.groupId,
      participantId: participant.id,
      round: state.round,
      phase: state.phase,
      myRole,
      canAct:
        (state.phase === 'PLAN' && myRole === 'PLANNER') ||
        (state.phase === 'PROGRAM' && myRole === 'PROGRAMMER'),
      plannerParticipantId: state.plannerParticipantId,
      programmerParticipantId: state.programmerParticipantId,
      peers: peers.map((peer) => ({
        participantId: peer.participantId,
        nickname: peer.nickname,
        connected: peer.connected,
        role: state.roleByParticipantId[peer.participantId] ?? 'OBSERVER',
      })),
    };
  }

  private assertStudent(ctx: OrgContext): void {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Síťová spolupráce je určena žákům.',
      });
    }
  }
}
