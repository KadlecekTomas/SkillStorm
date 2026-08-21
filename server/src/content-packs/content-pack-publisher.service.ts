import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityVersionStatus,
  CurriculumFrameworkReleaseStatus,
  LessonExperienceCurriculumMappingStatus,
  LessonExperienceCurriculumMappingType,
  LessonExperienceVersionStatus,
  MappingProposerType,
  SystemRole,
} from '@prisma/client';
import { ActivityService } from '@/activity-engine/activity.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { LessonExperienceService } from '@/lesson-experience/lesson-experience.service';
import type { CreateLessonExperienceVersionDto } from '@/lesson-experience/dto/lesson-experience.dto';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  CurriculumOutcomeRef,
  UniversalActivitySpec,
  UniversalContentPack,
  UniversalLessonSpec,
} from './content-pack.types';

export type ContentPackPublishMode = 'DRY_RUN' | 'STAGE' | 'PUBLISH';

export type ContentPackPublishOptions = {
  actor: JwtPayload;
  mode: ContentPackPublishMode;
  /** Required when more than one VERIFIED release exists for a framework. */
  frameworkReleaseCodes?: Record<string, string>;
  /**
   * Explicit human-operated governance switch. The importer proposes mappings as
   * SYSTEM; it never approves them unless this switch is deliberately supplied.
   */
  approveProposedMappings?: boolean;
};

type ResolvedCurriculumRef = CurriculumOutcomeRef & {
  frameworkReleaseId: string;
  frameworkReleaseCode: string;
  frameworkOutcomeId: string;
};

type PublishedItemResult = {
  slug: string;
  shellAction: 'CREATE' | 'REUSE';
  versionAction: 'CREATE' | 'REUSE';
  versionId: string;
  status: string;
  mappingActions: Array<'CREATE' | 'REUSE' | 'APPROVE'>;
};

export type ContentPackPublishReport = {
  packId: string;
  packVersion: number;
  mode: ContentPackPublishMode;
  resolvedFrameworks: Array<{
    frameworkCode: string;
    releaseCode: string;
    releaseId: string;
  }>;
  dryRun: null | {
    activities: Array<{ slug: string; shellAction: 'CREATE' | 'REUSE' }>;
    lessons: Array<{ slug: string; shellAction: 'CREATE' | 'REUSE' }>;
  };
  activities: PublishedItemResult[];
  lessons: PublishedItemResult[];
};

type ExceptionPayload = {
  code?: string;
  existing?: { id?: string };
};

function exceptionPayload(error: unknown): ExceptionPayload | null {
  if (!error || typeof error !== 'object' || !('getResponse' in error)) return null;
  const response = (error as { getResponse: () => unknown }).getResponse();
  if (!response || typeof response !== 'object') return null;
  return response as ExceptionPayload;
}

