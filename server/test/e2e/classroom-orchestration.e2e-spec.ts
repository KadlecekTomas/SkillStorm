import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  LessonExperienceCurriculumMappingStatus,
  LiveSessionCommandType,
  LiveSessionMode,
  LiveSessionStatus,
  MappingProposerType,
  OrganizationRole,
  OrganizationStatus,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { ActivityService } from '@/activity-engine/activity.service';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { ClassroomOrchestrationService } from '@/classroom-orchestration/classroom-orchestration.service';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { LessonExperienceService } from '@/lesson-experience/lesson-experience.service';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import {
  createLessonFrameworkFixture,
  lessonActivityVersionInput,
  lessonPlatformActor,
  lessonPrimaryMapping,
  lessonSchoolActor,
  lessonVersionInput,
} from 'test/lesson-experience-fixtures';

const ALL_MODES = [
  ActivityDeliveryMode.BOARD_ONLY,
  ActivityDeliveryMode.SHARED_DEVICES,
  ActivityDeliveryMode.DEVICES,
  ActivityDeliveryMode.HYBRID,
];

function orgContext(
  organizationId: string,
  membershipId: string,
  role: OrganizationRole,
): OrgContext {
  return {
    organizationId,
    membershipId,
    role,
    activeAcademicYearId: null,
    isAcademicYearExpired: false,
  };
}

