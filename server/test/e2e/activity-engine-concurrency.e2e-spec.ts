import { INestApplication } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  ActivityDeliveryMode,
  OrganizationRole,
  OrganizationStatus,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import { ActivityService } from '@/activity-engine/activity.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

function candidate(title: string, modes = [
  ActivityDeliveryMode.BOARD_ONLY,
  ActivityDeliveryMode.SHARED_DEVICES,
]) {
  return {
    engineKey: 'CORE_INTERACTION_V1',
    schemaVersion: 1,
    title,
    supportedModes: modes,
    recommendedMode: ActivityDeliveryMode.BOARD_ONLY,
    interactionPrimitives: ['PREDICT', 'CHECKPOINT', 'REFLECT'],
    config: { kind: 'PREDICT', prompt: `Predikce: ${title}`, content: {} },
    capabilityRequirements: { required: ['SEMANTIC_EVENTS'] },
    assetManifest: { assets: [] },
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
        evidenceEquivalent: true,
        fallback: 'Board fallback',
      },
      SHARED_DEVICES: {
        preservesObjective: true,
        evidenceEquivalent: true,
        fallback: 'Shared fallback',
      },
    },
    privacyPlan: {
      storedData: ['prediction'],
      rawMediaStorage: false,
      retentionPolicy: 'school-policy',
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
      maxOfflineSeconds: 120,
      fallback: 'Continue locally',
    },
    evidencePlan: {
      completionIsMastery: false as const,
      signals: [
        {
          type: 'PREDICTION_SUBMITTED',
          objectiveReference: 'test-objective',
          interpretation: 'Prediction evidence only',
          rawOrDerived: 'RAW',
        },
      ],
    },
  };
}

describe('ActivityVersion concurrency and content identity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let activities: ActivityService;
  let actor: JwtPayload;
  let activityId = '';

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    activities = app.get(ActivityService);
    await prisma.$connect();

    const ctx = await setupOrgContext(app, prisma, {
      role: 'TEACHER',
      seed: `activity_concurrency_${Date.now()}`,
    });
    await prisma.organization.update({
      where: { id: ctx.organization.id },
      data: { status: OrganizationStatus.ACTIVE },
    });
    actor = {
      userId: ctx.actor.user.id,
      email: ctx.actor.user.email,
      organizationId: ctx.organization.id,
      membershipId: ctx.actor.membership.id,
      organizationRole: OrganizationRole.TEACHER,
      activeRole: OrganizationRole.TEACHER,
    };

    const activity = await activities.createOrganizationActivity(
      {
        slug: `concurrency-${Date.now()}`,
        title: 'Concurrency fixture',
      },
      actor,
    );
    activityId = activity.id;
  });

  afterAll(async () => {
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        await tx.activityCurriculumMapping.deleteMany({
          where: { activityVersion: { activityId } },
        });
        await tx.activityVersion.deleteMany({ where: { activityId } });
        await tx.activity.deleteMany({ where: { id: activityId } });
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('treats mode and primitive ordering as the same content identity', async () => {
    const first = await activities.createVersion(activityId, candidate('Base'), actor);
    expect(first.versionNo).toBe(1);

    const reordered: any = candidate('Base', [
      ActivityDeliveryMode.SHARED_DEVICES,
      ActivityDeliveryMode.BOARD_ONLY,
    ]);
    reordered.interactionPrimitives = ['REFLECT', 'PREDICT', 'CHECKPOINT'];

    await expect(
      activities.createVersion(activityId, reordered, actor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('serializes concurrent version numbering without collisions', async () => {
    const [left, right] = await Promise.all([
      activities.createVersion(activityId, candidate('Concurrent A'), actor),
      activities.createVersion(activityId, candidate('Concurrent B'), actor),
    ]);

    expect([left.versionNo, right.versionNo].sort((a, b) => a - b)).toEqual([2, 3]);
  });
});