function normalizedDescription(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function curriculumKey(ref: Pick<CurriculumOutcomeRef, 'frameworkCode' | 'outcomeExternalCode'>) {
  return `${ref.frameworkCode.trim().toUpperCase()}::${ref.outcomeExternalCode.trim()}`;
}

function activityMappingType(role: CurriculumOutcomeRef['role']) {
  return ActivityCurriculumMappingType[role];
}

function lessonMappingType(role: CurriculumOutcomeRef['role']) {
  return LessonExperienceCurriculumMappingType[role];
}

@Injectable()
export class ContentPackPublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculum: CurriculumService,
    private readonly activities: ActivityService,
    private readonly lessons: LessonExperienceService,
  ) {}

  async resolvePlatformActor(email?: string): Promise<JwtPayload> {
    const normalizedEmail = email?.trim().toLowerCase();
    const candidates = await this.prisma.user.findMany({
      where: {
        systemRole: SystemRole.SUPERADMIN,
        deletedAt: null,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: normalizedEmail ? 1 : 2,
      select: { id: true, email: true },
    });

    if (candidates.length === 0) {
      throw new ConflictException({
        code: 'CONTENT_PACK_SUPERADMIN_NOT_FOUND',
        message: normalizedEmail
          ? `SUPERADMIN ${normalizedEmail} nebyl nalezen.`
          : 'Pro content publisher nebyl nalezen žádný SUPERADMIN.',
      });
    }
    if (!normalizedEmail && candidates.length > 1) {
      throw new ConflictException({
        code: 'CONTENT_PACK_SUPERADMIN_AMBIGUOUS',
        message: 'Existuje více SUPERADMIN účtů; zadej --actor-email.',
      });
    }

    const user = candidates[0]!;
    return {
      userId: user.id,
      email: user.email ?? undefined,
      systemRole: SystemRole.SUPERADMIN,
      isPlatformAdmin: true,
    };
  }

  async applyGlobalPack(
    pack: UniversalContentPack,
    options: ContentPackPublishOptions,
  ): Promise<ContentPackPublishReport> {
    this.assertPlatformActor(options.actor);
    this.validatePackReferences(pack);

    const resolved = await this.resolveCurriculumRefs(pack, options);
    const resolvedFrameworks = [...resolved.values()]
      .map((item) => ({
        frameworkCode: item.frameworkCode.trim().toUpperCase(),
        releaseCode: item.frameworkReleaseCode,
        releaseId: item.frameworkReleaseId,
      }))
      .filter(
        (value, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.frameworkCode === value.frameworkCode &&
              candidate.releaseId === value.releaseId,
          ) === index,
      );

    if (options.mode === 'DRY_RUN') {
      const [platformActivities, platformLessons] = await Promise.all([
        this.activities.listPlatformActivities(options.actor),
        this.lessons.listPlatform(options.actor),
      ]);
      const activitySlugs = new Set(platformActivities.map((item) => item.slug));
      const lessonSlugs = new Set(platformLessons.map((item) => item.slug));
      return {
        packId: pack.packId,
        packVersion: pack.version,
        mode: options.mode,
        resolvedFrameworks,
        dryRun: {
          activities: pack.activities.map((spec) => ({
            slug: spec.shell.slug,
            shellAction: activitySlugs.has(spec.shell.slug.toLowerCase())
              ? 'REUSE'
              : 'CREATE',
          })),
          lessons: pack.lessons.map((spec) => ({
            slug: spec.shell.slug,
            shellAction: lessonSlugs.has(spec.shell.slug.toLowerCase())
              ? 'REUSE'
              : 'CREATE',
          })),
        },
        activities: [],
        lessons: [],
      };
    }

    const activityVersionBySlug = new Map<string, string>();
    const activityResults: PublishedItemResult[] = [];
    for (const spec of pack.activities) {
      const result = await this.applyActivity(
        spec,
        resolved,
        options,
      );
      activityVersionBySlug.set(spec.shell.slug.toLowerCase(), result.versionId);
      activityResults.push(result);
    }

    const lessonResults: PublishedItemResult[] = [];
    for (const spec of pack.lessons) {
      lessonResults.push(
        await this.applyLesson(
          spec,
          resolved,
          activityVersionBySlug,
          options,
        ),
      );
    }

    return {
      packId: pack.packId,
      packVersion: pack.version,
      mode: options.mode,
      resolvedFrameworks,
      dryRun: null,
      activities: activityResults,
      lessons: lessonResults,
    };
  }

  private async resolveCurriculumRefs(
    pack: UniversalContentPack,
    options: ContentPackPublishOptions,
  ): Promise<Map<string, ResolvedCurriculumRef>> {
    const uniqueRefs = new Map<string, CurriculumOutcomeRef>();
    for (const spec of [...pack.activities, ...pack.lessons]) {
      for (const ref of spec.curriculum) uniqueRefs.set(curriculumKey(ref), ref);
    }

    const frameworks = await this.curriculum.listFrameworks();
    const result = new Map<string, ResolvedCurriculumRef>();
    const releaseCache = new Map<string, Awaited<ReturnType<CurriculumService['getFrameworkRelease']>>>();

    for (const ref of uniqueRefs.values()) {
      const code = ref.frameworkCode.trim().toUpperCase();
      const framework = frameworks.find(
        (candidate) => candidate.code.toUpperCase() === code,
      );
      if (!framework) {
        throw new ConflictException({
          code: 'CONTENT_PACK_FRAMEWORK_NOT_FOUND',
          frameworkCode: code,
        });
      }

      const requestedReleaseCode = options.frameworkReleaseCodes?.[code];
      const verified = framework.releases.filter(
        (release) => release.status === CurriculumFrameworkReleaseStatus.VERIFIED,
      );
      const selected = requestedReleaseCode
        ? verified.find((release) => release.releaseCode === requestedReleaseCode)
        : verified.length === 1
          ? verified[0]
          : null;

      if (!selected) {
        if (requestedReleaseCode) {
          throw new ConflictException({
            code: 'CONTENT_PACK_FRAMEWORK_RELEASE_NOT_VERIFIED',
            frameworkCode: code,
            releaseCode: requestedReleaseCode,
          });
        }
        throw new ConflictException({
          code:
            verified.length === 0
              ? 'CONTENT_PACK_FRAMEWORK_RELEASE_MISSING'
              : 'CONTENT_PACK_FRAMEWORK_RELEASE_AMBIGUOUS',
          frameworkCode: code,
          verifiedReleaseCodes: verified.map((release) => release.releaseCode),
        });
      }

      let fullRelease = releaseCache.get(selected.id);
      if (!fullRelease) {
        fullRelease = await this.curriculum.getFrameworkRelease(selected.id);
        releaseCache.set(selected.id, fullRelease);
      }
      const outcomes = fullRelease.outcomes.filter(
        (outcome) => outcome.externalCode === ref.outcomeExternalCode,
      );
      if (outcomes.length !== 1) {
        throw new ConflictException({
          code:
            outcomes.length === 0
              ? 'CONTENT_PACK_OUTCOME_NOT_FOUND'
              : 'CONTENT_PACK_OUTCOME_AMBIGUOUS',
          frameworkCode: code,
          releaseCode: selected.releaseCode,
          outcomeExternalCode: ref.outcomeExternalCode,
        });
      }

      result.set(curriculumKey(ref), {
        ...ref,
        frameworkCode: code,
        frameworkReleaseId: selected.id,
        frameworkReleaseCode: selected.releaseCode,
        frameworkOutcomeId: outcomes[0]!.id,
      });
    }
    return result;
  }

  private async applyActivity(
    spec: UniversalActivitySpec,
    resolved: Map<string, ResolvedCurriculumRef>,
    options: ContentPackPublishOptions,
  ): Promise<PublishedItemResult> {
    const slug = spec.shell.slug.trim().toLowerCase();
    const platform = await this.activities.listPlatformActivities(options.actor);
    let activity = platform.find((item) => item.slug === slug);
    let shellAction: 'CREATE' | 'REUSE' = 'REUSE';

    if (!activity) {
      activity = await this.activities.createGlobalActivity(spec.shell, options.actor) as any;
      shellAction = 'CREATE';
    } else {
      this.assertShellMatches('Activity', activity, spec.shell);
    }

    let versionId: string;
    let versionAction: 'CREATE' | 'REUSE' = 'CREATE';
    try {
      const version = await this.activities.createVersion(
        activity.id,
        spec.version,
        options.actor,
      );
      versionId = version.id;
    } catch (error) {
      const payload = exceptionPayload(error);
      if (
        payload?.code !== 'ACTIVITY_VERSION_DUPLICATE_CONTENT' ||
        !payload.existing?.id
      ) {
        throw error;
      }
      versionId = payload.existing.id;
      versionAction = 'REUSE';
    }

    const mappingActions = await this.ensureActivityMappings(
      activity.id,
      versionId,
      spec.curriculum,
      resolved,
      options,
    );

    let detail = await this.activities.getPlatformActivity(activity.id, options.actor);
    let version = detail.versions.find((item) => item.id === versionId);
    if (!version) throw new Error(`ActivityVersion ${versionId} disappeared.`);

    if (options.mode === 'PUBLISH') {
      this.assertNoPendingActivityMappings(version, spec.shell.slug);
      if (version.status === ActivityVersionStatus.DRAFT) {
        await this.activities.submitForReview(versionId, options.actor);
        detail = await this.activities.getPlatformActivity(activity.id, options.actor);
        version = detail.versions.find((item) => item.id === versionId)!;
      }
      if (version.status === ActivityVersionStatus.REVIEW) {
        await this.activities.publish(versionId, options.actor);
        detail = await this.activities.getPlatformActivity(activity.id, options.actor);
        version = detail.versions.find((item) => item.id === versionId)!;
      }
      if (version.status !== ActivityVersionStatus.PUBLISHED) {
        throw new ConflictException({
          code: 'CONTENT_PACK_ACTIVITY_NOT_PUBLISHABLE',
          slug,
          status: version.status,
        });
      }
    }

    return {
      slug,
      shellAction,
      versionAction,
      versionId,
      status: version.status,
      mappingActions,
    };
  }

  private async ensureActivityMappings(
    activityId: string,
    versionId: string,
    refs: CurriculumOutcomeRef[],
    resolved: Map<string, ResolvedCurriculumRef>,
    options: ContentPackPublishOptions,
  ): Promise<Array<'CREATE' | 'REUSE' | 'APPROVE'>> {
    const actions: Array<'CREATE' | 'REUSE' | 'APPROVE'> = [];
    let detail = await this.activities.getPlatformActivity(activityId, options.actor);
    let version = detail.versions.find((item) => item.id === versionId);
    if (!version) throw new Error(`ActivityVersion ${versionId} disappeared.`);

    for (const ref of refs) {
      const target = resolved.get(curriculumKey(ref));
      if (!target) throw new Error(`Unresolved curriculum ref ${curriculumKey(ref)}.`);
      const type = activityMappingType(ref.role);
      let mapping = version.curriculumMappings.find(
        (candidate) =>
          candidate.frameworkOutcomeId === target.frameworkOutcomeId &&
          candidate.mappingType === type,
      );

      if (!mapping) {
        if (version.status === ActivityVersionStatus.PUBLISHED) {
          throw new ConflictException({
            code: 'CONTENT_PACK_PUBLISHED_ACTIVITY_MAPPING_DRIFT',
            activityVersionId: version.id,
            frameworkReleaseCode: target.frameworkReleaseCode,
            outcomeExternalCode: target.outcomeExternalCode,
          });
        }
        mapping = await this.activities.proposeMapping(
          version.id,
          {
            frameworkOutcomeId: target.frameworkOutcomeId,
            mappingType: type,
            rationale: ref.rationale,
            proposedByType: MappingProposerType.SYSTEM,
          },
          options.actor,
        ) as any;
        actions.push('CREATE');
      } else {
        actions.push('REUSE');
      }

      if (mapping.status === ActivityCurriculumMappingStatus.REJECTED) {
        throw new ConflictException({
          code: 'CONTENT_PACK_ACTIVITY_MAPPING_REJECTED',
          mappingId: mapping.id,
          slug: detail.slug,
        });
      }
      if (
        mapping.status === ActivityCurriculumMappingStatus.PROPOSED &&
        options.approveProposedMappings
      ) {
        await this.activities.reviewMapping(
          mapping.id,
          {
            status: ActivityCurriculumMappingStatus.APPROVED,
            rationale: `Explicit content-pack governance approval for ${detail.slug}.`,
          },
          options.actor,
        );
        actions.push('APPROVE');
      }
    }

    detail = await this.activities.getPlatformActivity(activityId, options.actor);
    version = detail.versions.find((item) => item.id === versionId)!;
    this.assertPublishedActivityMappingsStillMatch(version, refs, resolved, detail.slug);
    return actions;
  }

  private async applyLesson(
    spec: UniversalLessonSpec,
    resolved: Map<string, ResolvedCurriculumRef>,
    activityVersionBySlug: Map<string, string>,
    options: ContentPackPublishOptions,
  ): Promise<PublishedItemResult> {
    const slug = spec.shell.slug.trim().toLowerCase();
    const platform = await this.lessons.listPlatform(options.actor);
    let lesson = platform.find((item) => item.slug === slug);
    let shellAction: 'CREATE' | 'REUSE' = 'REUSE';

    if (!lesson) {
      lesson = await this.lessons.createGlobalLesson(spec.shell, options.actor) as any;
      shellAction = 'CREATE';
    } else {
      this.assertShellMatches('Lesson Experience', lesson, spec.shell);
    }

    const resolvedVersion: CreateLessonExperienceVersionDto = {
      ...spec.version,
      stages: spec.version.stages.map((stage) => {
        const { activityRef, ...rest } = stage;
        if (!activityRef) return rest;
        const activityVersionId = activityVersionBySlug.get(
          activityRef.trim().toLowerCase(),
        );
        if (!activityVersionId) {
          throw new ConflictException({
            code: 'CONTENT_PACK_ACTIVITY_REF_UNRESOLVED',
            lessonSlug: slug,
            activityRef,
          });
        }
        return { ...rest, activityVersionId };
      }),
    };

    let versionId: string;
    let versionAction: 'CREATE' | 'REUSE' = 'CREATE';
    try {
      const version = await this.lessons.createVersion(
        lesson.id,
        resolvedVersion,
        options.actor,
      );
      versionId = version.id;
    } catch (error) {
      const payload = exceptionPayload(error);
      if (
        payload?.code !== 'LESSON_VERSION_DUPLICATE_CONTENT' ||
        !payload.existing?.id
      ) {
        throw error;
      }
      versionId = payload.existing.id;
      versionAction = 'REUSE';
    }

    const mappingActions = await this.ensureLessonMappings(
      lesson.id,
      versionId,
      spec.curriculum,
      resolved,
      options,
    );

    let detail = await this.lessons.getPlatformLesson(lesson.id, options.actor);
    let version = detail.versions.find((item) => item.id === versionId);
    if (!version) throw new Error(`LessonExperienceVersion ${versionId} disappeared.`);

    if (options.mode === 'PUBLISH') {
      this.assertNoPendingLessonMappings(version, spec.shell.slug);
      if (version.status === LessonExperienceVersionStatus.DRAFT) {
        await this.lessons.submitForReview(versionId, options.actor);
        detail = await this.lessons.getPlatformLesson(lesson.id, options.actor);
        version = detail.versions.find((item) => item.id === versionId)!;
      }
      if (version.status === LessonExperienceVersionStatus.REVIEW) {
        await this.lessons.publish(versionId, options.actor);
        detail = await this.lessons.getPlatformLesson(lesson.id, options.actor);
        version = detail.versions.find((item) => item.id === versionId)!;
      }
      if (version.status !== LessonExperienceVersionStatus.PUBLISHED) {
        throw new ConflictException({
          code: 'CONTENT_PACK_LESSON_NOT_PUBLISHABLE',
          slug,
          status: version.status,
        });
      }
    }

    return {
      slug,
      shellAction,
      versionAction,
      versionId,
      status: version.status,
      mappingActions,
    };
  }

  private async ensureLessonMappings(
    lessonId: string,
    versionId: string,
    refs: CurriculumOutcomeRef[],
    resolved: Map<string, ResolvedCurriculumRef>,
    options: ContentPackPublishOptions,
  ): Promise<Array<'CREATE' | 'REUSE' | 'APPROVE'>> {
    const actions: Array<'CREATE' | 'REUSE' | 'APPROVE'> = [];
    let detail = await this.lessons.getPlatformLesson(lessonId, options.actor);
    let version = detail.versions.find((item) => item.id === versionId);
    if (!version) throw new Error(`LessonExperienceVersion ${versionId} disappeared.`);

    for (const ref of refs) {
      const target = resolved.get(curriculumKey(ref));
      if (!target) throw new Error(`Unresolved curriculum ref ${curriculumKey(ref)}.`);
      const type = lessonMappingType(ref.role);
      let mapping = version.curriculumMappings.find(
        (candidate) =>
          candidate.frameworkOutcomeId === target.frameworkOutcomeId &&
          candidate.mappingType === type,
      );

      if (!mapping) {
        if (version.status === LessonExperienceVersionStatus.PUBLISHED) {
          throw new ConflictException({
            code: 'CONTENT_PACK_PUBLISHED_LESSON_MAPPING_DRIFT',
            lessonExperienceVersionId: version.id,
            frameworkReleaseCode: target.frameworkReleaseCode,
            outcomeExternalCode: target.outcomeExternalCode,
          });
        }
        mapping = await this.lessons.proposeMapping(
          version.id,
          {
            frameworkOutcomeId: target.frameworkOutcomeId,
            mappingType: type,
            rationale: ref.rationale,
            proposedByType: MappingProposerType.SYSTEM,
          },
          options.actor,
        ) as any;
        actions.push('CREATE');
      } else {
        actions.push('REUSE');
      }

      if (mapping.status === LessonExperienceCurriculumMappingStatus.REJECTED) {
        throw new ConflictException({
          code: 'CONTENT_PACK_LESSON_MAPPING_REJECTED',
          mappingId: mapping.id,
          slug: detail.slug,
        });
      }
      if (
        mapping.status === LessonExperienceCurriculumMappingStatus.PROPOSED &&
        options.approveProposedMappings
      ) {
        await this.lessons.reviewMapping(
          mapping.id,
          {
            status: LessonExperienceCurriculumMappingStatus.APPROVED,
            rationale: `Explicit content-pack governance approval for ${detail.slug}.`,
          },
          options.actor,
        );
        actions.push('APPROVE');
      }
    }

    detail = await this.lessons.getPlatformLesson(lessonId, options.actor);
    version = detail.versions.find((item) => item.id === versionId)!;
    this.assertPublishedLessonMappingsStillMatch(version, refs, resolved, detail.slug);
    return actions;
  }

  private assertPublishedActivityMappingsStillMatch(
    version: any,
    refs: CurriculumOutcomeRef[],
    resolved: Map<string, ResolvedCurriculumRef>,
    slug: string,
  ) {
    if (version.status !== ActivityVersionStatus.PUBLISHED) return;
    for (const ref of refs) {
      const target = resolved.get(curriculumKey(ref))!;
      const mapping = version.curriculumMappings.find(
        (candidate: any) =>
          candidate.frameworkOutcomeId === target.frameworkOutcomeId &&
          candidate.mappingType === activityMappingType(ref.role) &&
          candidate.status === ActivityCurriculumMappingStatus.APPROVED,
      );
      if (!mapping) {
        throw new ConflictException({
          code: 'CONTENT_PACK_PUBLISHED_ACTIVITY_MAPPING_DRIFT',
          slug,
          frameworkReleaseCode: target.frameworkReleaseCode,
          outcomeExternalCode: target.outcomeExternalCode,
        });
      }
    }
  }

  private assertPublishedLessonMappingsStillMatch(
    version: any,
    refs: CurriculumOutcomeRef[],
    resolved: Map<string, ResolvedCurriculumRef>,
    slug: string,
  ) {
    if (version.status !== LessonExperienceVersionStatus.PUBLISHED) return;
    for (const ref of refs) {
      const target = resolved.get(curriculumKey(ref))!;
      const mapping = version.curriculumMappings.find(
        (candidate: any) =>
          candidate.frameworkOutcomeId === target.frameworkOutcomeId &&
          candidate.mappingType === lessonMappingType(ref.role) &&
          candidate.status === LessonExperienceCurriculumMappingStatus.APPROVED,
      );
      if (!mapping) {
        throw new ConflictException({
          code: 'CONTENT_PACK_PUBLISHED_LESSON_MAPPING_DRIFT',
          slug,
          frameworkReleaseCode: target.frameworkReleaseCode,
          outcomeExternalCode: target.outcomeExternalCode,
        });
      }
    }
  }

  private assertNoPendingActivityMappings(version: any, slug: string) {
    const pending = version.curriculumMappings.filter(
      (mapping: any) =>
        mapping.status === ActivityCurriculumMappingStatus.PROPOSED,
    );
    if (pending.length > 0) {
      throw new ConflictException({
        code: 'CONTENT_PACK_MAPPING_REVIEW_REQUIRED',
        entity: 'ACTIVITY',
        slug,
        mappingIds: pending.map((mapping: any) => mapping.id),
      });
    }
  }

  private assertNoPendingLessonMappings(version: any, slug: string) {
    const pending = version.curriculumMappings.filter(
      (mapping: any) =>
        mapping.status === LessonExperienceCurriculumMappingStatus.PROPOSED,
    );
    if (pending.length > 0) {
      throw new ConflictException({
        code: 'CONTENT_PACK_MAPPING_REVIEW_REQUIRED',
        entity: 'LESSON_EXPERIENCE',
        slug,
        mappingIds: pending.map((mapping: any) => mapping.id),
      });
    }
  }

  private assertShellMatches(
    entity: string,
    existing: { title: string; description?: string | null },
    expected: { title: string; description?: string },
  ) {
    if (
      existing.title.trim() !== expected.title.trim() ||
      normalizedDescription(existing.description) !==
        normalizedDescription(expected.description)
    ) {
      throw new ConflictException({
        code: 'CONTENT_PACK_SHELL_DRIFT',
        entity,
        existing: {
          title: existing.title,
          description: normalizedDescription(existing.description),
        },
        expected: {
          title: expected.title,
          description: normalizedDescription(expected.description),
        },
      });
    }
  }

  private validatePackReferences(pack: UniversalContentPack) {
    const activitySlugs = new Set<string>();
    const lessonSlugs = new Set<string>();

    for (const activity of pack.activities) {
      const slug = activity.shell.slug.trim().toLowerCase();
      if (activitySlugs.has(slug)) {
        throw new ConflictException({
          code: 'CONTENT_PACK_DUPLICATE_ACTIVITY_SLUG',
          slug,
        });
      }
      activitySlugs.add(slug);
      if (activity.curriculum.length === 0) {
        throw new ConflictException({
          code: 'CONTENT_PACK_ACTIVITY_MAPPING_REQUIRED',
          slug,
        });
      }
    }

    for (const lesson of pack.lessons) {
      const slug = lesson.shell.slug.trim().toLowerCase();
      if (lessonSlugs.has(slug)) {
        throw new ConflictException({
          code: 'CONTENT_PACK_DUPLICATE_LESSON_SLUG',
          slug,
        });
      }
      lessonSlugs.add(slug);
      if (lesson.curriculum.length === 0) {
        throw new ConflictException({
          code: 'CONTENT_PACK_LESSON_MAPPING_REQUIRED',
          slug,
        });
      }
      for (const stage of lesson.version.stages) {
        if (
          stage.activityRef &&
          !activitySlugs.has(stage.activityRef.trim().toLowerCase())
        ) {
          throw new ConflictException({
            code: 'CONTENT_PACK_ACTIVITY_REF_UNKNOWN',
            lessonSlug: slug,
            activityRef: stage.activityRef,
          });
        }
      }
    }
  }

  private assertPlatformActor(actor: JwtPayload) {
    if (actor.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Globální content pack publisher vyžaduje SUPERADMIN.',
      );
    }
  }
}
