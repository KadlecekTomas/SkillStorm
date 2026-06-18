import { ConflictException } from '@nestjs/common';
import {
  ExternalIdentityType,
  IntegrationProvider,
  IntegrationStatus,
  OrganizationStatus,
  SyncRunStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { GoogleWorkspaceService } from '@/integrations/google-workspace/google-workspace.service';
import type { GoogleWorkspaceConfigService } from '@/integrations/google-workspace/google-workspace-config.service';
import type { TokenEncryptionService } from '@/integrations/google-workspace/token-encryption.service';
import type { OAuthStateService } from '@/integrations/google-workspace/oauth-state.service';
import type { AuditService } from '@/audit/audit.service';
import type { AcademicYearsService } from '@/academic-years/academic-years.service';
import {
  buildDefaultMockData,
  MockGoogleWorkspaceDirectoryClientFactory,
} from '@/integrations/google-workspace/directory/mock-google-workspace-directory.client';
import type { GoogleWorkspaceCommitImportDto } from '@/integrations/google-workspace/dto/google-workspace-commit-import.dto';

/**
 * Multi-school hardening: tenant uniqueness, same/different-tenant reconnect,
 * cross-org data isolation, shared-identity safety, and the per-org sync lock.
 */
describe('Google Workspace multi-school onboarding', () => {
  const prisma = new PrismaService();

  const audit = { log: jest.fn(async () => undefined) } as unknown as AuditService;
  const academicYears = {} as AcademicYearsService;
  const config = {
    isConfigured: () => true,
    mockMode: false,
    scopes: ['scope.readonly'],
  } as unknown as GoogleWorkspaceConfigService;
  const encryption = {
    encrypt: (s: string) => `enc:${s}`,
    decrypt: (s: string) => s.replace(/^enc:/, ''),
  } as unknown as TokenEncryptionService;
  const oauthState = {
    sign: () => 'state',
    verify: () => null,
  } as unknown as OAuthStateService;

  function makeService(): GoogleWorkspaceService {
    const factory = new MockGoogleWorkspaceDirectoryClientFactory(
      buildDefaultMockData(),
    );
    return new GoogleWorkspaceService(
      prisma,
      audit,
      academicYears,
      config,
      encryption,
      oauthState,
      factory,
    );
  }

  // Each school gets its own service instance (its own fixture directory).
  const serviceA = makeService();
  const serviceB = makeService();

  let orgA: string;
  let orgB: string;
  let orgC: string;
  let yearA: string;
  let yearB: string;

  async function seedOrg(
    name: string,
    customerId: string | null,
  ): Promise<{ orgId: string; yearId: string }> {
    const org = await prisma.organization.create({
      data: { name, status: OrganizationStatus.ACTIVE },
      select: { id: true },
    });
    const year = await prisma.academicYear.create({
      data: {
        orgId: org.id,
        label: '2025/2026',
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: true,
      },
      select: { id: true },
    });
    if (customerId) {
      await prisma.organizationIntegration.create({
        data: {
          organizationId: org.id,
          provider: IntegrationProvider.GOOGLE_WORKSPACE,
          status: IntegrationStatus.CONNECTED,
          customerId,
          scopes: ['scope.readonly'],
          encryptedAccessToken: 'enc:access-token',
          tokenExpiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }
    return { orgId: org.id, yearId: year.id };
  }

  async function commitDto(
    service: GoogleWorkspaceService,
    orgId: string,
    yearId: string,
  ): Promise<GoogleWorkspaceCommitImportDto> {
    const preview = await service.preview(orgId, 'actor', {
      academicYearId: yearId,
    });
    return {
      academicYearId: yearId,
      selectedClassMappings: preview.plan.classes.map((c) => ({
        externalGroupId: c.externalGroupId,
        externalGroupEmail: c.externalGroupEmail,
        externalGroupName: c.externalGroupName,
        grade: c.grade,
        section: c.section,
        label: c.label,
        confidence: c.confidence,
        action: c.action,
        ...(c.existingClassSectionId
          ? { existingClassSectionId: c.existingClassSectionId }
          : {}),
      })),
      selectedRoleMappings: [],
      ignoredExternalIds: [],
      options: {
        createMissingUsers: true,
        updateExistingUsers: true,
        deactivateMissingEnrollments: false,
        respectManualOverrides: true,
      },
    };
  }

  beforeAll(async () => {
    ({ orgId: orgA, yearId: yearA } = await seedOrg('School A', 'customer-a'));
    ({ orgId: orgB, yearId: yearB } = await seedOrg('School B', 'customer-b'));
    ({ orgId: orgC } = await seedOrg('School C', null));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Test A: commits stay isolated per organization', async () => {
    await serviceA.commit(orgA, 'actor', await commitDto(serviceA, orgA, yearA));
    await serviceB.commit(orgB, 'actor', await commitDto(serviceB, orgB, yearB));

    // Class sections never leak across orgs.
    expect(await prisma.classSection.count({ where: { orgId: orgA } })).toBe(1);
    expect(await prisma.classSection.count({ where: { orgId: orgB } })).toBe(1);
    const aSection = await prisma.classSection.findFirst({
      where: { orgId: orgA },
      select: { id: true },
    });
    const bSection = await prisma.classSection.findFirst({
      where: { orgId: orgB },
      select: { id: true },
    });
    expect(aSection?.id).not.toBe(bSection?.id);

    // Enrollments are scoped by org.
    expect(await prisma.enrollment.count({ where: { orgId: orgA } })).toBe(2);
    expect(await prisma.enrollment.count({ where: { orgId: orgB } })).toBe(2);
    const aEnrollments = await prisma.enrollment.findMany({
      where: { orgId: orgA },
      select: { classSectionId: true },
    });
    expect(aEnrollments.every((e) => e.classSectionId === aSection?.id)).toBe(
      true,
    );

    // External identities + sync runs carry their own organizationId.
    const aGroupIdentity = await prisma.externalIdentity.findFirst({
      where: { organizationId: orgA, type: ExternalIdentityType.GROUP },
    });
    expect(aGroupIdentity?.organizationId).toBe(orgA);
    expect(
      await prisma.syncRun.count({
        where: { organizationId: orgA, status: SyncRunStatus.DONE },
      }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.syncRun.findFirst({ where: { organizationId: orgB } }),
    ).toMatchObject({ organizationId: orgB });
  });

  it('Test B: the same Google externalId in two orgs yields two scoped identities', async () => {
    const rows = await prisma.externalIdentity.findMany({
      where: {
        type: ExternalIdentityType.USER,
        externalId: 'g-user-1',
        organizationId: { in: [orgA, orgB] },
      },
      select: { organizationId: true },
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.organizationId))).toEqual(
      new Set([orgA, orgB]),
    );
  });

  it('Test D: connecting an already-claimed tenant fails (CUSTOMER_ALREADY_CONNECTED)', async () => {
    // School C tries to connect customer-a, already owned by School A.
    await expect(
      serviceA.persistConnection({
        orgId: orgC,
        actorUserId: 'actor',
        domain: 'a.skola.cz',
        customerId: 'customer-a',
        accessToken: 'tok',
        refreshToken: null,
        expiresIn: 3600,
      }),
    ).rejects.toMatchObject({
      response: { code: 'GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED' },
    });
    // No integration was persisted for org C.
    expect(
      await prisma.organizationIntegration.count({
        where: { organizationId: orgC },
      }),
    ).toBe(0);
  });

  it('reconnecting the same org to a different tenant fails (TENANT_MISMATCH)', async () => {
    await expect(
      serviceA.persistConnection({
        orgId: orgA,
        actorUserId: 'actor',
        domain: 'a.skola.cz',
        customerId: 'customer-b',
        accessToken: 'tok',
        refreshToken: null,
        expiresIn: 3600,
      }),
    ).rejects.toMatchObject({
      response: { code: 'GOOGLE_WORKSPACE_TENANT_MISMATCH' },
    });
    // School A still bound to its original tenant.
    const a = await prisma.organizationIntegration.findFirst({
      where: { organizationId: orgA },
      select: { customerId: true },
    });
    expect(a?.customerId).toBe('customer-a');
  });

  it('same-org reconnect to the same tenant refreshes tokens without duplicating', async () => {
    await serviceA.persistConnection({
      orgId: orgA,
      actorUserId: 'actor',
      domain: 'a.skola.cz',
      customerId: 'customer-a',
      accessToken: 'rotated-token',
      refreshToken: 'rotated-refresh',
      expiresIn: 3600,
    });
    expect(
      await prisma.organizationIntegration.count({
        where: { organizationId: orgA },
      }),
    ).toBe(1);
    const a = await prisma.organizationIntegration.findFirst({
      where: { organizationId: orgA },
      select: { encryptedAccessToken: true, customerId: true },
    });
    expect(a?.customerId).toBe('customer-a');
    expect(a?.encryptedAccessToken).toBe('enc:rotated-token');
  });

  it('blocks a concurrent sync for the same org, but allows other orgs', async () => {
    // Simulate an in-flight sync for org A.
    const running = await prisma.syncRun.create({
      data: {
        organizationId: orgA,
        provider: IntegrationProvider.GOOGLE_WORKSPACE,
        status: SyncRunStatus.RUNNING,
      },
      select: { id: true },
    });

    await expect(
      serviceA.commit(orgA, 'actor', await commitDto(serviceA, orgA, yearA)),
    ).rejects.toMatchObject({
      response: { code: 'GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING' },
    });

    // A different school is unaffected (lock is per-org, not global).
    const resultB = await serviceB.commit(
      orgB,
      'actor',
      await commitDto(serviceB, orgB, yearB),
    );
    expect(resultB.status).toBeDefined();

    await prisma.syncRun.delete({ where: { id: running.id } });
  });
});
