import { ConflictException, INestApplication } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityCurriculumMappingStatus,
  ActivityVersionStatus,
  LessonExperienceCurriculumMappingStatus,
  LessonExperienceVersionStatus,
  MappingProposerType,
  SystemRole,
} from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { ContentPackPublisherService } from '@/content-packs/content-pack-publisher.service';
import { ContentPacksModule } from '@/content-packs/content-packs.module';
import type { UniversalContentPack } from '@/content-packs/content-pack.types';
import { grade6EncodingFoundationsPack } from '@/content-packs/informatics/grade-6/encoding-foundations.pack';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { PrismaService } from '@/prisma/prisma.service';

jest.setTimeout(60_000);

function clonePack(
  seed: string,
  frameworkCode: string,
): UniversalContentPack {
  const pack = JSON.parse(
    JSON.stringify(grade6EncodingFoundationsPack),
  ) as UniversalContentPack;
  pack.packId = `INF_G6_ENCODING_E2E_${seed}`;
  const activitySlugs = new Map<string, string>();

  for (const activity of pack.activities) {
    const original = activity.shell.slug;
    activity.shell.slug = `${original}-${seed}`;
    activitySlugs.set(original, activity.shell.slug);
    for (const ref of activity.curriculum) ref.frameworkCode = frameworkCode;
  }
  for (const lesson of pack.lessons) {
    lesson.shell.slug = `${lesson.shell.slug}-${seed}`;
    for (const ref of lesson.curriculum) ref.frameworkCode = frameworkCode;
    for (const stage of lesson.version.stages) {
      if (stage.activityRef) {
        stage.activityRef = activitySlugs.get(stage.activityRef)!;
      }
    }
  }
  return pack;
}

async function expectConflictCode(
  promise: Promise<unknown>,
  expectedCode: string,
) {
  try {
    await promise;
    throw new Error(`Expected conflict ${expectedCode}.`);
  } catch (error) {
    if (!(error instanceof ConflictException)) throw error;
    const payload = error.getResponse();
    expect(payload).toEqual(expect.objectContaining({ code: expectedCode }));
  }
}

