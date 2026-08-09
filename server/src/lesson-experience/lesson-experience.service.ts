import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityScope,
  ActivityVersionStatus,
  AuditEntityType,
  CurriculumFrameworkReleaseStatus,
  LessonExperienceCurriculumMappingStatus,
  LessonExperienceScope,
  LessonExperienceVersionStatus,
  MappingProposerType,
  OrganizationRole,
  OutcomeAspectStatus,
  Prisma,
  SystemRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '@/audit/audit.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  CreateLessonExperienceDto,
  CreateLessonExperienceVersionDto,
  ProposeLessonCurriculumMappingDto,
  ReviewLessonCurriculumMappingDto,
} from './dto/lesson-experience.dto';
import { validateLessonDefinition } from './lesson-publication';

const asJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function checksum(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function activeRole(actor: JwtPayload): OrganizationRole | undefined {
  return actor.activeRole ?? actor.organizationRole;
}

@Injectable()
export class LessonExperienceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAvailable(actor: JwtPayload) {
    const global = await this.prisma.lessonExperience.findMany({
      where: {
        scope: LessonExperienceScope.GLOBAL,
        deletedAt: null,
        versions: { some: { status: LessonExperienceVersionStatus.PUBLISHED } },
      },
      include: {
        versions: {
          where: { status: LessonExperienceVersionStatus.PUBLISHED },
          orderBy: { versionNo: 'desc' },
          include: { stages: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });

    const local = actor.organizationId
      ? await this.prisma.lessonExperience.findMany({
          where: {
            scope: LessonExperienceScope.ORGANIZATION,
            organizationId: actor.organizationId,
            deletedAt: null,
          },
          include: {
            versions: {
              orderBy: { versionNo: 'desc' },
              include: { stages: { orderBy: { orderIndex: 'asc' } } },
            },
          },
        })
      : [];

    return [...global, ...local].sort((a, b) =>
      a.title.localeCompare(b.title, 'cs'),
    );
  }

  async listPlatform(actor: JwtPayload) {
    this.assertPlatformSuperadmin(actor);
    return this.prisma.lessonExperience.findMany({
      where: { scope: LessonExperienceScope.GLOBAL, deletedAt: null },
      orderBy: { title: 'asc' },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            stages: { orderBy: { orderIndex: 'asc' } },
            curriculumMappings: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
  }

  createOrganizationLesson(dto: CreateLessonExperienceDto, actor: JwtPayload) {
    this.assertAuthorRole(actor);
    return this.createLesson(
      dto,
      actor,
      LessonExperienceScope.ORGANIZATION,
      this.requireOrganization(actor),
    );
  }

  createGlobalLesson(dto: CreateLessonExperienceDto, actor: JwtPayload) {
    this.assertPlatformSuperadmin(actor);
    return this.createLesson(dto, actor, LessonExperienceScope.GLOBAL, null);
  }

  private async createLesson(
    dto: CreateLessonExperienceDto,
    actor: JwtPayload,
    scope: LessonExperienceScope,
    organizationId: string | null,
  ) {
    const slug = dto.slug.trim().toLowerCase();
    const duplicate = await this.prisma.lessonExperience.findFirst({
      where: { scope, organizationId, slug, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException({ code: 'LESSON_SLUG_EXISTS' });

    const lesson = await this.prisma.lessonExperience.create({
      data: {
        scope,
        organizationId,
        slug,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        createdById: actor.userId,
      },
    });

    await this.audit.log({
      action: 'LESSON_EXPERIENCE_CREATED',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: lesson.id,
      userId: actor.userId,
      organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({ lessonExperienceId: lesson.id, scope }),
    });
    return lesson;
  }

  async getLesson(lessonId: string, actor: JwtPayload) {
    const lesson = await this.requireVisibleLesson(lessonId, actor);
    const allVersions =
      actor.systemRole === SystemRole.SUPERADMIN ||
      lesson.scope === LessonExperienceScope.ORGANIZATION;

    return this.prisma.lessonExperience.findUniqueOrThrow({
      where: { id: lesson.id },
      include: {
        versions: {
          ...(allVersions
            ? {}
            : { where: { status: LessonExperienceVersionStatus.PUBLISHED } }),
          orderBy: { versionNo: 'desc' },
          include: {
            stages: { orderBy: { orderIndex: 'asc' } },
            curriculumMappings: {
              ...(allVersions
                ? {}
                : {
                    where: {
                      status: LessonExperienceCurriculumMappingStatus.APPROVED,
                    },
                  }),
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
  }

  async getPlatformLesson(lessonId: string, actor: JwtPayload) {
    this.assertPlatformSuperadmin(actor);
    const lesson = await this.prisma.lessonExperience.findFirst({
      where: {
        id: lessonId,
        scope: LessonExperienceScope.GLOBAL,
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            stages: { orderBy: { orderIndex: 'asc' } },
            curriculumMappings: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson Experience nenalezena.');
    return lesson;
  }

  async createVersion(
    lessonId: string,
    dto: CreateLessonExperienceVersionDto,
    actor: JwtPayload,
  ) {
    const lesson = await this.requireAuthorableLesson(lessonId, actor);
    const validated = validateLessonDefinition(dto);
    await this.validateActivityReferences(
      lesson,
      validated.orderedStages,
      validated.supportedModes,
      false,
    );

    const snapshot = {
      schemaVersion: dto.schemaVersion,
      title: dto.title.trim(),
      summary: dto.summary?.trim() ?? null,
      learningObjective: dto.learningObjective.trim(),
      pedagogicalRationale: dto.pedagogicalRationale.trim(),
      supportedModes: [...validated.supportedModes].sort(),
      recommendedMode: dto.recommendedMode,
      estimatedDurationMin: dto.estimatedDurationMin,
      teacherPlan: dto.teacherPlan,
      hardwareRequirements: dto.hardwareRequirements,
      accessibilityPlan: dto.accessibilityPlan,
      privacyPlan: dto.privacyPlan,
      offlinePolicy: dto.offlinePolicy,
      assetManifest: dto.assetManifest,
      stages: validated.orderedStages.map((stage) => ({
        stageKey: stage.stageKey,
        orderIndex: stage.orderIndex,
        stageType: stage.stageType,
        title: stage.title.trim(),
        studentPrompt: stage.studentPrompt?.trim() ?? null,
        teacherGuidance: stage.teacherGuidance?.trim() ?? null,
        durationMin: stage.durationMin,
        activityVersionId: stage.activityVersionId ?? null,
        completionType: stage.completionType,
        checkpoint: stage.checkpoint,
        required: stage.required,
        teacherIntervention: stage.teacherIntervention,
      })),
    };
    const contentChecksum = checksum(snapshot);

    const optimisticDuplicate = await this.prisma.lessonExperienceVersion.findFirst({
      where: { lessonExperienceId: lesson.id, contentChecksum },
      select: { id: true, versionNo: true },
    });
    if (optimisticDuplicate) {
      throw new ConflictException({
        code: 'LESSON_VERSION_DUPLICATE_CONTENT',
        existing: optimisticDuplicate,
      });
    }

    const version = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lesson.id}, 0))`;

      const lockedDuplicate = await tx.lessonExperienceVersion.findFirst({
        where: { lessonExperienceId: lesson.id, contentChecksum },
        select: { id: true, versionNo: true },
      });
      if (lockedDuplicate) {
        throw new ConflictException({
          code: 'LESSON_VERSION_DUPLICATE_CONTENT',
          existing: lockedDuplicate,
        });
      }

      const latest = await tx.lessonExperienceVersion.findFirst({
        where: { lessonExperienceId: lesson.id },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      });
      const draft = await tx.lessonExperienceVersion.create({
        data: {
          lessonExperienceId: lesson.id,
          versionNo: (latest?.versionNo ?? 0) + 1,
          status: LessonExperienceVersionStatus.DRAFT,
          schemaVersion: snapshot.schemaVersion,
          title: snapshot.title,
          summary: snapshot.summary,
          learningObjective: snapshot.learningObjective,
          pedagogicalRationale: snapshot.pedagogicalRationale,
          supportedModes: snapshot.supportedModes,
          recommendedMode: snapshot.recommendedMode,
          estimatedDurationMin: snapshot.estimatedDurationMin,
          teacherPlan: asJson(snapshot.teacherPlan),
          hardwareRequirements: asJson(snapshot.hardwareRequirements),
          accessibilityPlan: asJson(snapshot.accessibilityPlan),
          privacyPlan: asJson(snapshot.privacyPlan),
          offlinePolicy: asJson(snapshot.offlinePolicy),
          assetManifest: asJson(snapshot.assetManifest),
        },
      });

      await tx.lessonStage.createMany({
        data: snapshot.stages.map((stage) => ({
          lessonExperienceVersionId: draft.id,
          ...stage,
        })),
      });

      return tx.lessonExperienceVersion.update({
        where: { id: draft.id },
        data: { contentChecksum, sealedAt: new Date() },
        include: { stages: { orderBy: { orderIndex: 'asc' } } },
      });
    });

    await this.audit.log({
      action: 'LESSON_EXPERIENCE_VERSION_CREATED',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: version.id,
      userId: actor.userId,
      organizationId: lesson.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        lessonExperienceId: lesson.id,
        lessonExperienceVersionId: version.id,
        contentChecksum,
        stageCount: version.stages.length,
        schemaVersion: version.schemaVersion,
      }),
    });
    return version;
  }

  async proposeMapping(
    versionId: string,
    dto: ProposeLessonCurriculumMappingDto,
    actor: JwtPayload,
  ) {
    const { version, lesson } = await this.requireAuthorableVersion(versionId, actor);
    if (
      version.status !== LessonExperienceVersionStatus.DRAFT &&
      version.status !== LessonExperienceVersionStatus.REVIEW
    ) {
      throw new ConflictException({ code: 'LESSON_MAPPING_VERSION_FROZEN' });
    }

    const outcome = await this.prisma.frameworkOutcome.findUnique({
      where: { id: dto.frameworkOutcomeId },
      include: { release: true },
    });
    if (!outcome) throw new NotFoundException('Framework outcome nenalezen.');
    if (outcome.release.status !== CurriculumFrameworkReleaseStatus.VERIFIED) {
      throw new ConflictException({ code: 'LESSON_MAPPING_RELEASE_NOT_VERIFIED' });
    }

    let aspectReviewVersion: number | null = null;
    if (dto.outcomeAspectId) {
      const aspect = await this.prisma.outcomeAspect.findUnique({
        where: { id: dto.outcomeAspectId },
      });
      if (!aspect || aspect.frameworkOutcomeId !== outcome.id) {
        throw new BadRequestException({ code: 'LESSON_MAPPING_ASPECT_OUTCOME_MISMATCH' });
      }
      if (aspect.status !== OutcomeAspectStatus.ACTIVE) {
        throw new ConflictException({ code: 'LESSON_MAPPING_ASPECT_RETIRED' });
      }
      aspectReviewVersion = aspect.reviewVersion;
    }

    const proposedByType = dto.proposedByType ?? MappingProposerType.HUMAN;
    if (
      proposedByType !== MappingProposerType.HUMAN &&
      actor.systemRole !== SystemRole.SUPERADMIN
    ) {
      throw new ForbiddenException(
        'SYSTEM/AI návrh může zapisovat pouze platformní governance cesta.',
      );
    }

    const mapping = await this.prisma.lessonExperienceCurriculumMapping.create({
      data: {
        lessonExperienceVersionId: version.id,
        frameworkOutcomeId: outcome.id,
        outcomeAspectId: dto.outcomeAspectId ?? null,
        mappingType: dto.mappingType,
        rationale: dto.rationale.trim(),
        proposedByType,
        proposedById: actor.userId,
        frameworkReleaseId: outcome.frameworkReleaseId,
        frameworkOutcomeChecksum: outcome.checksum,
        outcomeAspectReviewVersion: aspectReviewVersion,
      },
    });

    await this.audit.log({
      action: 'LESSON_CURRICULUM_MAPPING_PROPOSED',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: mapping.id,
      userId: actor.userId,
      organizationId: lesson.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        lessonExperienceVersionId: version.id,
        lessonExperienceMappingId: mapping.id,
        frameworkReleaseId: outcome.frameworkReleaseId,
        frameworkOutcomeId: outcome.id,
        outcomeAspectId: dto.outcomeAspectId ?? null,
        proposedByType,
      }),
    });
    return mapping;
  }

  async reviewMapping(
    mappingId: string,
    dto: ReviewLessonCurriculumMappingDto,
    actor: JwtPayload,
  ) {
    const mapping = await this.prisma.lessonExperienceCurriculumMapping.findUnique({
      where: { id: mappingId },
      include: { lessonExperienceVersion: { include: { lessonExperience: true } } },
    });
    if (!mapping) throw new NotFoundException('Lesson mapping nenalezen.');
    this.assertPublisherForLesson(mapping.lessonExperienceVersion.lessonExperience, actor);
    if (
      mapping.lessonExperienceVersion.status !== LessonExperienceVersionStatus.DRAFT &&
      mapping.lessonExperienceVersion.status !== LessonExperienceVersionStatus.REVIEW
    ) {
      throw new ConflictException({ code: 'LESSON_MAPPING_VERSION_FROZEN' });
    }
    if (mapping.status !== LessonExperienceCurriculumMappingStatus.PROPOSED) {
      throw new ConflictException({ code: 'LESSON_MAPPING_ALREADY_REVIEWED' });
    }

    const reviewed = await this.prisma.lessonExperienceCurriculumMapping.update({
      where: { id: mapping.id },
      data: {
        status: dto.status,
        reviewRationale: dto.rationale.trim(),
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
      },
    });
    await this.audit.log({
      action: 'LESSON_CURRICULUM_MAPPING_REVIEWED',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: reviewed.id,
      userId: actor.userId,
      organizationId: mapping.lessonExperienceVersion.lessonExperience.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        lessonExperienceVersionId: mapping.lessonExperienceVersionId,
        lessonExperienceMappingId: reviewed.id,
        status: reviewed.status,
      }),
    });
    return reviewed;
  }

  async submitForReview(versionId: string, actor: JwtPayload) {
    const { version, lesson } = await this.requireAuthorableVersion(versionId, actor, true);
    if (version.status !== LessonExperienceVersionStatus.DRAFT) {
      throw new ConflictException({ code: 'LESSON_VERSION_NOT_DRAFT' });
    }
    await this.validateStoredVersion(version, lesson, false);
    const review = await this.prisma.lessonExperienceVersion.update({
      where: { id: version.id },
      data: {
        status: LessonExperienceVersionStatus.REVIEW,
        reviewedAt: new Date(),
        reviewedBy: actor.userId,
      },
    });
    await this.audit.log({
      action: 'LESSON_EXPERIENCE_VERSION_SUBMITTED_FOR_REVIEW',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: review.id,
      userId: actor.userId,
      organizationId: lesson.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        lessonExperienceId: lesson.id,
        lessonExperienceVersionId: review.id,
        contentChecksum: review.contentChecksum,
      }),
    });
    return review;
  }

  async publish(versionId: string, actor: JwtPayload) {
    const { version, lesson } = await this.requirePublishableVersion(versionId, actor, true);
    if (version.status !== LessonExperienceVersionStatus.REVIEW) {
      throw new ConflictException({ code: 'LESSON_VERSION_NOT_IN_REVIEW' });
    }
    await this.validateStoredVersion(version, lesson, true);

    const mappings = await this.prisma.lessonExperienceCurriculumMapping.findMany({
      where: { lessonExperienceVersionId: version.id },
      include: {
        frameworkOutcome: true,
        outcomeAspect: true,
        frameworkRelease: true,
      },
    });
    if (
      mappings.some(
        (mapping) =>
          mapping.status === LessonExperienceCurriculumMappingStatus.PROPOSED,
      )
    ) {
      throw new ConflictException({ code: 'LESSON_MAPPING_REVIEW_PENDING' });
    }
    const approved = mappings.filter(
      (mapping) =>
        mapping.status === LessonExperienceCurriculumMappingStatus.APPROVED,
    );
    if (approved.length === 0) {
      throw new ConflictException({ code: 'LESSON_MAPPING_REQUIRED' });
    }
    for (const mapping of approved) {
      if (
        mapping.frameworkRelease.status !== CurriculumFrameworkReleaseStatus.VERIFIED ||
        mapping.frameworkOutcome.checksum !== mapping.frameworkOutcomeChecksum ||
        (mapping.outcomeAspect &&
          (mapping.outcomeAspect.status !== OutcomeAspectStatus.ACTIVE ||
            mapping.outcomeAspect.reviewVersion !== mapping.outcomeAspectReviewVersion))
      ) {
        throw new ConflictException({ code: 'LESSON_MAPPING_STALE' });
      }
    }

    const published = await this.prisma.lessonExperienceVersion.update({
      where: { id: version.id },
      data: {
        status: LessonExperienceVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: actor.userId,
      },
    });
    await this.audit.log({
      action: 'LESSON_EXPERIENCE_VERSION_PUBLISHED',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: published.id,
      userId: actor.userId,
      organizationId: lesson.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        lessonExperienceId: lesson.id,
        lessonExperienceVersionId: published.id,
        contentChecksum: published.contentChecksum,
      }),
    });
    return published;
  }

  async retire(versionId: string, actor: JwtPayload) {
    const { version, lesson } = await this.requirePublishableVersion(versionId, actor);
    if (version.status !== LessonExperienceVersionStatus.PUBLISHED) {
      throw new ConflictException({ code: 'LESSON_VERSION_NOT_PUBLISHED' });
    }
    const retired = await this.prisma.lessonExperienceVersion.update({
      where: { id: version.id },
      data: { status: LessonExperienceVersionStatus.RETIRED },
    });
    await this.audit.log({
      action: 'LESSON_EXPERIENCE_VERSION_RETIRED',
      entityType: AuditEntityType.LESSON_EXPERIENCE,
      entityId: retired.id,
      userId: actor.userId,
      organizationId: lesson.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        lessonExperienceId: lesson.id,
        lessonExperienceVersionId: retired.id,
        contentChecksum: retired.contentChecksum,
      }),
    });
    return retired;
  }

  private async validateStoredVersion(
    version: any,
    lesson: { scope: LessonExperienceScope; organizationId: string | null },
    requirePublishedActivities: boolean,
  ) {
    const dto = {
      schemaVersion: version.schemaVersion,
      title: version.title,
      summary: version.summary ?? undefined,
      learningObjective: version.learningObjective,
      pedagogicalRationale: version.pedagogicalRationale,
      supportedModes: version.supportedModes,
      recommendedMode: version.recommendedMode,
      estimatedDurationMin: version.estimatedDurationMin,
      teacherPlan: version.teacherPlan,
      hardwareRequirements: version.hardwareRequirements,
      accessibilityPlan: version.accessibilityPlan,
      privacyPlan: version.privacyPlan,
      offlinePolicy: version.offlinePolicy,
      assetManifest: version.assetManifest,
      stages: version.stages.map((stage: any) => ({
        stageKey: stage.stageKey,
        orderIndex: stage.orderIndex,
        stageType: stage.stageType,
        title: stage.title,
        studentPrompt: stage.studentPrompt ?? undefined,
        teacherGuidance: stage.teacherGuidance ?? undefined,
        durationMin: stage.durationMin,
        activityVersionId: stage.activityVersionId ?? undefined,
        completionType: stage.completionType,
        checkpoint: stage.checkpoint,
        required: stage.required,
        teacherIntervention: stage.teacherIntervention,
      })),
    } as CreateLessonExperienceVersionDto;
    const validated = validateLessonDefinition(dto);
    await this.validateActivityReferences(
      lesson,
      validated.orderedStages,
      validated.supportedModes,
      requirePublishedActivities,
    );
  }

  private async validateActivityReferences(
    lesson: { scope: LessonExperienceScope; organizationId: string | null },
    stages: Array<{ activityVersionId?: string }>,
    supportedModes: readonly any[],
    requirePublished: boolean,
  ) {
    const ids = [...new Set(stages.flatMap((stage) =>
      stage.activityVersionId ? [stage.activityVersionId] : [],
    ))];
    if (ids.length === 0) return;

    const versions = await this.prisma.activityVersion.findMany({
      where: { id: { in: ids } },
      include: { activity: true },
    });
    if (versions.length !== ids.length) {
      throw new NotFoundException('Jedna z ActivityVersion nebyla nalezena.');
    }

    for (const version of versions) {
      if (requirePublished && version.status !== ActivityVersionStatus.PUBLISHED) {
        throw new ConflictException({
          code: 'LESSON_ACTIVITY_NOT_PUBLISHED',
          activityVersionId: version.id,
        });
      }
      if (
        supportedModes.some((mode) => !version.supportedModes.includes(mode))
      ) {
        throw new ConflictException({
          code: 'LESSON_ACTIVITY_MODE_INCOMPATIBLE',
          activityVersionId: version.id,
        });
      }
      if (
        lesson.scope === LessonExperienceScope.GLOBAL &&
        version.activity.scope !== ActivityScope.GLOBAL
      ) {
        throw new ConflictException({ code: 'LESSON_GLOBAL_USES_LOCAL_ACTIVITY' });
      }
      if (
        lesson.scope === LessonExperienceScope.ORGANIZATION &&
        version.activity.scope === ActivityScope.ORGANIZATION &&
        version.activity.organizationId !== lesson.organizationId
      ) {
        throw new NotFoundException('ActivityVersion nebyla nalezena.');
      }
    }
  }

  private async requireVisibleLesson(lessonId: string, actor: JwtPayload) {
    if (actor.systemRole === SystemRole.SUPERADMIN) {
      const lesson = await this.prisma.lessonExperience.findFirst({
        where: { id: lessonId, deletedAt: null },
      });
      if (!lesson) throw new NotFoundException('Lesson Experience nenalezena.');
      return lesson;
    }

    const lesson = await this.prisma.lessonExperience.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        OR: [
          {
            scope: LessonExperienceScope.GLOBAL,
            versions: {
              some: { status: LessonExperienceVersionStatus.PUBLISHED },
            },
          },
          ...(actor.organizationId
            ? [
                {
                  scope: LessonExperienceScope.ORGANIZATION,
                  organizationId: actor.organizationId,
                },
              ]
            : []),
        ],
      },
    });
    if (!lesson) throw new NotFoundException('Lesson Experience nenalezena.');
    return lesson;
  }

  private async requireAuthorableLesson(lessonId: string, actor: JwtPayload) {
    this.assertAuthorRole(actor);
    const lesson = await this.requireVisibleLesson(lessonId, actor);
    this.assertTenantOrPlatform(lesson, actor);
    return lesson;
  }

  private async requireAuthorableVersion(
    versionId: string,
    actor: JwtPayload,
    includeStages = false,
  ) {
    this.assertAuthorRole(actor);
    const version = await this.prisma.lessonExperienceVersion.findUnique({
      where: { id: versionId },
      include: {
        lessonExperience: true,
        ...(includeStages
          ? { stages: { orderBy: { orderIndex: 'asc' as const } } }
          : {}),
      },
    });
    if (!version || version.lessonExperience.deletedAt) {
      throw new NotFoundException('LessonExperienceVersion nenalezena.');
    }
    this.assertTenantOrPlatform(version.lessonExperience, actor);
    return { version: version as any, lesson: version.lessonExperience };
  }

  private async requirePublishableVersion(
    versionId: string,
    actor: JwtPayload,
    includeStages = false,
  ) {
    this.assertPublisherRole(actor);
    const version = await this.prisma.lessonExperienceVersion.findUnique({
      where: { id: versionId },
      include: {
        lessonExperience: true,
        ...(includeStages
          ? { stages: { orderBy: { orderIndex: 'asc' as const } } }
          : {}),
      },
    });
    if (!version || version.lessonExperience.deletedAt) {
      throw new NotFoundException('LessonExperienceVersion nenalezena.');
    }
    this.assertTenantOrPlatform(version.lessonExperience, actor);
    return { version: version as any, lesson: version.lessonExperience };
  }

  private assertTenantOrPlatform(
    lesson: { scope: LessonExperienceScope; organizationId: string | null },
    actor: JwtPayload,
  ) {
    if (actor.systemRole === SystemRole.SUPERADMIN) return;
    if (
      lesson.scope !== LessonExperienceScope.ORGANIZATION ||
      !actor.organizationId ||
      lesson.organizationId !== actor.organizationId
    ) {
      throw new NotFoundException('Lesson Experience nenalezena.');
    }
  }

  private assertAuthorRole(actor: JwtPayload) {
    if (actor.systemRole === SystemRole.SUPERADMIN) return;
    const role = activeRole(actor);
    if (
      role !== OrganizationRole.OWNER &&
      role !== OrganizationRole.DIRECTOR &&
      role !== OrganizationRole.TEACHER
    ) {
      throw new ForbiddenException('Lesson Experience authoring není pro tuto roli povolený.');
    }
  }

  private assertPublisherRole(actor: JwtPayload) {
    if (actor.systemRole === SystemRole.SUPERADMIN) return;
    const role = activeRole(actor);
    if (role !== OrganizationRole.OWNER && role !== OrganizationRole.DIRECTOR) {
      throw new ForbiddenException('Lesson Experience publication vyžaduje vedení školy.');
    }
  }

  private assertPublisherForLesson(
    lesson: { scope: LessonExperienceScope; organizationId: string | null },
    actor: JwtPayload,
  ) {
    this.assertPublisherRole(actor);
    this.assertTenantOrPlatform(lesson, actor);
  }

  private assertPlatformSuperadmin(actor: JwtPayload) {
    if (actor.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Globální Lesson Experience governance je dostupná pouze SUPERADMIN.',
      );
    }
  }

  private requireOrganization(actor: JwtPayload) {
    if (!actor.organizationId) {
      throw new ForbiddenException('Aktivní organizace je povinná.');
    }
    return actor.organizationId;
  }
}
