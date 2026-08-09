import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityDeliveryMode,
  LessonExperienceVersionStatus,
  LiveParticipantStatus,
  LiveSessionCommandType,
  LiveSessionMode,
  LiveSessionSourceKind,
  LiveSessionStatus,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveDefaultLiveAgeMode } from '@/live-sessions/live-sessions.constants';
import {
  LIVE_EVIDENCE_EVENT_TYPES,
  semanticPayloadViolation,
} from './classroom-orchestration.constants';
import type {
  ClassroomCommandDto,
  CreateLessonLiveSessionDto,
  CreateSessionGroupsDto,
  JoinClassroomSessionDto,
  SemanticEventDto,
} from './dto/classroom-orchestration.dto';

const TEACHER_ROLES = new Set<OrganizationRole>([
  OrganizationRole.TEACHER,
  OrganizationRole.DIRECTOR,
  OrganizationRole.OWNER,
]);

const lessonSessionInclude = {
  lessonExperienceVersion: {
    include: {
      lessonExperience: {
        select: {
          id: true,
          title: true,
          scope: true,
          organizationId: true,
        },
      },
      stages: {
        orderBy: { orderIndex: 'asc' as const },
        select: {
          id: true,
          stageKey: true,
          orderIndex: true,
          stageType: true,
          title: true,
          durationMin: true,
          activityVersionId: true,
          completionType: true,
          checkpoint: true,
          required: true,
          teacherIntervention: true,
        },
      },
    },
  },
  groups: { orderBy: { orderIndex: 'asc' as const } },
  participants: {
    orderBy: { joinedAt: 'asc' as const },
    select: {
      id: true,
      nickname: true,
      membershipId: true,
      groupId: true,
      status: true,
      joinedAt: true,
      lastSeenAt: true,
      disconnectedAt: true,
    },
  },
} satisfies Prisma.LiveSessionInclude;

type LessonSession = Prisma.LiveSessionGetPayload<{
  include: typeof lessonSessionInclude;
}>;

@Injectable()
export class ClassroomOrchestrationService {
  constructor(private readonly prisma: PrismaService) {}

