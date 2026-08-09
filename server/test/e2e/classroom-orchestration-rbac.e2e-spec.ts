import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  LessonExperienceCurriculumMappingStatus,
  LiveSessionCommandType,
  LiveSessionMode,
  MappingProposerType,
  OrganizationStatus,
  SchoolGrade,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { ActivityService } from '@/activity-engine/activity.service';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { HttpExceptionFilter } from '@/infra/http-exception.filter';
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

describe('D2-C Classroom Orchestration HTTP governance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let curriculum: CurriculumService;
  let activities: ActivityService;
  let lessons: LessonExperienceService;

  let teacherToken = '';
  let managerToken = '';
  let studentToken = '';
  let foreignTeacherToken = '';
  let lessonVersionId = '';
  let sessionId = '';

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const payload = (response: request.Response) => response.body?.data ?? response.body;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    curriculum = app.get(CurriculumService);
    activities = app.get(ActivityService);
    lessons = app.get(LessonExperienceService);
    await prisma.$connect();

    const seed = `${Date.now()}`;
    const ctx = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `classroom_http_${seed}`,
      with: { student: true },
    });
    const foreign = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `classroom_http_foreign_${seed}`,
    });

    await prisma.organization.updateMany({
      where: { id: { in: [ctx.organization.id, foreign.organization.id] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    // Classroom routes are EXECUTION operations. Exercise them only after the
    // fixture satisfies the same R2 school-readiness contract as production.
    const [currentYear, foreignCurrentYear] = await Promise.all([
      prisma.academicYear.findFirst({
        where: { orgId: ctx.organization.id, isCurrent: true },
        select: { id: true },
      }),
      prisma.academicYear.findFirst({
        where: { orgId: foreign.organization.id, isCurrent: true },
        select: { id: true },
      }),
    ]);
    if (!currentYear || !foreignCurrentYear) {
      throw new Error('Classroom HTTP fixture is missing a current academic year.');
    }
    await prisma.classSection.createMany({
      data: [
        {
          orgId: ctx.organization.id,
          yearId: currentYear.id,
          grade: SchoolGrade.GRADE_7,
          section: 'H',
        },
        {
          orgId: foreign.organization.id,
          yearId: foreignCurrentYear.id,
          grade: SchoolGrade.GRADE_7,
          section: 'F',
        },
      ],
    });

    teacherToken = ctx.actor.accessToken;
    managerToken = ctx.owner.accessToken;
    studentToken = ctx.student!.accessToken;
    foreignTeacherToken = foreign.actor.accessToken;

    const platform = lessonPlatformActor(ctx);
    const author = lessonSchoolActor(ctx);
    const framework = await createLessonFrameworkFixture(
      curriculum,
      platform,
      `CLASSROOM-HTTP-${seed}`,
    );

    const activity = await activities.createOrganizationActivity(
      {
        slug: `classroom-http-activity-${seed}`,
        title: 'D2-C HTTP Activity',
      },
      author,
    );
    const activityInput = lessonActivityVersionInput('D2-C HTTP Activity');
    activityInput.supportedModes = [...ALL_MODES];
    activityInput.recommendedMode = ActivityDeliveryMode.DEVICES;
    activityInput.modePolicy = Object.fromEntries(
      ALL_MODES.map((mode) => [
        mode,
        {
          preservesObjective: true,
          evidenceEquivalent: true,
          fallback: `HTTP fixture fallback for ${mode}`,
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
        rationale: 'HTTP fixture directly supports the mapped aspect.',
        proposedByType: MappingProposerType.HUMAN,
      },
      author,
    );
    await activities.submitForReview(activityVersion.id, author);
    await activities.reviewMapping(
      activityMapping.id,
      {
        status: ActivityCurriculumMappingStatus.APPROVED,
        rationale: 'Approved D2-C HTTP Activity fixture mapping.',
      },
      author,
    );
    await activities.publish(activityVersion.id, author);

    const lesson = await lessons.createOrganizationLesson(
      {
        slug: `classroom-http-lesson-${seed}`,
        title: 'D2-C HTTP Lesson',
      },
      author,
    );
    const lessonInput = lessonVersionInput(activityVersion.id, 'D2-C HTTP Lesson');
    lessonInput.supportedModes = [...ALL_MODES];
    lessonInput.recommendedMode = ActivityDeliveryMode.DEVICES;
    const lessonVersion = await lessons.createVersion(lesson.id, lessonInput, author);
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
        rationale: 'Approved D2-C HTTP Lesson fixture mapping.',
      },
      author,
    );
    const published = await lessons.publish(lessonVersion.id, author);
    lessonVersionId = published.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('blocks students from creating or controlling teacher sessions', async () => {
    await api()
      .post('/classroom-sessions')
      .set('Authorization', auth(studentToken))
      .send({
        lessonExperienceVersionId: lessonVersionId,
        mode: LiveSessionMode.DEVICES,
      })
      .expect(403);

    const created = await api()
      .post('/classroom-sessions')
      .set('Authorization', auth(teacherToken))
      .send({
        lessonExperienceVersionId: lessonVersionId,
        mode: LiveSessionMode.DEVICES,
      })
      .expect(201);

    sessionId = payload(created).id;
    expect(sessionId).toEqual(expect.any(String));

    await api()
      .post(`/classroom-sessions/${sessionId}/commands`)
      .set('Authorization', auth(studentToken))
      .send({
        commandId: 'student-command-forbidden',
        type: LiveSessionCommandType.START,
        expectedRevision: 0,
      })
      .expect(403);

    await api()
      .get(`/classroom-sessions/${sessionId}`)
      .set('Authorization', auth(studentToken))
      .expect(403);
  });

  it('conceals a Lesson session from another tenant', async () => {
    await api()
      .get(`/classroom-sessions/${sessionId}`)
      .set('Authorization', auth(foreignTeacherToken))
      .expect(404);
  });

  it('keeps student join/event routes student-only', async () => {
    await api()
      .post(`/classroom-sessions/${sessionId}/join`)
      .set('Authorization', auth(teacherToken))
      .send({ nickname: 'Teacher must not join as pupil' })
      .expect(403);

    await api()
      .post(`/classroom-sessions/${sessionId}/events`)
      .set('Authorization', auth(teacherToken))
      .send({
        eventId: 'teacher-event-forbidden',
        stageId: '00000000-0000-4000-8000-000000000000',
        eventType: 'PREDICTION_SUBMITTED',
        payload: { choice: 'A' },
        occurredAt: new Date().toISOString(),
      })
      .expect(403);

    await api()
      .get(`/classroom-sessions/${sessionId}/me`)
      .set('Authorization', auth(teacherToken))
      .expect(403);
  });

  it('lets the actual student join while leadership cannot steal host control', async () => {
    await api()
      .post(`/classroom-sessions/${sessionId}/join`)
      .set('Authorization', auth(studentToken))
      .send({ nickname: 'HTTP Student' })
      .expect(201);

    const started = await api()
      .post(`/classroom-sessions/${sessionId}/commands`)
      .set('Authorization', auth(managerToken))
      .send({
        commandId: 'manager-start-http-0001',
        type: LiveSessionCommandType.START,
        expectedRevision: 0,
      });

    // Leadership has route permission, but host ownership remains a separate
    // runtime invariant. A director/owner must not silently steal a live lesson.
    expect(started.status).toBe(403);

    await api()
      .post(`/classroom-sessions/${sessionId}/commands`)
      .set('Authorization', auth(teacherToken))
      .send({
        commandId: 'teacher-start-http-0001',
        type: LiveSessionCommandType.START,
        expectedRevision: 0,
      })
      .expect(201);
  });
});
