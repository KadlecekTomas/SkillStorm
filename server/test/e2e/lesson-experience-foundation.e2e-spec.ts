import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
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
  lessonPlatformActor,
  lessonPrimaryMapping,
  lessonSchoolActor,
  lessonVersionInput,
} from 'test/lesson-experience-fixtures';

describe('Lesson Experience D2-B foundation invariants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let lessons: LessonExperienceService;
  let activities: ActivityService;
  let curriculum: CurriculumService;
  let actorA: any;
  let actorB: any;
  let platform: any;
  let lessonId = '';
  let lessonVersionId = '';
  let activityId = '';
  let activityVersionId = '';
  let frameworkId = '';
  let releaseId = '';
  let outcomeId = '';
  let aspectId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    lessons = app.get(LessonExperienceService);
    activities = app.get(ActivityService);
    curriculum = app.get(CurriculumService);
    await prisma.$connect();

    const orgA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `lesson_a_${Date.now()}`,
    });
    const orgB = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `lesson_b_${Date.now()}`,
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
      `${Date.now()}`,
    );
    frameworkId = framework.frameworkId;
    releaseId = framework.releaseId;
    outcomeId = framework.outcomeId;
    aspectId = framework.aspectId;

    const activity = await createPublishedLessonActivity(
      activities,
      actorA,
      outcomeId,
      aspectId,
      `${Date.now()}`,
    );
    activityId = activity.activityId;
    activityVersionId = activity.activityVersionId;
  });

  afterAll(async () => {
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        if (lessonId) {
          await tx.lessonExperienceCurriculumMapping.deleteMany({
            where: { lessonExperienceVersion: { lessonExperienceId: lessonId } },
          });
          await tx.lessonStage.deleteMany({
            where: { lessonExperienceVersion: { lessonExperienceId: lessonId } },
          });
          await tx.lessonExperienceVersion.deleteMany({
            where: { lessonExperienceId: lessonId },
          });
          await tx.lessonExperience.deleteMany({ where: { id: lessonId } });
        }
        if (activityId) {
          await tx.activityCurriculumMapping.deleteMany({
            where: { activityVersion: { activityId } },
          });
          await tx.activityVersion.deleteMany({ where: { activityId } });
          await tx.activity.deleteMany({ where: { id: activityId } });
        }
        if (releaseId) {
          await tx.outcomeAspect.deleteMany({
            where: { frameworkOutcome: { frameworkReleaseId: releaseId } },
          });
          await tx.frameworkOutcome.deleteMany({ where: { frameworkReleaseId: releaseId } });
          await tx.frameworkField.deleteMany({ where: { frameworkReleaseId: releaseId } });
          await tx.frameworkArea.deleteMany({ where: { frameworkReleaseId: releaseId } });
          await tx.curriculumFrameworkRelease.deleteMany({ where: { id: releaseId } });
        }
        if (frameworkId) {
          await tx.curriculumFramework.deleteMany({ where: { id: frameworkId } });
        }
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a tenant-scoped Lesson Experience and conceals it cross-tenant', async () => {
    const lesson = await lessons.createOrganizationLesson(
      {
        slug: `data-detective-${Date.now()}`,
        title: 'Datová detektivka',
      },
      actorA,
    );
    lessonId = lesson.id;

    await expect(lessons.getLesson(lessonId, actorB)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('atomically creates and seals the full lesson snapshot', async () => {
    const version = await lessons.createVersion(
      lessonId,
      lessonVersionInput(activityVersionId),
      actorA,
    );
    lessonVersionId = version.id;

    expect(version.versionNo).toBe(1);
    expect(version.sealedAt).toBeTruthy();
    expect(version.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(version.stages).toHaveLength(6);
    expect(version.stages.map((stage) => stage.orderIndex)).toEqual([0, 1, 2, 3, 4, 5]);

    await expect(
      lessons.createVersion(
        lessonId,
        lessonVersionInput(activityVersionId),
        actorA,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('prevents stage and sealed-version tampering even through raw SQL', async () => {
    const stage = await prisma.lessonStage.findFirstOrThrow({
      where: { lessonExperienceVersionId: lessonVersionId },
      orderBy: { orderIndex: 'asc' },
    });

    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE lesson_stages SET title = $1 WHERE lesson_stage_id = $2::text',
        'Tampered stage',
        stage.id,
      ),
    ).rejects.toThrow(/LESSON_STAGE_IMMUTABLE/);

    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE lesson_experience_versions SET title = $1 WHERE lesson_experience_version_id = $2::text',
        'Tampered lesson',
        lessonVersionId,
      ),
    ).rejects.toThrow(/LESSON_EXPERIENCE_VERSION_CONTENT_IMMUTABLE/);

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO lesson_stages
          (lesson_stage_id, lesson_experience_version_id, stage_key, order_index, stage_type, title, duration_min, completion_type, checkpoint, required, teacher_intervention, created_at)
         VALUES ($1, $2, 'LATE_STAGE', 99, 'HOOK', 'Late stage', 1, 'MANUAL', false, true, false, CURRENT_TIMESTAMP)`,
        crypto.randomUUID(),
        lessonVersionId,
      ),
    ).rejects.toThrow(/LESSON_STAGE_PARENT_SEALED/);
  });

  it('requires reviewed curriculum provenance before publication', async () => {
    const mapping = await lessons.proposeMapping(
      lessonVersionId,
      lessonPrimaryMapping(outcomeId, aspectId),
      actorA,
    );

    await lessons.submitForReview(lessonVersionId, actorA);
    await expect(lessons.publish(lessonVersionId, actorA)).rejects.toMatchObject({
      status: 409,
    });

    const reviewed = await lessons.reviewMapping(
      mapping.id,
      {
        status: LessonExperienceCurriculumMappingStatus.APPROVED,
        rationale: 'Reviewed Lesson Experience coverage path.',
      },
      actorA,
    );
    expect(reviewed.status).toBe(LessonExperienceCurriculumMappingStatus.APPROVED);

    const published = await lessons.publish(lessonVersionId, actorA);
    expect(published.status).toBe('PUBLISHED');
  });

  it('freezes post-publication mapping changes and preserves retirement history', async () => {
    await expect(
      lessons.proposeMapping(
        lessonVersionId,
        lessonPrimaryMapping(outcomeId, aspectId),
        actorA,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const retired = await lessons.retire(lessonVersionId, actorA);
    expect(retired.status).toBe('RETIRED');

    await expect(
      prisma.$executeRawUnsafe(
        'DELETE FROM lesson_experience_versions WHERE lesson_experience_version_id = $1::text',
        lessonVersionId,
      ),
    ).rejects.toThrow(/LESSON_EXPERIENCE_VERSION_IMMUTABLE/);
  });
});