  async createLessonSession(dto: CreateLessonLiveSessionDto, ctx: OrgContext) {
    this.assertTeacher(ctx);

    const lessonVersion = await this.prisma.lessonExperienceVersion.findUnique({
      where: { id: dto.lessonExperienceVersionId },
      include: {
        lessonExperience: {
          select: {
            id: true,
            scope: true,
            organizationId: true,
            deletedAt: true,
          },
        },
        stages: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (
      !lessonVersion ||
      lessonVersion.status !== LessonExperienceVersionStatus.PUBLISHED ||
      lessonVersion.lessonExperience.deletedAt
    ) {
      throw new NotFoundException({
        code: 'LESSON_VERSION_NOT_AVAILABLE',
        message: 'Publikovaná verze hodiny nebyla nalezena.',
      });
    }

    if (
      lessonVersion.lessonExperience.scope === 'ORGANIZATION' &&
      lessonVersion.lessonExperience.organizationId !== ctx.organizationId
    ) {
      throw new NotFoundException({
        code: 'LESSON_VERSION_NOT_AVAILABLE',
        message: 'Publikovaná verze hodiny nebyla nalezena.',
      });
    }

    if (lessonVersion.stages.length === 0) {
      throw new ConflictException({
        code: 'LESSON_HAS_NO_STAGES',
        message: 'Publikovaná hodina neobsahuje žádnou stage.',
      });
    }

    const deliveryMode = dto.mode as unknown as ActivityDeliveryMode;
    if (!lessonVersion.supportedModes.includes(deliveryMode)) {
      throw new BadRequestException({
        code: 'LESSON_MODE_UNSUPPORTED',
        message: 'Tato hodina nepodporuje zvolený režim zařízení.',
      });
    }

    let classGrade = null;
    if (dto.classSectionId) {
      const classSection = await this.prisma.classSection.findFirst({
        where: { id: dto.classSectionId, orgId: ctx.organizationId },
        select: { id: true, grade: true },
      });
      if (!classSection) {
        throw new NotFoundException({
          code: 'CLASS_SECTION_NOT_FOUND',
          message: 'Třída nebyla nalezena.',
        });
      }
      classGrade = classSection.grade;
    }

    const created = await this.prisma.liveSession.create({
      data: {
        organizationId: ctx.organizationId,
        hostId: ctx.membershipId,
        classSectionId: dto.classSectionId ?? null,
        testId: null,
        lessonExperienceVersionId: lessonVersion.id,
        sourceKind: LiveSessionSourceKind.LESSON_EXPERIENCE,
        mode: dto.mode,
        status: LiveSessionStatus.DRAFT,
        ageMode: dto.ageMode ?? resolveDefaultLiveAgeMode(classGrade),
        countdownSec: dto.countdownSec ?? null,
        stateRevision: 0,
      },
      select: { id: true },
    });

    return this.getTeacherProjection(created.id, ctx);
  }

  async getTeacherProjection(sessionId: string, ctx: OrgContext) {
    this.assertTeacher(ctx);
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: lessonSessionInclude,
    });
    this.assertOwnedLessonSession(session, ctx);
    return this.toTeacherProjection(session);
  }

  async command(sessionId: string, dto: ClassroomCommandDto, ctx: OrgContext) {
    this.assertTeacher(ctx);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;

      const session = await tx.liveSession.findUnique({
        where: { id: sessionId },
        include: lessonSessionInclude,
      });
      this.assertOwnedLessonSession(session, ctx);

      const replay = await tx.liveSessionCommand.findUnique({
        where: {
          sessionId_commandId: {
            sessionId,
            commandId: dto.commandId,
          },
        },
      });
      if (replay) {
        if (replay.type !== dto.type) {
          throw new ConflictException({
            code: 'COMMAND_ID_REUSED',
            message: 'Stejné commandId už bylo použito pro jiný příkaz.',
          });
        }
        return { replayed: true, resultingRevision: replay.resultingRevision };
      }

      if (
        dto.expectedRevision !== undefined &&
        dto.expectedRevision !== session.stateRevision
      ) {
        throw new ConflictException({
          code: 'SESSION_REVISION_MISMATCH',
          message: 'Stav hodiny se mezitím změnil. Načti aktuální stav a opakuj akci.',
          expectedRevision: dto.expectedRevision,
          actualRevision: session.stateRevision,
        });
      }

      const stages = session.lessonExperienceVersion?.stages ?? [];
      const now = new Date();
      const fromStatus = session.status;
      const fromStageId = session.currentLessonStageId;
      let toStatus = session.status;
      let toStageId = session.currentLessonStageId;
      const data: Prisma.LiveSessionUpdateInput = {};

      switch (dto.type) {
        case LiveSessionCommandType.START: {
          if (session.status !== LiveSessionStatus.DRAFT) {
            throw this.invalidTransition('START', session.status);
          }
          const first = stages[0];
          if (!first) {
            throw new ConflictException({
              code: 'LESSON_HAS_NO_STAGES',
              message: 'Hodina nemá stage, kterou lze spustit.',
            });
          }
          toStatus = LiveSessionStatus.RUNNING;
          toStageId = first.id;
          data.status = toStatus;
          data.currentLessonStage = { connect: { id: first.id } };
          data.startedAt = session.startedAt ?? now;
          data.pausedAt = null;
          break;
        }
        case LiveSessionCommandType.PAUSE: {
          if (session.status !== LiveSessionStatus.RUNNING) {
            throw this.invalidTransition('PAUSE', session.status);
          }
          toStatus = LiveSessionStatus.PAUSED;
          data.status = toStatus;
          data.pausedAt = now;
          break;
        }
        case LiveSessionCommandType.RESUME: {
          if (session.status !== LiveSessionStatus.PAUSED) {
            throw this.invalidTransition('RESUME', session.status);
          }
          toStatus = LiveSessionStatus.RUNNING;
          data.status = toStatus;
          data.pausedAt = null;
          break;
        }
        case LiveSessionCommandType.NEXT_STAGE: {
          if (session.status !== LiveSessionStatus.RUNNING) {
            throw this.invalidTransition('NEXT_STAGE', session.status);
          }
          const currentIndex = stages.findIndex(
            (stage) => stage.id === session.currentLessonStageId,
          );
          if (currentIndex < 0) {
            throw new ConflictException({
              code: 'CURRENT_STAGE_INVALID',
              message: 'Aktuální stage nepatří k této verzi hodiny.',
            });
          }
          const next = stages[currentIndex + 1];
          if (!next) {
            throw new ConflictException({
              code: 'LAST_STAGE_REQUIRES_FINISH',
              message: 'Poslední stage je dokončena. Použij Ukončit hodinu.',
            });
          }
          toStageId = next.id;
          data.currentLessonStage = { connect: { id: next.id } };
          break;
        }
        case LiveSessionCommandType.FINISH: {
          if (
            session.status !== LiveSessionStatus.RUNNING &&
            session.status !== LiveSessionStatus.PAUSED
          ) {
            throw this.invalidTransition('FINISH', session.status);
          }
          toStatus = LiveSessionStatus.FINISHED;
          data.status = toStatus;
          data.finishedAt = now;
          data.pausedAt = null;
          break;
        }
        default:
          throw new BadRequestException({
            code: 'UNKNOWN_CLASSROOM_COMMAND',
            message: 'Neznámý příkaz hodiny.',
          });
      }

      const resultingRevision = session.stateRevision + 1;
      data.stateRevision = resultingRevision;

      await tx.liveSession.update({
        where: { id: sessionId },
        data,
      });
      await tx.liveSessionCommand.create({
        data: {
          sessionId,
          commandId: dto.commandId,
          type: dto.type,
          actorMembershipId: ctx.membershipId,
          expectedRevision: dto.expectedRevision ?? null,
          resultingRevision,
          fromStatus,
          toStatus,
          fromStageId,
          toStageId,
        },
      });

      return { replayed: false, resultingRevision };
    });

