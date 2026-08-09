import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  MappingProposerType,
  OrganizationRole,
  OrganizationStatus,
  SystemRole,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { ActivityService } from '@/activity-engine/activity.service';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

function schoolActor(ctx: any): JwtPayload {
  return {
    userId: ctx.owner.user.id,
    email: ctx.owner.user.email,
    organizationId: ctx.organization.id,
    membershipId: ctx.owner.membership.id,
    organizationRole: OrganizationRole.DIRECTOR,
    activeRole: OrganizationRole.DIRECTOR,
  };
}

function platformActor(ctx: any): JwtPayload {
  return {
    userId: ctx.owner.user.id,
    email: ctx.owner.user.email,
    systemRole: SystemRole.SUPERADMIN,
    isPlatformAdmin: true,
  };
}

function versionInput() {
  return {
    engineKey: 'CORE_INTERACTION_V1',
    schemaVersion: 1,
    title: 'Predikce datového modelu',
    description: 'Reusable D2-A test activity',
    supportedModes: [
      ActivityDeliveryMode.BOARD_ONLY,
      ActivityDeliveryMode.SHARED_DEVICES,
    ],
    recommendedMode: ActivityDeliveryMode.SHARED_DEVICES,
    interactionPrimitives: ['PREDICT', 'CHECKPOINT', 'REFLECT'],
    config: {
      kind: 'PREDICT',
      prompt: 'Jaký model bys zvolil a proč?',
      content: {},
    },
    capabilityRequirements: { required: ['SEMANTIC_EVENTS', 'RECONNECTABLE'] },
    assetManifest: {
      assets: [
        {
          id: 'diagram',
          kind: 'IMAGE',
          source: 'skillstorm://test/diagram',
          rightsBasis: 'SkillStorm original test fixture',
          commercialUse: true,
        },
      ],
    },
    accessibilityPlan: {
      keyboardPath: true,
      touchPath: true,
      reducedMotion: true,
      nonColorCues: true,
      instructionAlternative: true,
      dragAlternative: true,
    },
    hardwareRequirements: {
      minDevices: 0,
      microphone: 'NONE',
      camera: 'NONE',
      webgl: 'NONE',
      pointer: 'ANY',
    },
    modePolicy: {
      BOARD_ONLY: {
        preservesObjective: true,
        evidenceEquivalent: false,
        fallback: 'Teacher-led board discussion.',
      },
      SHARED_DEVICES: {
        preservesObjective: true,
        evidenceEquivalent: true,
        fallback: 'Groups continue on the board.',
      },
    },
    privacyPlan: {
      storedData: ['prediction', 'checkpoint'],
      rawMediaStorage: false,
      retentionPolicy: 'inherit-school-learning-evidence-policy',
    },
    safetyPlan: {
      riskLevel: 'LOW',
      reviewLane: 'standard-pedagogy',
      teacherGate: false,
    },
    offlinePolicy: {
      mode: 'QUEUE_EVENTS',
      reconnectable: true,
      deduplicatesByEventId: true,
      maxOfflineSeconds: 300,
      fallback: 'Continue locally and retry semantic events.',
    },
    evidencePlan: {
      completionIsMastery: false as const,
      signals: [
        {
          type: 'PREDICTION_SUBMITTED',
          objectiveReference: 'INF-OVU-E2E',
          interpretation: 'Initial model evidence only.',
          rawOrDerived: 'RAW',
        },
      ],
    },
  };
}

