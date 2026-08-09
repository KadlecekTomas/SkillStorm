import { INestApplication } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import { OrganizationStatus } from '@prisma/client';
import { AppModule } from '@/app.module';
import { ActivityService } from '@/activity-engine/activity.service';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { LessonExperienceService } from '@/lesson-experience/lesson-experience.service';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';
import {
  createLessonFrameworkFixture,
  createPublishedLessonActivity,
  lessonPlatformActor,
  lessonSchoolActor,
  lessonVersionInput,
} from 'test/lesson-experience-fixtures';

describe('Lesson Experience D2-B concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lessons: LessonExperienceService;
  let actor: any;
  let lessonId = '';
  let activityId = '';
  let activityVersionId = '';
  let frameworkId = '';
  let releaseId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    lessons = app.get(LessonExperienceService);
    const activities = app.get(ActivityService);
    const curriculum = app.get(CurriculumService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `lesson_race_${Date.now()}`,
    });
    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    actor = lessonSchoolActor(ctx);
    const platform = lessonPlatformActor(ctx);

    const framework = await createLessonFrameworkFixture(
      curriculum,
      platform,
      `RACE-${Date.now()}`,
    );
    frameworkId = framework.frameworkId;
    releaseId = framework.releaseId;

    const activity = await createPublishedLessonActivity(
      activities,
      actor,
      framework.outcomeId,
      framework.aspectId,
      `race-${Date.now()}`,
    );
    activityId = activity.activityId;
    activityVersionId = activity.activityVersionId;

    const lesson = await lessons.createOrganizationLesson(
      {
        slug: `lesson-race-${Date.now()}`,
        title: 'Lesson race fixture',
      },
      actor,
    );
    lessonId = lesson.id;
  });

  afterAll(async () => {
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        await tx.lessonExperienceCurriculumMapping.deleteMany({
          where: { lessonExperienceVersion: { lessonExperienceId: lessonId } },
        });
        await tx.lessonStage.deleteMany({
          where: { lessonExperienceVersion: { lessonExperienceId: lessonId } },
        });
        await tx.lessonExperienceVersion.deleteMany({ where: { lessonExperienceId: lessonId } });
        await tx.lessonExperience.deleteMany({ where: { id: lessonId } });
        await tx.activityCurriculumMapping.deleteMany({
          where: { activityVersion: { activityId } },
        });
        await tx.activityVersion.deleteMany({ where: { activityId } });
        await tx.activity.deleteMany({ where: { id: activityId } });
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

  it('treats stage-array input order as irrelevant when orderIndex is identical', async () => {
    const first = await lessons.createVersion(
      lessonId,
      lessonVersionInput(activityVersionId, 'Base lesson'),
      actor,
    );
    expect(first.versionNo).toBe(1);

    const reordered = lessonVersionInput(activityVersionId, 'Base lesson');
    reordered.stages = [...reordered.stages].reverse();
    await expect(
      lessons.createVersion(lessonId, reordered, actor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('serializes distinct concurrent lesson versions without version-number collision', async () => {
    const [left, right] = await Promise.all([
      lessons.createVersion(
        lessonId,
        lessonVersionInput(activityVersionId, 'Concurrent lesson A'),
        actor,
      ),
      lessons.createVersion(
        lessonId,
        lessonVersionInput(activityVersionId, 'Concurrent lesson B'),
        actor,
      ),
    ]);

    expect([left.versionNo, right.versionNo].sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('turns simultaneous identical lesson snapshots into one success and one controlled 409', async () => {
    const results = await Promise.allSettled([
      lessons.createVersion(
        lessonId,
        lessonVersionInput(activityVersionId, 'Identical lesson race'),
        actor,
      ),
      lessons.createVersion(
        lessonId,
        lessonVersionInput(activityVersionId, 'Identical lesson race'),
        actor,
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ status: 409 });
  });
});