describe('ContentPackPublisherService governance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let curriculum: CurriculumService;
  let publisher: ContentPackPublisherService;
  let actor: JwtPayload;
  let pack: UniversalContentPack;
  let frameworkCode: string;
  let releaseCode: string;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [ContentPacksModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    curriculum = app.get(CurriculumService);
    publisher = app.get(ContentPackPublisherService);
    await prisma.$connect();

    const seed = `${Date.now()}`;
    frameworkCode = `RVP-CONTENT-${seed}`;
    releaseCode = `verified-${seed}`;
    pack = clonePack(seed, frameworkCode);

    const user = await prisma.user.create({
      data: {
        email: `content.publisher.${seed}@example.test`,
        name: 'Content Publisher E2E',
        passwordHash: 'not-used-in-service-e2e',
        systemRole: SystemRole.SUPERADMIN,
      },
    });
    actor = {
      userId: user.id,
      email: user.email ?? undefined,
      systemRole: SystemRole.SUPERADMIN,
      isPlatformAdmin: true,
    };

    const framework = await curriculum.createFramework(
      {
        code: frameworkCode,
        jurisdiction: 'CZ',
        educationType: 'ZV',
        title: 'Content publisher E2E framework',
        authorityName: 'E2E',
      },
      actor,
    );
    const release = await curriculum.importFrameworkRelease(
      framework.code,
      {
        releaseCode,
        title: 'Verified content publisher release',
        sourceUrl: 'https://example.invalid/content-pack-e2e',
        sourceAuthority: 'E2E',
        areas: [
          {
            externalCode: 'INF',
            title: 'Informatika',
            sortOrder: 1,
            fields: [
              {
                externalCode: 'INF-DATA',
                title: 'Data, informace a modelování',
                sortOrder: 1,
                outcomes: [
                  {
                    externalCode: 'INF-INF-001-ZV9-002',
                    sourceAnchor: `publisher-${seed}-encoding`,
                    title: 'Žák porovnává způsoby kódování dat.',
                    nodeGrade: 9,
                  },
                ],
              },
            ],
          },
        ],
      },
      actor,
    );
    await curriculum.verifyFrameworkRelease(release.id, actor);
  });

  afterAll(async () => {
    await app.close();
  });

  it('dry-run resolves VERIFIED curriculum but writes no content', async () => {
    const report = await publisher.applyGlobalPack(pack, {
      actor,
      mode: 'DRY_RUN',
    });

    expect(report.resolvedFrameworks).toEqual([
      expect.objectContaining({ frameworkCode, releaseCode }),
    ]);
    expect(report.dryRun?.activities).toHaveLength(pack.activities.length);
    expect(report.dryRun?.lessons).toHaveLength(pack.lessons.length);
    expect(report.dryRun?.activities.every((item) => item.shellAction === 'CREATE')).toBe(true);

    const [activityCount, lessonCount] = await Promise.all([
      prisma.activity.count({
        where: { slug: { in: pack.activities.map((item) => item.shell.slug) } },
      }),
      prisma.lessonExperience.count({
        where: { slug: { in: pack.lessons.map((item) => item.shell.slug) } },
      }),
    ]);
    expect(activityCount).toBe(0);
    expect(lessonCount).toBe(0);
  });

  it('stage creates drafts with SYSTEM-proposed mappings and is idempotent', async () => {
    const first = await publisher.applyGlobalPack(pack, {
      actor,
      mode: 'STAGE',
    });
    expect(first.activities).toHaveLength(pack.activities.length);
    expect(first.lessons).toHaveLength(pack.lessons.length);
    expect(first.activities.every((item) => item.status === ActivityVersionStatus.DRAFT)).toBe(true);
    expect(first.lessons.every((item) => item.status === LessonExperienceVersionStatus.DRAFT)).toBe(true);

    const activityRows = await prisma.activity.findMany({
      where: { slug: { in: pack.activities.map((item) => item.shell.slug) } },
      include: {
        versions: { include: { curriculumMappings: true } },
      },
    });
    expect(activityRows).toHaveLength(pack.activities.length);
    for (const activity of activityRows) {
      expect(activity.versions).toHaveLength(1);
      expect(activity.versions[0]!.curriculumMappings).toEqual([
        expect.objectContaining({
          status: ActivityCurriculumMappingStatus.PROPOSED,
          proposedByType: MappingProposerType.SYSTEM,
        }),
      ]);
    }

    const lessonRows = await prisma.lessonExperience.findMany({
      where: { slug: { in: pack.lessons.map((item) => item.shell.slug) } },
      include: {
        versions: { include: { curriculumMappings: true, stages: true } },
      },
    });
    expect(lessonRows).toHaveLength(pack.lessons.length);
    for (const lesson of lessonRows) {
      expect(lesson.versions).toHaveLength(1);
      expect(lesson.versions[0]!.curriculumMappings).toEqual([
        expect.objectContaining({
          status: LessonExperienceCurriculumMappingStatus.PROPOSED,
          proposedByType: MappingProposerType.SYSTEM,
        }),
      ]);
      expect(lesson.versions[0]!.stages).toHaveLength(6);
    }

    const second = await publisher.applyGlobalPack(pack, {
      actor,
      mode: 'STAGE',
    });
    expect(second.activities.every((item) => item.versionAction === 'REUSE')).toBe(true);
    expect(second.lessons.every((item) => item.versionAction === 'REUSE')).toBe(true);

    const [activityVersionCount, lessonVersionCount] = await Promise.all([
      prisma.activityVersion.count({
        where: {
          activity: { slug: { in: pack.activities.map((item) => item.shell.slug) } },
        },
      }),
      prisma.lessonExperienceVersion.count({
        where: {
          lessonExperience: { slug: { in: pack.lessons.map((item) => item.shell.slug) } },
        },
      }),
    ]);
    expect(activityVersionCount).toBe(pack.activities.length);
    expect(lessonVersionCount).toBe(pack.lessons.length);
  });

  it('refuses publication while SYSTEM mappings still await explicit review', async () => {
    await expectConflictCode(
      publisher.applyGlobalPack(pack, {
        actor,
        mode: 'PUBLISH',
      }),
      'CONTENT_PACK_MAPPING_REVIEW_REQUIRED',
    );
  });

  it('explicit approval publishes activities first and then complete Lesson Experiences', async () => {
    const report = await publisher.applyGlobalPack(pack, {
      actor,
      mode: 'PUBLISH',
      approveProposedMappings: true,
    });

    expect(report.activities.every((item) => item.status === ActivityVersionStatus.PUBLISHED)).toBe(true);
    expect(report.lessons.every((item) => item.status === LessonExperienceVersionStatus.PUBLISHED)).toBe(true);

    const activityRows = await prisma.activity.findMany({
      where: { slug: { in: pack.activities.map((item) => item.shell.slug) } },
      include: { versions: { include: { curriculumMappings: true } } },
    });
    for (const activity of activityRows) {
      expect(activity.versions[0]!.status).toBe(ActivityVersionStatus.PUBLISHED);
      expect(activity.versions[0]!.curriculumMappings[0]!.status).toBe(
        ActivityCurriculumMappingStatus.APPROVED,
      );
    }

    const lessonRows = await prisma.lessonExperience.findMany({
      where: { slug: { in: pack.lessons.map((item) => item.shell.slug) } },
      include: { versions: { include: { curriculumMappings: true, stages: true } } },
    });
    for (const lesson of lessonRows) {
      expect(lesson.versions[0]!.status).toBe(
        LessonExperienceVersionStatus.PUBLISHED,
      );
      expect(lesson.versions[0]!.curriculumMappings[0]!.status).toBe(
        LessonExperienceCurriculumMappingStatus.APPROVED,
      );
      expect(
        lesson.versions[0]!.stages.filter((stage) => stage.activityVersionId)
          .length,
      ).toBeGreaterThan(0);
    }
  });

  it('re-running publish reuses the immutable published snapshots', async () => {
    const report = await publisher.applyGlobalPack(pack, {
      actor,
      mode: 'PUBLISH',
      approveProposedMappings: true,
    });
    expect(report.activities.every((item) => item.versionAction === 'REUSE')).toBe(true);
    expect(report.lessons.every((item) => item.versionAction === 'REUSE')).toBe(true);
  });

  it('fails closed when more than one VERIFIED framework release is possible', async () => {
    const second = await curriculum.importFrameworkRelease(
      frameworkCode,
      {
        releaseCode: `${releaseCode}-next`,
        title: 'Second verified release',
        sourceUrl: 'https://example.invalid/content-pack-e2e-v2',
        sourceAuthority: 'E2E',
        areas: [
          {
            externalCode: 'INF',
            title: 'Informatika',
            sortOrder: 1,
            fields: [
              {
                externalCode: 'INF-DATA',
                title: 'Data, informace a modelování',
                sortOrder: 1,
                outcomes: [
                  {
                    externalCode: 'INF-INF-001-ZV9-002',
                    sourceAnchor: `publisher-${Date.now()}-encoding-v2`,
                    title: 'Žák porovnává způsoby kódování dat v novém release.',
                    nodeGrade: 9,
                  },
                ],
              },
            ],
          },
        ],
      },
      actor,
    );
    await curriculum.verifyFrameworkRelease(second.id, actor);

    await expectConflictCode(
      publisher.applyGlobalPack(pack, { actor, mode: 'DRY_RUN' }),
      'CONTENT_PACK_FRAMEWORK_RELEASE_AMBIGUOUS',
    );

    const explicit = await publisher.applyGlobalPack(pack, {
      actor,
      mode: 'DRY_RUN',
      frameworkReleaseCodes: { [frameworkCode]: releaseCode },
    });
    expect(explicit.resolvedFrameworks[0]!.releaseCode).toBe(releaseCode);
  });
});