describe('Activity Engine D2-A invariants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let activities: ActivityService;
  let curriculum: CurriculumService;
  let orgA: any;
  let orgB: any;
  let actorA: JwtPayload;
  let actorB: JwtPayload;
  let platform: JwtPayload;
  let frameworkId = '';
  let releaseId = '';
  let outcomeId = '';
  let aspectId = '';
  let activityId = '';
  let versionId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    activities = app.get(ActivityService);
    curriculum = app.get(CurriculumService);
    await prisma.$connect();

    orgA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `activity_a_${Date.now()}`,
    });
    orgB = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `activity_b_${Date.now()}`,
    });
    await prisma.organization.updateMany({
      where: { id: { in: [orgA.organization.id, orgB.organization.id] } },
      data: { status: OrganizationStatus.ACTIVE },
    });
    actorA = schoolActor(orgA);
    actorB = schoolActor(orgB);
    platform = platformActor(orgA);

    const framework = await curriculum.createFramework(
      {
        code: `ACT-E2E-${Date.now()}`,
        jurisdiction: 'CZ',
        educationType: 'ZV',
        title: 'Activity E2E framework',
        authorityName: 'E2E',
      },
      platform,
    );
    frameworkId = framework.id;
    const release = await curriculum.importFrameworkRelease(
      framework.code,
      {
        releaseCode: 'activity-e2e-v1',
        title: 'Activity E2E v1',
        sourceUrl: 'https://example.invalid/activity-e2e',
        sourceAuthority: 'E2E',
        areas: [
          {
            externalCode: 'INF',
            title: 'Informatika',
            sortOrder: 1,
            fields: [
              {
                externalCode: 'INF-DATA',
                title: 'Data',
                sortOrder: 1,
                outcomes: [
                  {
                    externalCode: 'INF-OVU-E2E',
                    title: 'Žák vytváří a interpretuje model.',
                    nodeGrade: 9,
                    aspects: [
                      {
                        code: 'MODEL',
                        title: 'Model',
                        description: 'Vytvoří a zdůvodní model.',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      platform,
    );
    releaseId = release.id;
    outcomeId = release.outcomes[0]!.id;
    aspectId = release.outcomes[0]!.aspects[0]!.id;
    await curriculum.verifyFrameworkRelease(releaseId, platform);
  });

  afterAll(async () => {
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
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

  it('keeps organization Activities tenant-scoped', async () => {
    const created = await activities.createOrganizationActivity(
      {
        slug: `data-model-${Date.now()}`,
        title: 'Datový model',
      },
      actorA,
    );
    activityId = created.id;
    await expect(activities.getActivity(activityId, actorB)).rejects.toMatchObject({ status: 404 });
  });

  it('creates content-addressed immutable versions and rejects duplicates', async () => {
    const version = await activities.createVersion(activityId, versionInput(), actorA);
    versionId = version.id;
    expect(version.versionNo).toBe(1);
    expect(version.contentChecksum).toMatch(/^[a-f0-9]{64}$/);

    await expect(
      activities.createVersion(activityId, versionInput(), actorA),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('requires reviewed canonical mapping before publication', async () => {
    const mapping = await activities.proposeMapping(
      versionId,
      {
        frameworkOutcomeId: outcomeId,
        outcomeAspectId: aspectId,
        mappingType: ActivityCurriculumMappingType.PRIMARY,
        rationale: 'Activity directly measures the model aspect.',
        proposedByType: MappingProposerType.HUMAN,
      },
      actorA,
    );

    await activities.submitForReview(versionId, actorA);
    await expect(activities.publish(versionId, actorA)).rejects.toMatchObject({ status: 409 });

    const reviewed = await activities.reviewMapping(
      mapping.id,
      {
        status: ActivityCurriculumMappingStatus.APPROVED,
        rationale: 'Pedagogically reviewed for the mapped aspect.',
      },
      actorA,
    );
    expect(reviewed.status).toBe(ActivityCurriculumMappingStatus.APPROVED);

    const published = await activities.publish(versionId, actorA);
    expect(published.status).toBe('PUBLISHED');
  });

  it('keeps published ActivityVersion content immutable even through raw SQL', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE activity_versions SET title = $1 WHERE activity_version_id = $2::text',
        'Tampered title',
        versionId,
      ),
    ).rejects.toThrow(/ACTIVITY_VERSION_CONTENT_IMMUTABLE/);

    await expect(
      prisma.$executeRawUnsafe(
        'DELETE FROM activity_versions WHERE activity_version_id = $1::text',
        versionId,
      ),
    ).rejects.toThrow(/ACTIVITY_VERSION_IMMUTABLE/);
  });

  it('freezes mappings after publication and allows retirement only as lifecycle metadata', async () => {
    await expect(
      activities.proposeMapping(
        versionId,
        {
          frameworkOutcomeId: outcomeId,
          mappingType: ActivityCurriculumMappingType.RELATED,
          rationale: 'Late mapping must be rejected after publication.',
        },
        actorA,
      ),
    ).rejects.toMatchObject({ status: 409 });

    const retired = await activities.retire(versionId, actorA);
    expect(retired.status).toBe('RETIRED');
  });

  it('does not allow a school actor to create global content', async () => {
    await expect(
      activities.createGlobalActivity(
        { slug: 'forbidden-global', title: 'Forbidden global' },
        actorA,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
