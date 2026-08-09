import { INestApplication } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityDeliveryMode,
  LessonExperienceCurriculumMappingStatus,
  OrganizationStatus,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { ActivityService } from '@/activity-engine/activity.service';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { LessonExperienceService } from '@/lesson-experience/lesson-experience.service';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import {
  createLessonFrameworkFixture,
  createPublishedLessonActivity,
  lessonActivityVersionInput,
  lessonPlatformActor,
  lessonPrimaryMapping,
  lessonSchoolActor,
  lessonVersionInput,
} from 'test/lesson-experience-fixtures';

describe('Lesson Experience D2-B Activity compatibility (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lessons: LessonExperienceService;
  let activities: ActivityService;
  let actorA: any;
  let actorB: any;
  let platform: any;
  let organizationALessonIds: string[] = [];
  let globalLessonId = '';
  let activityIds: string[] = [];
  let publishedActivityVersionId = '';
  let draftActivityVersionId = '';
  let foreignActivityVersionId = '';
  let frameworkId = '';
  let releaseId = '';
  let outcomeId = '';
  let aspectId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    lessons = app.get(LessonExperienceService);
    activities = app.get(ActivityService);
    const curriculum = app.get(CurriculumService);
    await prisma.$connect();

    const orgA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `lesson_compat_a_${Date.now()}`,
    });
    const orgB = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `lesson_compat_b_${Date.now()}`,
    });
    await prisma.organization.updateMany({
      where: { id: { in: [orgA.organization.id, orgB.organization.id] } },
      data: { status: OrganizationStatus.ACTIVE },
    });
    actorA = lessonSchoolActor(orgA);
    actorB = lessonSchoolActor(orgB);
    platform = lessonPlatformActor(orgA);

    const framework = await createLessonFrameworkFixture(
      curriculum,
      platform,
      `COMPAT-${Date.now()}`,
    );
    frameworkId = framework.frameworkId;
    releaseId = framework.releaseId;
    outcomeId = framework.outcomeId;
    aspectId = framework.aspectId;

    const published = await createPublishedLessonActivity(
      activities,
      actorA,
      outcomeId,
      aspectId,
      `compat-published-${Date.now()}`,
    );
    activityIds.push(published.activityId);
    publishedActivityVersionId = published.activityVersionId;

    const draftActivity = await activities.createOrganizationActivity(
      {
        slug: `lesson-draft-activity-${Date.now()}`,
        title: 'Draft Activity fixture',
      },
      actorA,
    );
    activityIds.push(draftActivity.id);
    const draftVersion = await activities.createVersion(
      draftActivity.id,
      lessonActivityVersionInput('Draft Activity version'),
      actorA,
    );
    draftActivityVersionId = draftVersion.id;

    const foreignActivity = await activities.createOrganizationActivity(
      {
        slug: `lesson-foreign-activity-${Date.now()}`,
        title: 'Foreign Activity fixture',
      },
      actorB,
    );
    activityIds.push(foreignActivity.id);
    const foreignVersion = await activities.createVersion(
      foreignActivity.id,
      lessonActivityVersionInput('Foreign Activity version'),
      actorB,
    );
    foreignActivityVersionId = foreignVersion.id;
  });

  afterAll(async () => {
    const lessonIds = [...organizationALessonIds, globalLessonId].filter(Boolean);
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        if (lessonIds.length) {
          await tx.lessonExperienceCurriculumMapping.deleteMany({
            where: { lessonExperienceVersion: { lessonExperienceId: { in: lessonIds } } },
          });
          await tx.lessonStage.deleteMany({
            where: { lessonExperienceVersion: { lessonExperienceId: { in: lessonIds } } },
          });
          await tx.lessonExperienceVersion.deleteMany({
            where: { lessonExperienceId: { in: lessonIds } },
          });
          await tx.lessonExperience.deleteMany({ where: { id: { in: lessonIds } } });
        }
        await tx.activityCurriculumMapping.deleteMany({
          where: { activityVersion: { activityId: { in: activityIds } } },
        });
        await tx.activityVersion.deleteMany({ where: { activityId: { in: activityIds } } });
        await tx.activity.deleteMany({ where: { id: { in: activityIds } } });
        await tx.outcomeAspect.deleteMany({
          where: { frameworkOutcome: { frameworkReleaseId: releaseId } },
        });
        await tx.frameworkOutcome.deleteMany({ where: { frameworkReleaseId: releaseId } });
        await tx.frameworkField.deleteMany({ where: { frameworkReleaseId: releaseId } });
        await tx.frameworkArea.deleteMany({ where: { frameworkReleaseId: releaseId } });
        await tx.curriculumFrameworkRelease.deleteMany({ where: { id: releaseId } });
        await tx.curriculumFramework.deleteMany({ where: { id: frameworkId } });
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  async function createLocalLesson(title: string) {
    const lesson = await lessons.createOrganizationLesson(
      {
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        title,
      },
      actorA,
    );
    organizationALessonIds.push(lesson.id);
    return lesson;
  }

  it('rejects a lesson mode that any referenced ActivityVersion cannot support', async () => {
    const lesson = await createLocalLesson('Mode mismatch');
    const input = lessonVersionInput(publishedActivityVersionId, 'Mode mismatch');
    input.supportedModes = [
      ActivityDeliveryMode.BOARD_ONLY,
      ActivityDeliveryMode.DEVICES,
    ];

    await expect(lessons.createVersion(lesson.id, input, actorA)).rejects.toMatchObject({
      status: 409,
    });
  });

  it('conceals a foreign-tenant ActivityVersion during lesson authoring', async () => {
    const lesson = await createLocalLesson('Foreign Activity');
    await expect(
      lessons.createVersion(
        lesson.id,
        lessonVersionInput(foreignActivityVersionId, 'Foreign Activity'),
        actorA,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects organization-local content inside a global Lesson Experience', async () => {
    const lesson = await lessons.createGlobalLesson(
      {
        slug: `global-scope-mismatch-${Date.now()}`,
        title: 'Global scope mismatch',
      },
      platform,
    );
    globalLessonId = lesson.id;

    await expect(
      lessons.createVersion(
        lesson.id,
        lessonVersionInput(publishedActivityVersionId, 'Global scope mismatch'),
        platform,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows coordinated draft authoring but blocks lesson publication until ActivityVersion is published', async () => {
    const lesson = await createLocalLesson('Draft dependency');
    const version = await lessons.createVersion(
      lesson.id,
      lessonVersionInput(draftActivityVersionId, 'Draft dependency'),
      actorA,
    );
    const mapping = await lessons.proposeMapping(
      version.id,
      lessonPrimaryMapping(outcomeId, aspectId),
      actorA,
    );
    await lessons.submitForReview(version.id, actorA);
    await lessons.reviewMapping(
      mapping.id,
      {
        status: LessonExperienceCurriculumMappingStatus.APPROVED,
        rationale: 'Lesson mapping is valid, Activity dependency is not released yet.',
      },
      actorA,
    );

    await expect(lessons.publish(version.id, actorA)).rejects.toMatchObject({
      status: 409,
    });
  });
});