    return {
      ...result,
      session: await this.getTeacherProjection(sessionId, ctx),
    };
  }

  async createSharedDeviceGroups(
    sessionId: string,
    dto: CreateSessionGroupsDto,
    ctx: OrgContext,
  ) {
    this.assertTeacher(ctx);
    const labels = dto.labels.map((label) => label.trim()).filter(Boolean);
    if (labels.length !== dto.labels.length || new Set(labels).size !== labels.length) {
      throw new BadRequestException({
        code: 'INVALID_GROUP_LABELS',
        message: 'Názvy skupin musí být neprázdné a unikátní.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${sessionId}))`;
      const session = await tx.liveSession.findUnique({
        where: { id: sessionId },
        include: lessonSessionInclude,
      });
      this.assertOwnedLessonSession(session, ctx);
      if (session.status !== LiveSessionStatus.DRAFT) {
        throw new ConflictException({
          code: 'GROUPS_LOCKED_AFTER_START',
          message: 'Skupiny lze připravit jen před spuštěním hodiny.',
        });
      }
      if (
        session.mode !== LiveSessionMode.SHARED_DEVICES &&
        session.mode !== LiveSessionMode.HYBRID
      ) {
        throw new ConflictException({
          code: 'GROUPS_REQUIRE_SHARED_MODE',
          message: 'Skupiny patří pouze do SHARED_DEVICES nebo HYBRID režimu.',
        });
      }
      const existing = await tx.liveSessionGroup.count({ where: { sessionId } });
      if (existing > 0) {
        throw new ConflictException({
          code: 'GROUPS_ALREADY_CREATED',
          message: 'Skupiny pro tuto hodinu už existují.',
        });
      }

      const provisioned = [];
      for (let i = 0; i < labels.length; i += 1) {
        const label = labels[i]!;
        const group = await tx.liveSessionGroup.create({
          data: { sessionId, label, orderIndex: i },
        });
        const device = await tx.liveSessionParticipant.create({
          data: {
            sessionId,
            groupId: group.id,
            nickname: label,
            joinToken: this.newJoinToken(),
            membershipId: null,
            status: LiveParticipantStatus.DISCONNECTED,
          },
        });
        provisioned.push({
          groupId: group.id,
          label: group.label,
          orderIndex: group.orderIndex,
          deviceParticipantId: device.id,
          joinToken: device.joinToken,
        });
      }
      return provisioned;
    });
  }

  async joinAsStudent(
    sessionId: string,
    dto: JoinClassroomSessionDto,
    ctx: OrgContext,
  ) {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Tento vstup je určen žákovi.',
      });
    }

    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        organizationId: true,
        sourceKind: true,
        mode: true,
        status: true,
      },
    });
    this.assertParticipantSession(session, ctx);

    if (
      session.mode !== LiveSessionMode.DEVICES &&
      session.mode !== LiveSessionMode.HYBRID
    ) {
      throw new ConflictException({
        code: 'SESSION_DOES_NOT_ACCEPT_STUDENT_DEVICES',
        message: 'Tato hodina nepřijímá individuální žákovská zařízení.',
      });
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        id: ctx.membershipId,
        organizationId: ctx.organizationId,
        role: OrganizationRole.STUDENT,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException({
        code: 'STUDENT_MEMBERSHIP_NOT_FOUND',
        message: 'Žákovské členství nebylo nalezeno.',
      });
    }

    if (dto.groupId) {
      const group = await this.prisma.liveSessionGroup.findFirst({
        where: { id: dto.groupId, sessionId },
        select: { id: true },
      });
      if (!group) {
        throw new NotFoundException({
          code: 'SESSION_GROUP_NOT_FOUND',
          message: 'Skupina nebyla nalezena.',
        });
      }
    }

    const existing = await this.prisma.liveSessionParticipant.findFirst({
      where: { sessionId, membershipId: ctx.membershipId },
    });
    if (existing) {
      if (
        dto.groupId !== undefined &&
        dto.groupId !== existing.groupId &&
        session.status !== LiveSessionStatus.DRAFT
      ) {
        throw new ConflictException({
          code: 'GROUP_LOCKED_AFTER_START',
          message: 'Skupinu nelze změnit po spuštění hodiny.',
        });
      }
      return this.prisma.liveSessionParticipant.update({
        where: { id: existing.id },
        data: {
          nickname: dto.nickname?.trim() || existing.nickname,
          groupId: dto.groupId ?? existing.groupId,
          status: LiveParticipantStatus.CONNECTED,
          lastSeenAt: new Date(),
          disconnectedAt: null,
        },
      });
    }

    return this.prisma.liveSessionParticipant.create({
      data: {
        sessionId,
        membershipId: ctx.membershipId,
        groupId: dto.groupId ?? null,
        nickname: dto.nickname?.trim() || 'Žák',
        joinToken: this.newJoinToken(),
        status: LiveParticipantStatus.CONNECTED,
        lastSeenAt: new Date(),
      },
    });
  }

  async disconnectStudent(sessionId: string, ctx: OrgContext) {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Tento endpoint je určen žákovi.',
      });
    }
    const participant = await this.prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        membershipId: ctx.membershipId,
        session: {
          organizationId: ctx.organizationId,
          sourceKind: LiveSessionSourceKind.LESSON_EXPERIENCE,
        },
      },
    });
    if (!participant) {
      throw new NotFoundException({
        code: 'SESSION_PARTICIPANT_NOT_FOUND',
        message: 'Účast v hodině nebyla nalezena.',
      });
    }
    return this.prisma.liveSessionParticipant.update({
      where: { id: participant.id },
      data: {
        status: LiveParticipantStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  }

  async getStudentProjection(sessionId: string, ctx: OrgContext) {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Tento endpoint je určen žákovi.',
      });
    }
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        currentLessonStage: {
          select: {
            id: true,
            stageKey: true,
            orderIndex: true,
            stageType: true,
            title: true,
            activityVersionId: true,
            completionType: true,
            checkpoint: true,
          },
        },
        participants: {
          where: { membershipId: ctx.membershipId },
          select: { id: true, groupId: true, status: true, lastSeenAt: true },
        },
      },
    });
    this.assertParticipantSession(session, ctx);
    const participant = session.participants[0];
    if (!participant) {
      throw new NotFoundException({
        code: 'SESSION_PARTICIPANT_NOT_FOUND',
        message: 'Nejprve se připoj k hodině.',
      });
    }
    return {
      id: session.id,
      status: session.status,
      mode: session.mode,
      stateRevision: session.stateRevision,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      finishedAt: session.finishedAt,
      participant,
      currentStage: session.currentLessonStage,
    };
  }

  async recordSemanticEvent(
    sessionId: string,
    dto: SemanticEventDto,
    ctx: OrgContext,
  ) {
    if (ctx.role !== OrganizationRole.STUDENT) {
      throw new ForbiddenException({
        code: 'STUDENT_SESSION_ONLY',
        message: 'Žákovské eventy lze zapisovat jen z žákovského kontextu.',
      });
    }

    const payloadViolation = semanticPayloadViolation(dto.payload);
    if (payloadViolation) {
      throw new BadRequestException({
        code: payloadViolation,
        message:
          payloadViolation === 'PAYLOAD_TOO_LARGE'
            ? 'Event payload je příliš velký.'
            : 'Event obsahuje zakázanou kontinuální nebo citlivou telemetrii.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${sessionId}:${dto.eventId}`}))`;

      const existing = await tx.liveSemanticEvent.findUnique({
        where: {
          sessionId_eventId: { sessionId, eventId: dto.eventId },
        },
        include: { evidence: true },
      });
      if (existing) {
        return { replayed: true, event: existing, evidence: existing.evidence };
      }

      const session = await tx.liveSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          organizationId: true,
          sourceKind: true,
          mode: true,
          status: true,
          stateRevision: true,
          currentLessonStageId: true,
          lessonExperienceVersionId: true,
        },
      });
      this.assertParticipantSession(session, ctx);
      if (session.status !== LiveSessionStatus.RUNNING) {
        throw new ConflictException({
          code: 'SESSION_NOT_ACCEPTING_EVENTS',
          message: 'Hodina právě nepřijímá žákovské eventy.',
        });
      }
      if (session.currentLessonStageId !== dto.stageId) {
        throw new ConflictException({
          code: 'EVENT_STAGE_NOT_CURRENT',
          message: 'Event nepatří do aktuální stage hodiny.',
        });
      }

      const participant = await tx.liveSessionParticipant.findFirst({
        where: {
          sessionId,
          membershipId: ctx.membershipId,
          status: LiveParticipantStatus.CONNECTED,
        },
      });
      if (!participant) {
        throw new ConflictException({
          code: 'PARTICIPANT_NOT_CONNECTED',
          message: 'Zařízení není připojeno k této hodině.',
        });
      }

      const stage = await tx.lessonStage.findFirst({
        where: {
          id: dto.stageId,
          lessonExperienceVersionId: session.lessonExperienceVersionId!,
        },
        select: { id: true },
      });
      if (!stage) {
        throw new ConflictException({
          code: 'EVENT_STAGE_VERSION_MISMATCH',
          message: 'Stage nepatří k přesné verzi spuštěné hodiny.',
        });
      }

      const event = await tx.liveSemanticEvent.create({
        data: {
          sessionId,
          participantId: participant.id,
          stageId: dto.stageId,
          eventId: dto.eventId,
          eventType: dto.eventType,
          payload:
            dto.payload === undefined
              ? Prisma.DbNull
              : (dto.payload as Prisma.InputJsonValue),
          sessionRevision: session.stateRevision,
          occurredAt: new Date(dto.occurredAt),
        },
      });

      let evidence = null;
      if (LIVE_EVIDENCE_EVENT_TYPES.has(dto.eventType)) {
        evidence = await tx.liveLearningEvidence.create({
          data: {
            sessionId,
            participantId: participant.id,
            stageId: dto.stageId,
            sourceEventId: event.id,
            evidenceType: dto.eventType,
            payload:
            dto.payload === undefined
              ? Prisma.DbNull
              : (dto.payload as Prisma.InputJsonValue),
            completionIsMastery: false,
          },
        });
      }

      return { replayed: false, event, evidence };
    });
  }

  private toTeacherProjection(session: LessonSession) {
    const lessonVersion = session.lessonExperienceVersion!;
    return {
      id: session.id,
      sourceKind: session.sourceKind,
      status: session.status,
      mode: session.mode,
      stateRevision: session.stateRevision,
      classSectionId: session.classSectionId,
      startedAt: session.startedAt,
      pausedAt: session.pausedAt,
      finishedAt: session.finishedAt,
      currentLessonStageId: session.currentLessonStageId,
      lesson: {
        id: lessonVersion.lessonExperience.id,
        title: lessonVersion.lessonExperience.title,
        versionId: lessonVersion.id,
        versionNo: lessonVersion.versionNo,
        stages: lessonVersion.stages,
      },
      groups: session.groups,
      participants: session.participants,
      participantSummary: {
        total: session.participants.length,
        connected: session.participants.filter(
          (p) => p.status === LiveParticipantStatus.CONNECTED,
        ).length,
        disconnected: session.participants.filter(
          (p) => p.status === LiveParticipantStatus.DISCONNECTED,
        ).length,
      },
    };
  }

  private assertTeacher(ctx: OrgContext) {
    if (!TEACHER_ROLES.has(ctx.role)) {
      throw new ForbiddenException({
        code: 'CLASSROOM_TEACHER_REQUIRED',
        message: 'Hodinu může ovládat pouze učitel nebo vedení školy.',
      });
    }
  }

  private assertOwnedLessonSession(
    session: LessonSession | null,
    ctx: OrgContext,
  ): asserts session is LessonSession {
    if (
      !session ||
      session.organizationId !== ctx.organizationId ||
      session.sourceKind !== LiveSessionSourceKind.LESSON_EXPERIENCE ||
      !session.lessonExperienceVersion
    ) {
      throw new NotFoundException({
        code: 'CLASSROOM_SESSION_NOT_FOUND',
        message: 'Interaktivní hodina nebyla nalezena.',
      });
    }
    if (session.hostId !== ctx.membershipId) {
      throw new ForbiddenException({
        code: 'NOT_SESSION_HOST',
        message: 'Hodinu může ovládat jen učitel, který ji spustil.',
      });
    }
  }

  private assertParticipantSession(
    session:
      | {
          id: string;
          organizationId: string;
          sourceKind: LiveSessionSourceKind;
          status: LiveSessionStatus;
        }
      | null,
    ctx: OrgContext,
  ): asserts session is NonNullable<typeof session> {
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
    if (session.status === LiveSessionStatus.FINISHED) {
      throw new ConflictException({
        code: 'SESSION_FINISHED',
        message: 'Hodina už byla ukončena.',
      });
    }
  }

  private invalidTransition(command: string, status: LiveSessionStatus) {
    return new ConflictException({
      code: 'INVALID_SESSION_TRANSITION',
      message: `Příkaz ${command} není povolen ve stavu ${status}.`,
    });
  }

  private newJoinToken() {
    return randomBytes(32).toString('hex');
  }
}