describe('D2-C classroom orchestration foundation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let curriculum: CurriculumService;
  let activities: ActivityService;
  let lessons: LessonExperienceService;
  let classroom: ClassroomOrchestrationService;

  let organizationId = '';
  let teacherCtx: OrgContext;
  let foreignTeacherCtx: OrgContext;
  let publishedLessonVersionId = '';
  let studentContexts: OrgContext[] = [];

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    curriculum = app.get(CurriculumService);
    activities = app.get(ActivityService);
    lessons = app.get(LessonExperienceService);
    classroom = app.get(ClassroomOrchestrationService);
    await prisma.$connect();

    const seed = `${Date.now()}`;
    const primary = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `classroom_${seed}`,
    });
    const foreign = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `classroom_foreign_${seed}`,
    });

    await prisma.organization.updateMany({
      where: { id: { in: [primary.organization.id, foreign.organization.id] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    organizationId = primary.organization.id;
    teacherCtx = orgContext(
      organizationId,
      primary.owner.membership.id,
      OrganizationRole.DIRECTOR,
    );
    foreignTeacherCtx = orgContext(
      foreign.organization.id,
      foreign.owner.membership.id,
      OrganizationRole.DIRECTOR,
    );

    const platform = lessonPlatformActor(primary);
    const author = lessonSchoolActor(primary);
    const framework = await createLessonFrameworkFixture(
      curriculum,
      platform,
      `CLASSROOM-${seed}`,
    );

    const activity = await activities.createOrganizationActivity(
      {
        slug: `classroom-multimode-${seed}`,
        title: 'D2-C multimode Activity',
      },
      author,
    );
    const activityInput = lessonActivityVersionInput('D2-C multimode Activity');
    activityInput.supportedModes = [...ALL_MODES];
    activityInput.recommendedMode = ActivityDeliveryMode.DEVICES;
    activityInput.modePolicy = Object.fromEntries(
      ALL_MODES.map((mode) => [
        mode,
        {
          preservesObjective: true,
          evidenceEquivalent: true,
          fallback: `Fallback for ${mode}`,
        },
      ]),
    );
    const activityVersion = await activities.createVersion(
      activity.id,
      activityInput,
      author,
    );
    const activityMapping = await activities.proposeMapping(
      activityVersion.id,
      {
        frameworkOutcomeId: framework.outcomeId,
        outcomeAspectId: framework.aspectId,
        mappingType: ActivityCurriculumMappingType.PRIMARY,
        rationale: 'D2-C fixture directly exercises the mapped outcome aspect.',
        proposedByType: MappingProposerType.HUMAN,
      },
      author,
    );
    await activities.submitForReview(activityVersion.id, author);
    await activities.reviewMapping(
      activityMapping.id,
      {
        status: ActivityCurriculumMappingStatus.APPROVED,
        rationale: 'Approved D2-C Activity fixture mapping.',
      },
      author,
    );
    await activities.publish(activityVersion.id, author);

    const lesson = await lessons.createOrganizationLesson(
      {
        slug: `classroom-lesson-${seed}`,
        title: 'D2-C Classroom Simulation',
      },
      author,
    );
    const lessonInput = lessonVersionInput(
      activityVersion.id,
      'D2-C Classroom Simulation',
    );
    lessonInput.supportedModes = [...ALL_MODES];
    lessonInput.recommendedMode = ActivityDeliveryMode.DEVICES;
    const lessonVersion = await lessons.createVersion(
      lesson.id,
      lessonInput,
      author,
    );
    const lessonMapping = await lessons.proposeMapping(
      lessonVersion.id,
      lessonPrimaryMapping(framework.outcomeId, framework.aspectId),
      author,
    );
    await lessons.submitForReview(lessonVersion.id, author);
    await lessons.reviewMapping(
      lessonMapping.id,
      {
        status: LessonExperienceCurriculumMappingStatus.APPROVED,
        rationale: 'Approved D2-C Lesson Experience fixture mapping.',
      },
      author,
    );
    const published = await lessons.publish(lessonVersion.id, author);
    publishedLessonVersionId = published.id;

    const students = await Promise.all(
      Array.from({ length: 30 }, async (_, index) => {
        const suffix = `${seed}_${index}`;
        const user = await prisma.user.create({
          data: {
            email: `classroom.student.${suffix}@example.test`,
            username: `classroom_student_${suffix}`,
            passwordHash: 'not-used-by-service-level-e2e',
            name: `D2-C Student ${index + 1}`,
          },
          select: { id: true },
        });
        const membership = await prisma.membership.create({
          data: {
            userId: user.id,
            organizationId,
            role: OrganizationRole.STUDENT,
          },
          select: { id: true },
        });
        return orgContext(organizationId, membership.id, OrganizationRole.STUDENT);
      }),
    );
    studentContexts = students;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('runs 30 participants through idempotent events, reconnect, pause/resume and finish', async () => {
    const created = await classroom.createLessonSession(
      {
        lessonExperienceVersionId: publishedLessonVersionId,
        mode: LiveSessionMode.DEVICES,
      },
      teacherCtx,
    );
    expect(created.status).toBe(LiveSessionStatus.DRAFT);
    expect(created.stateRevision).toBe(0);

    await Promise.all(
      studentContexts.map((studentCtx, index) =>
        classroom.joinAsStudent(
          created.id,
          { nickname: `Žák ${index + 1}` },
          studentCtx,
        ),
      ),
    );
    expect(
      await prisma.liveSessionParticipant.count({ where: { sessionId: created.id } }),
    ).toBe(30);

    const started = await classroom.command(
      created.id,
      {
        commandId: 'd2c-start-0001',
        type: LiveSessionCommandType.START,
        expectedRevision: 0,
      },
      teacherCtx,
    );
    expect(started.replayed).toBe(false);
    expect(started.session.status).toBe(LiveSessionStatus.RUNNING);
    expect(started.session.stateRevision).toBe(1);
    expect(started.session.lesson.stages[0]?.stageKey).toBe('HOOK');
    expect(started.session.currentLessonStageId).toBe(
      started.session.lesson.stages[0]?.id,
    );

    const replayedStart = await classroom.command(
      created.id,
      {
        commandId: 'd2c-start-0001',
        type: LiveSessionCommandType.START,
        expectedRevision: 0,
      },
      teacherCtx,
    );
    expect(replayedStart.replayed).toBe(true);
    expect(replayedStart.session.stateRevision).toBe(1);
    expect(
      await prisma.liveSessionCommand.count({ where: { sessionId: created.id } }),
    ).toBe(1);

    const next = await classroom.command(
      created.id,
      {
        commandId: 'd2c-next-0001',
        type: LiveSessionCommandType.NEXT_STAGE,
        expectedRevision: 1,
      },
      teacherCtx,
    );
    expect(next.session.stateRevision).toBe(2);
    expect(next.session.lesson.stages[1]?.stageKey).toBe('PREDICT');
    const predictionStageId = next.session.currentLessonStageId;
    expect(predictionStageId).toBe(next.session.lesson.stages[1]?.id);

    const firstEventIds = studentContexts.map(
      (_, index) => `d2c-prediction-${String(index + 1).padStart(3, '0')}`,
    );
    const eventResults = await Promise.all(
      studentContexts.map((studentCtx, index) =>
        classroom.recordSemanticEvent(
          created.id,
          {
            eventId: firstEventIds[index]!,
            stageId: predictionStageId!,
            eventType: 'PREDICTION_SUBMITTED',
            payload: {
              choice: index % 2 === 0 ? 'A' : 'B',
              reason: `Model ${index + 1}`,
            },
            occurredAt: new Date().toISOString(),
          },
          studentCtx,
        ),
      ),
    );
    expect(eventResults.every((result) => result.replayed === false)).toBe(true);
    expect(
      await prisma.liveSemanticEvent.count({ where: { sessionId: created.id } }),
    ).toBe(30);
    expect(
      await prisma.liveLearningEvidence.count({ where: { sessionId: created.id } }),
    ).toBe(30);

    await Promise.all(
      studentContexts.slice(0, 10).map((studentCtx) =>
        classroom.disconnectStudent(created.id, studentCtx),
      ),
    );
    expect(
      await prisma.liveSessionParticipant.count({
        where: { sessionId: created.id, status: 'DISCONNECTED' },
      }),
    ).toBe(10);

    await Promise.all(
      studentContexts.slice(0, 10).map((studentCtx, index) =>
        classroom.joinAsStudent(
          created.id,
          { nickname: `Reconnect ${index + 1}` },
          studentCtx,
        ),
      ),
    );
    expect(
      await prisma.liveSessionParticipant.count({
        where: { sessionId: created.id, status: 'CONNECTED' },
      }),
    ).toBe(30);

    const retried = await Promise.all(
      studentContexts.slice(0, 10).map((studentCtx, index) =>
        classroom.recordSemanticEvent(
          created.id,
          {
            eventId: firstEventIds[index]!,
            stageId: predictionStageId!,
            eventType: 'PREDICTION_SUBMITTED',
            payload: {
              choice: index % 2 === 0 ? 'A' : 'B',
              reason: `Retry ${index + 1}`,
            },
            occurredAt: new Date().toISOString(),
          },
          studentCtx,
        ),
      ),
    );
    expect(retried.every((result) => result.replayed === true)).toBe(true);
    expect(
      await prisma.liveSemanticEvent.count({ where: { sessionId: created.id } }),
    ).toBe(30);
    expect(
      await prisma.liveLearningEvidence.count({ where: { sessionId: created.id } }),
    ).toBe(30);

    await expect(
      classroom.command(
        created.id,
        {
          commandId: 'd2c-stale-pause',
          type: LiveSessionCommandType.PAUSE,
          expectedRevision: 1,
        },
        teacherCtx,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const paused = await classroom.command(
      created.id,
      {
        commandId: 'd2c-pause-0001',
        type: LiveSessionCommandType.PAUSE,
        expectedRevision: 2,
      },
      teacherCtx,
    );
    expect(paused.session.status).toBe(LiveSessionStatus.PAUSED);
    expect(paused.session.stateRevision).toBe(3);

    await expect(
      classroom.recordSemanticEvent(
        created.id,
        {
          eventId: 'd2c-paused-event',
          stageId: predictionStageId!,
          eventType: 'CHECKPOINT_COMPLETED',
          payload: { checkpoint: true },
          occurredAt: new Date().toISOString(),
        },
        studentContexts[0]!,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const resumed = await classroom.command(
      created.id,
      {
        commandId: 'd2c-resume-0001',
        type: LiveSessionCommandType.RESUME,
        expectedRevision: 3,
      },
      teacherCtx,
    );
    expect(resumed.session.status).toBe(LiveSessionStatus.RUNNING);
    expect(resumed.session.stateRevision).toBe(4);

    const finished = await classroom.command(
      created.id,
      {
        commandId: 'd2c-finish-0001',
        type: LiveSessionCommandType.FINISH,
        expectedRevision: 4,
      },
      teacherCtx,
    );
    expect(finished.session.status).toBe(LiveSessionStatus.FINISHED);
    expect(finished.session.stateRevision).toBe(5);
    expect(
      await prisma.liveSessionCommand.count({ where: { sessionId: created.id } }),
    ).toBe(5);

    const command = await prisma.liveSessionCommand.findFirstOrThrow({
      where: { sessionId: created.id },
    });
    const event = await prisma.liveSemanticEvent.findFirstOrThrow({
      where: { sessionId: created.id },
    });
    const evidence = await prisma.liveLearningEvidence.findFirstOrThrow({
      where: { sessionId: created.id },
    });

    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE live_session_commands SET resulting_revision = resulting_revision + 1 WHERE live_session_command_id = $1::text',
        command.id,
      ),
    ).rejects.toThrow(/LIVE_ORCHESTRATION_HISTORY_IMMUTABLE/);
    await expect(
      prisma.$executeRawUnsafe(
        'DELETE FROM live_semantic_events WHERE live_semantic_event_id = $1::text',
        event.id,
      ),
    ).rejects.toThrow(/LIVE_ORCHESTRATION_HISTORY_IMMUTABLE/);
    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE live_learning_evidence SET evidence_type = $1 WHERE live_learning_evidence_id = $2::text',
        'TAMPERED',
        evidence.id,
      ),
    ).rejects.toThrow(/LIVE_ORCHESTRATION_HISTORY_IMMUTABLE/);
  });

  it('keeps BOARD_ONLY free of per-pupil participant rows', async () => {
    const session = await classroom.createLessonSession(
      {
        lessonExperienceVersionId: publishedLessonVersionId,
        mode: LiveSessionMode.BOARD_ONLY,
      },
      teacherCtx,
    );

    await expect(
      classroom.joinAsStudent(
        session.id,
        { nickname: 'Nemá vzniknout' },
        studentContexts[0]!,
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(
      await prisma.liveSessionParticipant.count({ where: { sessionId: session.id } }),
    ).toBe(0);
  });

  it('provisions SHARED_DEVICES as group-device identities without pupil identities', async () => {
    const session = await classroom.createLessonSession(
      {
        lessonExperienceVersionId: publishedLessonVersionId,
        mode: LiveSessionMode.SHARED_DEVICES,
      },
      teacherCtx,
    );
    const groups = await classroom.createSharedDeviceGroups(
      session.id,
      { labels: ['Tým 1', 'Tým 2', 'Tým 3', 'Tým 4', 'Tým 5', 'Tým 6'] },
      teacherCtx,
    );

    expect(groups).toHaveLength(6);
    expect(new Set(groups.map((group) => group.joinToken)).size).toBe(6);
    expect(groups.every((group) => /^[a-f0-9]{64}$/.test(group.joinToken))).toBe(true);

    const participants = await prisma.liveSessionParticipant.findMany({
      where: { sessionId: session.id },
      select: { membershipId: true, groupId: true, status: true },
    });
    expect(participants).toHaveLength(6);
    expect(participants.every((participant) => participant.membershipId === null)).toBe(true);
    expect(participants.every((participant) => participant.groupId !== null)).toBe(true);
    expect(participants.every((participant) => participant.status === 'DISCONNECTED')).toBe(true);
  });

  it('conceals an organization lesson session from a foreign tenant', async () => {
    const session = await classroom.createLessonSession(
      {
        lessonExperienceVersionId: publishedLessonVersionId,
        mode: LiveSessionMode.DEVICES,
      },
      teacherCtx,
    );

    await expect(
      classroom.getTeacherProjection(session.id, foreignTeacherCtx),
    ).rejects.toMatchObject({ status: 404 });
  });
});
