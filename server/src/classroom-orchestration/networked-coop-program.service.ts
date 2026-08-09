import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LiveSessionStatus, Prisma } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  CoopAlgorithmCommand,
  UpdateNetworkedCoopProgramDto,
} from './dto/networked-coop-program.dto';
import { NetworkedCoopService } from './networked-coop.service';

const PROGRAM_EVENT = 'COOP_PROGRAM_UPDATED';

type ProgramPayload = {
  groupId?: unknown;
  round?: unknown;
  programRevision?: unknown;
  commands?: unknown;
};

@Injectable()
export class NetworkedCoopProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coop: NetworkedCoopService,
  ) {}

  async get(sessionId: string, ctx: OrgContext) {
    const projection = await this.coop.get(sessionId, ctx);
    return this.loadProgram(sessionId, projection);
  }

  async update(
    sessionId: string,
    dto: UpdateNetworkedCoopProgramDto,
    ctx: OrgContext,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await this.coop.get(sessionId, ctx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${sessionId}:${initial.groupId}:coop`}))`;

      const projection = await this.coop.get(sessionId, ctx);
      if (projection.groupId !== initial.groupId) {
        throw new ConflictException({
          code: 'COOP_GROUP_CHANGED',
          message: 'Dvojice se mezitím změnila. Načti aktuální stav.',
        });
      }
      if (projection.sessionStatus !== LiveSessionStatus.RUNNING) {
        throw new ConflictException({
          code: 'COOP_SESSION_NOT_RUNNING',
          message: 'Sdílený program lze měnit jen během spuštěné hodiny.',
        });
      }
      if (
        projection.phase !== 'PROGRAM' ||
        projection.myRole !== 'PROGRAMMER' ||
        !projection.canAct
      ) {
        throw new ForbiddenException({
          code: 'COOP_PROGRAMMER_REQUIRED',
          message: 'Sdílený program může měnit pouze aktivní Programmer.',
        });
      }
      if (!projection.stageId) {
        throw new ConflictException({
          code: 'COOP_STAGE_REQUIRED',
          message: 'Spolupráce nemá aktivní stage.',
        });
      }

      const replay = await tx.liveSemanticEvent.findUnique({
        where: { sessionId_eventId: { sessionId, eventId: dto.operationId } },
        select: { eventType: true },
      });
      if (replay) {
        if (replay.eventType !== PROGRAM_EVENT) {
          throw new ConflictException({
            code: 'COOP_PROGRAM_OPERATION_ID_REUSED',
            message: 'Stejné operationId už bylo použito pro jinou operaci.',
          });
        }
        return {
          replayed: true,
          program: await this.loadProgram(sessionId, projection, tx),
        };
      }

      const current = await this.loadProgram(sessionId, projection, tx);
      if (current.programRevision !== dto.expectedProgramRevision) {
        throw new ConflictException({
          code: 'COOP_PROGRAM_REVISION_MISMATCH',
          message: 'Program se mezitím změnil. Načti aktuální verzi a pokračuj z ní.',
          expectedRevision: dto.expectedProgramRevision,
          actualRevision: current.programRevision,
        });
      }

      const nextRevision = current.programRevision + 1;
      await tx.liveSemanticEvent.create({
        data: {
          sessionId,
          participantId: projection.participantId,
          stageId: projection.stageId,
          eventId: dto.operationId,
          eventType: PROGRAM_EVENT,
          payload: {
            groupId: projection.groupId,
            round: projection.round,
            programRevision: nextRevision,
            commands: dto.commands,
          } as Prisma.InputJsonValue,
          sessionRevision: projection.sessionRevision,
          occurredAt: new Date(),
        },
      });

      return {
        replayed: false,
        program: {
          groupId: projection.groupId,
          round: projection.round,
          programRevision: nextRevision,
          commands: dto.commands,
          updatedByParticipantId: projection.participantId,
        },
      };
    });
  }

  private async loadProgram(
    sessionId: string,
    projection: Awaited<ReturnType<NetworkedCoopService['get']>>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const peerIds = projection.peers.map((peer) => peer.participantId);
    const events = peerIds.length
      ? await client.liveSemanticEvent.findMany({
          where: {
            sessionId,
            participantId: { in: peerIds },
            eventType: PROGRAM_EVENT,
          },
          orderBy: [{ receivedAt: 'desc' }],
          take: 50,
          select: { participantId: true, payload: true },
        })
      : [];

    for (const event of events) {
      const payload = event.payload as ProgramPayload | null;
      if (
        payload?.groupId !== projection.groupId ||
        payload.round !== projection.round ||
        typeof payload.programRevision !== 'number' ||
        !Number.isInteger(payload.programRevision) ||
        !Array.isArray(payload.commands)
      ) {
        continue;
      }
      const commands = payload.commands.filter(
        (command): command is CoopAlgorithmCommand =>
          command === 'FORWARD' || command === 'LEFT' || command === 'RIGHT',
      );
      if (commands.length !== payload.commands.length) continue;

      return {
        groupId: projection.groupId,
        round: projection.round,
        programRevision: Math.max(0, payload.programRevision),
        commands,
        updatedByParticipantId: event.participantId,
      };
    }

    return {
      groupId: projection.groupId,
      round: projection.round,
      programRevision: 0,
      commands: [] as CoopAlgorithmCommand[],
      updatedByParticipantId: null,
    };
  }
}
