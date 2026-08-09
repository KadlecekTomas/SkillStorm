import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCurriculumMappingStatus,
  ActivityScope,
  ActivityVersionStatus,
  AuditEntityType,
  CurriculumFrameworkReleaseStatus,
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
import {
  listActivityEngines,
  validateActivityEngineCompatibility,
} from './activity-engine.registry';
import { validateActivityPublicationMetadata } from './activity-publication';
import type {
  CreateActivityDto,
  CreateActivityVersionDto,
  ProposeActivityCurriculumMappingDto,
  ReviewActivityCurriculumMappingDto,
} from './dto/activity.dto';

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

function contentChecksum(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function activeRole(actor: JwtPayload): OrganizationRole | undefined {
  return actor.activeRole ?? actor.organizationRole;
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listEngines() {
    return listActivityEngines();
  }

  async listAvailable(actor: JwtPayload) {
    const publishedGlobal = await this.prisma.activity.findMany({
      where: {
        scope: ActivityScope.GLOBAL,
        deletedAt: null,
        versions: { some: { status: ActivityVersionStatus.PUBLISHED } },
      },
      include: {
        versions: {
          where: { status: ActivityVersionStatus.PUBLISHED },
          orderBy: { versionNo: 'desc' },
          select: {
            id: true,
            versionNo: true,
            status: true,
            engineKey: true,
            schemaVersion: true,
            title: true,
            supportedModes: true,
            recommendedMode: true,
            contentChecksum: true,
            publishedAt: true,
          },
        },
      },
    });

    const local = actor.organizationId
      ? await this.prisma.activity.findMany({
          where: {
            scope: ActivityScope.ORGANIZATION,
            organizationId: actor.organizationId,
            deletedAt: null,
          },
          include: {
            versions: {
              orderBy: { versionNo: 'desc' },
              select: {
                id: true,
                versionNo: true,
                status: true,
                engineKey: true,
                schemaVersion: true,
                title: true,
                supportedModes: true,
                recommendedMode: true,
                contentChecksum: true,
                publishedAt: true,
              },
            },
          },
        })
      : [];

    return [...publishedGlobal, ...local].sort((a, b) =>
      a.title.localeCompare(b.title, 'cs'),
    );
  }

  async listPlatformActivities(actor: JwtPayload) {
    this.assertPlatformSuperadmin(actor);
    return this.prisma.activity.findMany({
      where: { scope: ActivityScope.GLOBAL, deletedAt: null },
      orderBy: { title: 'asc' },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            curriculumMappings: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
  }

  createOrganizationActivity(dto: CreateActivityDto, actor: JwtPayload) {
    this.assertAuthorRole(actor);
    const organizationId = this.requireOrganization(actor);
    return this.createActivity(
      dto,
      actor,
      ActivityScope.ORGANIZATION,
      organizationId,
    );
  }

  createGlobalActivity(dto: CreateActivityDto, actor: JwtPayload) {
    this.assertPlatformSuperadmin(actor);
    return this.createActivity(dto, actor, ActivityScope.GLOBAL, null);
  }

  private async createActivity(
    dto: CreateActivityDto,
    actor: JwtPayload,
    scope: ActivityScope,
    organizationId: string | null,
  ) {
    const slug = dto.slug.trim().toLowerCase();
    const duplicate = await this.prisma.activity.findFirst({
      where: { scope, organizationId, slug, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({ code: 'ACTIVITY_SLUG_EXISTS' });
    }

    const activity = await this.prisma.activity.create({
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
      action: 'ACTIVITY_CREATED',
      entityType: AuditEntityType.ACTIVITY,
      entityId: activity.id,
      userId: actor.userId,
      organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({ activityId: activity.id, scope }),
    });
    return activity;
  }

  async getActivity(activityId: string, actor: JwtPayload) {
    const activity = await this.requireVisibleActivity(activityId, actor);
    const exposeAllVersions =
      actor.systemRole === SystemRole.SUPERADMIN ||
      activity.scope === ActivityScope.ORGANIZATION;

    return this.prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
      include: {
        versions: {
          ...(exposeAllVersions
            ? {}
            : { where: { status: ActivityVersionStatus.PUBLISHED } }),
          orderBy: { versionNo: 'desc' },
          include: {
            curriculumMappings: {
              ...(exposeAllVersions
                ? {}
                : {
                    where: {
                      status: ActivityCurriculumMappingStatus.APPROVED,
                    },
                  }),
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                frameworkOutcomeId: true,
                outcomeAspectId: true,
                mappingType: true,
                status: true,
                proposedByType: true,
                frameworkReleaseId: true,
                reviewedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async getPlatformActivity(activityId: string, actor: JwtPayload) {
    this.assertPlatformSuperadmin(actor);
    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        scope: ActivityScope.GLOBAL,
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            curriculumMappings: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!activity) throw new NotFoundException('Activity nenalezena.');
    return activity;
  }

  async createVersion(
    activityId: string,
    dto: CreateActivityVersionDto,
    actor: JwtPayload,
  ) {
    const activity = await this.requireAuthorableActivity(activityId, actor);
    validateActivityEngineCompatibility({
      engineKey: dto.engineKey,
      schemaVersion: dto.schemaVersion,
      supportedModes: dto.supportedModes,
      recommendedMode: dto.recommendedMode,
      primitives: dto.interactionPrimitives,
      config: dto.config,
    });

    const snapshot = {
      engineKey: dto.engineKey,
      schemaVersion: dto.schemaVersion,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      supportedModes: [...new Set(dto.supportedModes)].sort(),
      recommendedMode: dto.recommendedMode,
      interactionPrimitives: [...new Set(dto.interactionPrimitives)].sort(),
      config: dto.config,
      capabilityRequirements: dto.capabilityRequirements,
      assetManifest: dto.assetManifest,
      accessibilityPlan: dto.accessibilityPlan,
      hardwareRequirements: dto.hardwareRequirements,
      modePolicy: dto.modePolicy,
      privacyPlan: dto.privacyPlan,
      safetyPlan: dto.safetyPlan,
      offlinePolicy: dto.offlinePolicy,
      evidencePlan: dto.evidencePlan,
      prerequisites: dto.prerequisites ?? null,
    };
    const checksum = contentChecksum(snapshot);

    const existing = await this.prisma.activityVersion.findUnique({
      where: {
        activityId_contentChecksum: {
          activityId: activity.id,
          contentChecksum: checksum,
        },
      },
      select: { id: true, versionNo: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ACTIVITY_VERSION_DUPLICATE_CONTENT',
        existing,
      });
    }

    const version = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${activity.id}, 0))`;

      // Re-check content identity only after the per-Activity transaction lock.
      // The optimistic pre-check above is useful for the common case, but two
      // simultaneous identical requests can both pass it before either writes.
      // This locked check turns that race into the public 409 contract instead
      // of leaking a Prisma/PostgreSQL unique-constraint error.
      const lockedDuplicate = await tx.activityVersion.findUnique({
        where: {
          activityId_contentChecksum: {
            activityId: activity.id,
            contentChecksum: checksum,
          },
        },
        select: { id: true, versionNo: true },
      });
      if (lockedDuplicate) {
        throw new ConflictException({
          code: 'ACTIVITY_VERSION_DUPLICATE_CONTENT',
          existing: lockedDuplicate,
        });
      }

      const latest = await tx.activityVersion.findFirst({
        where: { activityId: activity.id },
        orderBy: { versionNo: 'desc' },
        select: { versionNo: true },
      });
      return tx.activityVersion.create({
        data: {
          activityId: activity.id,
          versionNo: (latest?.versionNo ?? 0) + 1,
          status: ActivityVersionStatus.DRAFT,
          engineKey: snapshot.engineKey,
          schemaVersion: snapshot.schemaVersion,
          title: snapshot.title,
          description: snapshot.description,
          supportedModes: snapshot.supportedModes,
          recommendedMode: snapshot.recommendedMode,
          interactionPrimitives: snapshot.interactionPrimitives,
          config: asJson(snapshot.config),
          capabilityRequirements: asJson(snapshot.capabilityRequirements),
          assetManifest: asJson(snapshot.assetManifest),
          accessibilityPlan: asJson(snapshot.accessibilityPlan),
          hardwareRequirements: asJson(snapshot.hardwareRequirements),
          modePolicy: asJson(snapshot.modePolicy),
          privacyPlan: asJson(snapshot.privacyPlan),
          safetyPlan: asJson(snapshot.safetyPlan),
          offlinePolicy: asJson(snapshot.offlinePolicy),
          evidencePlan: asJson(snapshot.evidencePlan),
          ...(snapshot.prerequisites
            ? { prerequisites: asJson(snapshot.prerequisites) }
            : {}),
          contentChecksum: checksum,
        },
      });
    });

    await this.audit.log({
      action: 'ACTIVITY_VERSION_CREATED',
      entityType: AuditEntityType.ACTIVITY,
      entityId: version.id,
      userId: actor.userId,
      organizationId: activity.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        activityId: activity.id,
        activityVersionId: version.id,
        contentChecksum: checksum,
        engineKey: version.engineKey,
        schemaVersion: version.schemaVersion,
      }),
    });
    return version;
  }

  async proposeMapping(
    versionId: string,
    dto: ProposeActivityCurriculumMappingDto,
    actor: JwtPayload,
  ) {
    const { version, activity } = await this.requireAuthorableVersion(
      versionId,
      actor,
    );
    if (
      version.status !== ActivityVersionStatus.DRAFT &&
      version.status !== ActivityVersionStatus.REVIEW
    ) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_MAPPING_FROZEN' });
    }

    const outcome = await this.prisma.frameworkOutcome.findUnique({
      where: { id: dto.frameworkOutcomeId },
      include: { release: true },
    });
    if (!outcome) throw new NotFoundException('Framework outcome nenalezen.');
    if (
      outcome.release.status !== CurriculumFrameworkReleaseStatus.VERIFIED
    ) {
      throw new ConflictException({
        code: 'ACTIVITY_MAPPING_RELEASE_NOT_VERIFIED',
      });
    }

    let aspectReviewVersion: number | null = null;
    if (dto.outcomeAspectId) {
      const aspect = await this.prisma.outcomeAspect.findUnique({
        where: { id: dto.outcomeAspectId },
      });
      if (!aspect || aspect.frameworkOutcomeId !== outcome.id) {
        throw new BadRequestException({
          code: 'ACTIVITY_MAPPING_ASPECT_OUTCOME_MISMATCH',
        });
      }
      if (aspect.status !== OutcomeAspectStatus.ACTIVE) {
        throw new ConflictException({
          code: 'ACTIVITY_MAPPING_ASPECT_RETIRED',
        });
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

    const mapping = await this.prisma.activityCurriculumMapping.create({
      data: {
        activityVersionId: version.id,
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
      action: 'ACTIVITY_CURRICULUM_MAPPING_PROPOSED',
      entityType: AuditEntityType.ACTIVITY,
      entityId: mapping.id,
      userId: actor.userId,
      organizationId: activity.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        activityVersionId: version.id,
        mappingId: mapping.id,
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
    dto: ReviewActivityCurriculumMappingDto,
    actor: JwtPayload,
  ) {
    const mapping = await this.prisma.activityCurriculumMapping.findUnique({
      where: { id: mappingId },
      include: { activityVersion: { include: { activity: true } } },
    });
    if (!mapping) {
      throw new NotFoundException('Activity curriculum mapping nenalezen.');
    }
    this.assertPublisherForActivity(mapping.activityVersion.activity, actor);
    if (
      mapping.activityVersion.status !== ActivityVersionStatus.DRAFT &&
      mapping.activityVersion.status !== ActivityVersionStatus.REVIEW
    ) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_MAPPING_FROZEN' });
    }
    if (mapping.status !== ActivityCurriculumMappingStatus.PROPOSED) {
      throw new ConflictException({ code: 'ACTIVITY_MAPPING_ALREADY_REVIEWED' });
    }

    const reviewed = await this.prisma.activityCurriculumMapping.update({
      where: { id: mapping.id },
      data: {
        status: dto.status,
        reviewRationale: dto.rationale.trim(),
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'ACTIVITY_CURRICULUM_MAPPING_REVIEWED',
      entityType: AuditEntityType.ACTIVITY,
      entityId: reviewed.id,
      userId: actor.userId,
      organizationId: mapping.activityVersion.activity.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        activityVersionId: mapping.activityVersionId,
        mappingId: reviewed.id,
        status: reviewed.status,
      }),
    });
    return reviewed;
  }

  async submitForReview(versionId: string, actor: JwtPayload) {
    const { version, activity } = await this.requireAuthorableVersion(
      versionId,
      actor,
    );
    if (version.status !== ActivityVersionStatus.DRAFT) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_NOT_DRAFT' });
    }
    validateActivityPublicationMetadata(version);
    const review = await this.prisma.activityVersion.update({
      where: { id: version.id },
      data: {
        status: ActivityVersionStatus.REVIEW,
        reviewedAt: new Date(),
        reviewedBy: actor.userId,
      },
    });

    await this.audit.log({
      action: 'ACTIVITY_VERSION_SUBMITTED_FOR_REVIEW',
      entityType: AuditEntityType.ACTIVITY,
      entityId: review.id,
      userId: actor.userId,
      organizationId: activity.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        activityId: activity.id,
        activityVersionId: review.id,
        contentChecksum: review.contentChecksum,
      }),
    });
    return review;
  }

  async publish(versionId: string, actor: JwtPayload) {
    const { version, activity } = await this.requirePublishableVersion(
      versionId,
      actor,
    );
    if (version.status !== ActivityVersionStatus.REVIEW) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_NOT_IN_REVIEW' });
    }
    validateActivityPublicationMetadata(version);

    const mappings = await this.prisma.activityCurriculumMapping.findMany({
      where: { activityVersionId: version.id },
      include: {
        frameworkOutcome: true,
        outcomeAspect: true,
        frameworkRelease: true,
      },
    });
    if (
      mappings.some(
        (mapping) =>
          mapping.status === ActivityCurriculumMappingStatus.PROPOSED,
      )
    ) {
      throw new ConflictException({
        code: 'ACTIVITY_PUBLICATION_MAPPING_REVIEW_PENDING',
      });
    }

    const approved = mappings.filter(
      (mapping) => mapping.status === ActivityCurriculumMappingStatus.APPROVED,
    );
    if (approved.length === 0) {
      throw new ConflictException({
        code: 'ACTIVITY_PUBLICATION_CURRICULUM_MAPPING_REQUIRED',
      });
    }
    for (const mapping of approved) {
      if (
        mapping.frameworkRelease.status !==
          CurriculumFrameworkReleaseStatus.VERIFIED ||
        mapping.frameworkOutcome.checksum !== mapping.frameworkOutcomeChecksum ||
        (mapping.outcomeAspect &&
          (mapping.outcomeAspect.status !== OutcomeAspectStatus.ACTIVE ||
            mapping.outcomeAspect.reviewVersion !==
              mapping.outcomeAspectReviewVersion))
      ) {
        throw new ConflictException({
          code: 'ACTIVITY_PUBLICATION_MAPPING_STALE',
        });
      }
    }

    const published = await this.prisma.activityVersion.update({
      where: { id: version.id },
      data: {
        status: ActivityVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: actor.userId,
      },
    });
    await this.audit.log({
      action: 'ACTIVITY_VERSION_PUBLISHED',
      entityType: AuditEntityType.ACTIVITY,
      entityId: published.id,
      userId: actor.userId,
      organizationId: activity.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        activityId: activity.id,
        activityVersionId: published.id,
        contentChecksum: published.contentChecksum,
        engineKey: published.engineKey,
        schemaVersion: published.schemaVersion,
      }),
    });
    return published;
  }

  async retire(versionId: string, actor: JwtPayload) {
    const { version, activity } = await this.requirePublishableVersion(
      versionId,
      actor,
    );
    if (version.status !== ActivityVersionStatus.PUBLISHED) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_NOT_PUBLISHED' });
    }
    const retired = await this.prisma.activityVersion.update({
      where: { id: version.id },
      data: { status: ActivityVersionStatus.RETIRED },
    });
    await this.audit.log({
      action: 'ACTIVITY_VERSION_RETIRED',
      entityType: AuditEntityType.ACTIVITY,
      entityId: retired.id,
      userId: actor.userId,
      organizationId: activity.organizationId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        activityId: activity.id,
        activityVersionId: retired.id,
        contentChecksum: retired.contentChecksum,
      }),
    });
    return retired;
  }

  private async requireVisibleActivity(activityId: string, actor: JwtPayload) {
    if (actor.systemRole === SystemRole.SUPERADMIN) {
      const platformVisible = await this.prisma.activity.findFirst({
        where: { id: activityId, deletedAt: null },
      });
      if (!platformVisible) throw new NotFoundException('Activity nenalezena.');
      return platformVisible;
    }

    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        deletedAt: null,
        OR: [
          {
            scope: ActivityScope.GLOBAL,
            versions: { some: { status: ActivityVersionStatus.PUBLISHED } },
          },
          ...(actor.organizationId
            ? [
                {
                  scope: ActivityScope.ORGANIZATION,
                  organizationId: actor.organizationId,
                },
              ]
            : []),
        ],
      },
    });
    if (!activity) throw new NotFoundException('Activity nenalezena.');
    return activity;
  }

  private async requireAuthorableActivity(
    activityId: string,
    actor: JwtPayload,
  ) {
    this.assertAuthorRole(actor);
    const activity = await this.requireVisibleActivity(activityId, actor);
    this.assertTenantOrPlatform(activity, actor);
    return activity;
  }

  private async requireAuthorableVersion(versionId: string, actor: JwtPayload) {
    this.assertAuthorRole(actor);
    const version = await this.prisma.activityVersion.findUnique({
      where: { id: versionId },
      include: { activity: true },
    });
    if (!version || version.activity.deletedAt) {
      throw new NotFoundException('ActivityVersion nenalezena.');
    }
    this.assertTenantOrPlatform(version.activity, actor);
    return { version, activity: version.activity };
  }

  private async requirePublishableVersion(
    versionId: string,
    actor: JwtPayload,
  ) {
    this.assertPublisherRole(actor);
    const version = await this.prisma.activityVersion.findUnique({
      where: { id: versionId },
      include: { activity: true },
    });
    if (!version || version.activity.deletedAt) {
      throw new NotFoundException('ActivityVersion nenalezena.');
    }
    this.assertTenantOrPlatform(version.activity, actor);
    return { version, activity: version.activity };
  }

  private assertTenantOrPlatform(
    activity: { scope: ActivityScope; organizationId: string | null },
    actor: JwtPayload,
  ) {
    if (actor.systemRole === SystemRole.SUPERADMIN) return;
    if (
      activity.scope !== ActivityScope.ORGANIZATION ||
      !actor.organizationId ||
      activity.organizationId !== actor.organizationId
    ) {
      throw new NotFoundException('Activity nenalezena.');
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
      throw new ForbiddenException(
        'Activity authoring není pro tuto roli povolený.',
      );
    }
  }

  private assertPublisherRole(actor: JwtPayload) {
    if (actor.systemRole === SystemRole.SUPERADMIN) return;
    const role = activeRole(actor);
    if (role !== OrganizationRole.OWNER && role !== OrganizationRole.DIRECTOR) {
      throw new ForbiddenException(
        'Activity publication vyžaduje vedení školy.',
      );
    }
  }

  private assertPublisherForActivity(
    activity: { scope: ActivityScope; organizationId: string | null },
    actor: JwtPayload,
  ) {
    this.assertPublisherRole(actor);
    this.assertTenantOrPlatform(activity, actor);
  }

  private assertPlatformSuperadmin(actor: JwtPayload) {
    if (actor.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException(
        'Globální Activity governance je dostupná pouze SUPERADMIN.',
      );
    }
  }

  private requireOrganization(actor: JwtPayload): string {
    if (!actor.organizationId) {
      throw new ForbiddenException('Aktivní organizace je povinná.');
    }
    return actor.organizationId;
  }
}
