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
  OutcomeAspectStatus,
  Prisma,
  SystemRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '@/audit/audit.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  CreateActivityDto,
  CreateActivityVersionDto,
  ProposeActivityCurriculumMappingDto,
  ReviewActivityCurriculumMappingDto,
} from './dto/activity.dto';
import { validateActivityEngineCompatibility } from './activity-engine.registry';
import { validateActivityPublicationMetadata } from './activity-publication';

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

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listEngines() {
    const { listActivityEngines } = require('./activity-engine.registry') as typeof import('./activity-engine.registry');
    return listActivityEngines();
  }

  async listAvailable(actor: JwtPayload) {
    const organizationId = actor.organizationId;
    return this.prisma.activity.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            scope: ActivityScope.GLOBAL,
            versions: { some: { status: ActivityVersionStatus.PUBLISHED } },
          },
          ...(organizationId
            ? [{ scope: ActivityScope.ORGANIZATION, organizationId }]
            : []),
        ],
      },
      orderBy: [{ scope: 'asc' }, { title: 'asc' }],
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
    });
  }

  createOrganizationActivity(dto: CreateActivityDto, actor: JwtPayload) {
    const organizationId = this.requireOrganization(actor);
    return this.createActivity(dto, actor, ActivityScope.ORGANIZATION, organizationId);
  }

  createGlobalActivity(dto: CreateActivityDto, actor: JwtPayload) {
    if (actor.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('Globální Activity může vytvářet pouze SUPERADMIN.');
    }
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
      where: {
        scope,
        organizationId,
        slug,
        deletedAt: null,
      },
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
    return this.prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            curriculumMappings: {
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

  async createVersion(
    activityId: string,
    dto: CreateActivityVersionDto,
    actor: JwtPayload,
  ) {
    const activity = await this.requireManageableActivity(activityId, actor);
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
      supportedModes: [...new Set(dto.supportedModes)],
      recommendedMode: dto.recommendedMode,
      interactionPrimitives: [...new Set(dto.interactionPrimitives)],
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
        activityId_contentChecksum: { activityId: activity.id, contentChecksum: checksum },
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
    const { version, activity } = await this.requireManageableVersion(versionId, actor);
    if (version.status !== ActivityVersionStatus.DRAFT && version.status !== ActivityVersionStatus.REVIEW) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_MAPPING_FROZEN' });
    }

    const outcome = await this.prisma.frameworkOutcome.findUnique({
      where: { id: dto.frameworkOutcomeId },
      include: { release: true },
    });
    if (!outcome) throw new NotFoundException('Framework outcome nenalezen.');
    if (outcome.release.status !== CurriculumFrameworkReleaseStatus.VERIFIED) {
      throw new ConflictException({ code: 'ACTIVITY_MAPPING_RELEASE_NOT_VERIFIED' });
    }

    let aspectReviewVersion: number | null = null;
    if (dto.outcomeAspectId) {
      const aspect = await this.prisma.outcomeAspect.findUnique({
        where: { id: dto.outcomeAspectId },
      });
      if (!aspect || aspect.frameworkOutcomeId !== outcome.id) {
        throw new BadRequestException({ code: 'ACTIVITY_MAPPING_ASPECT_OUTCOME_MISMATCH' });
      }
      if (aspect.status !== OutcomeAspectStatus.ACTIVE) {
        throw new ConflictException({ code: 'ACTIVITY_MAPPING_ASPECT_RETIRED' });
      }
      aspectReviewVersion = aspect.reviewVersion;
    }

    const proposedByType = dto.proposedByType ?? MappingProposerType.HUMAN;
    if (proposedByType !== MappingProposerType.HUMAN && actor.systemRole !== SystemRole.SUPERADMIN) {
      throw new ForbiddenException('SYSTEM/AI návrh může zapisovat pouze platformní governance cesta.');
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
    if (!mapping) throw new NotFoundException('Activity curriculum mapping nenalezen.');
    await this.assertCanManage(mapping.activityVersion.activity, actor);
    if (mapping.status !== ActivityCurriculumMappingStatus.PROPOSED) {
      throw new ConflictException({ code: 'ACTIVITY_MAPPING_ALREADY_REVIEWED' });
    }

    return this.prisma.activityCurriculumMapping.update({
      where: { id: mapping.id },
      data: {
        status: dto.status,
        reviewRationale: dto.rationale.trim(),
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
      },
    });
  }

  async submitForReview(versionId: string, actor: JwtPayload) {
    const { version } = await this.requireManageableVersion(versionId, actor);
    if (version.status !== ActivityVersionStatus.DRAFT) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_NOT_DRAFT' });
    }
    validateActivityPublicationMetadata(version);
    return this.prisma.activityVersion.update({
      where: { id: version.id },
      data: {
        status: ActivityVersionStatus.REVIEW,
        reviewedAt: new Date(),
        reviewedBy: actor.userId,
      },
    });
  }

  async publish(versionId: string, actor: JwtPayload) {
    const { version, activity } = await this.requireManageableVersion(versionId, actor);
    if (version.status !== ActivityVersionStatus.REVIEW) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_NOT_IN_REVIEW' });
    }
    validateActivityPublicationMetadata(version);

    const mappings = await this.prisma.activityCurriculumMapping.findMany({
      where: { activityVersionId: version.id },
      include: { frameworkOutcome: true, outcomeAspect: true, frameworkRelease: true },
    });
    const approved = mappings.filter(
      (mapping) => mapping.status === ActivityCurriculumMappingStatus.APPROVED,
    );
    if (approved.length === 0) {
      throw new ConflictException({ code: 'ACTIVITY_PUBLICATION_CURRICULUM_MAPPING_REQUIRED' });
    }
    for (const mapping of approved) {
      if (
        mapping.frameworkRelease.status !== CurriculumFrameworkReleaseStatus.VERIFIED ||
        mapping.frameworkOutcome.checksum !== mapping.frameworkOutcomeChecksum ||
        (mapping.outcomeAspect &&
          (mapping.outcomeAspect.status !== OutcomeAspectStatus.ACTIVE ||
            mapping.outcomeAspect.reviewVersion !== mapping.outcomeAspectReviewVersion))
      ) {
        throw new ConflictException({ code: 'ACTIVITY_PUBLICATION_MAPPING_STALE' });
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
    const { version } = await this.requireManageableVersion(versionId, actor);
    if (version.status !== ActivityVersionStatus.PUBLISHED) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_NOT_PUBLISHED' });
    }
    return this.prisma.activityVersion.update({
      where: { id: version.id },
      data: { status: ActivityVersionStatus.RETIRED },
    });
  }

  private async requireVisibleActivity(activityId: string, actor: JwtPayload) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('Activity nenalezena.');
    if (activity.scope === ActivityScope.GLOBAL) return activity;
    if (!actor.organizationId || activity.organizationId !== actor.organizationId) {
      throw new NotFoundException('Activity nenalezena.');
    }
    return activity;
  }

  private async requireManageableActivity(activityId: string, actor: JwtPayload) {
    const activity = await this.requireVisibleActivity(activityId, actor);
    await this.assertCanManage(activity, actor);
    return activity;
  }

  private async requireManageableVersion(versionId: string, actor: JwtPayload) {
    const version = await this.prisma.activityVersion.findUnique({
      where: { id: versionId },
      include: { activity: true },
    });
    if (!version || version.activity.deletedAt) {
      throw new NotFoundException('ActivityVersion nenalezena.');
    }
    await this.assertCanManage(version.activity, actor);
    return { version, activity: version.activity };
  }

  private async assertCanManage(
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

  private requireOrganization(actor: JwtPayload): string {
    if (!actor.organizationId) {
      throw new ForbiddenException('Aktivní organizace je povinná.');
    }
    return actor.organizationId;
  }
}
