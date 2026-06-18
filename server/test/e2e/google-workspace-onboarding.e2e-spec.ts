import {
  EnrollmentStatus,
  ExternalIdentityType,
  IntegrationProvider,
  IntegrationStatus,
  OrganizationRole,
  OrganizationStatus,
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
  type MockDirectoryData,
} from '@/integrations/google-workspace/directory/mock-google-workspace-directory.client';
import type { GoogleWorkspaceCommitImportDto } from '@/integrations/google-workspace/dto/google-workspace-commit-import.dto';

/**
 * Integration coverage for the Google Workspace onboarding commit engine.
 * Runs against the real (reset) test database via PrismaService with a mocked
 * directory client and lightweight stubs for config/encryption/audit — no
 * network and no full Nest HTTP harness.
 */
describe('Google Workspace onboarding (commit engine)', () => {
  const prisma = new PrismaService();

  const audit = { log: jest.fn(async () => undefined) } as unknown as AuditService;
  const academicYears = {} as AcademicYearsService;
  const config = {
    isConfigured: () => true,
    scopes: ['scope.readonly'],
  } as unknown as GoogleWorkspaceConfigService;
  // Identity encryption stub — the commit engine never goes to the network
  // because we seed a valid (future-dated) access token.
  const encryption = {
    encrypt: (s: string) => s,
    decrypt: (s: string) => s,
  } as unknown as TokenEncryptionService;

  let data: MockDirectoryData;
  let factory: MockGoogleWorkspaceDirectoryClientFactory;
  let service: GoogleWorkspaceService;

  let orgId: string;
  let yearId: string;
  const actorUserId = 'actor-user';

  const options = {
    createMissingUsers: true,
    updateExistingUsers: true,
    deactivateMissingEnrollments: false,
    respectManualOverrides: true,
  };

  const oauthState = {
    sign: () => 'state',
    verify: () => null,
  } as unknown as OAuthStateService;

  function buildService() {
    factory = new MockGoogleWorkspaceDirectoryClientFactory(data);
    service = new GoogleWorkspaceService(
      prisma,
      audit,
      academicYears,
      config,
      encryption,
      oauthState,
      factory,
    );
  }

  async function commitDto(
    deactivate = false,
  ): Promise<GoogleWorkspaceCommitImportDto> {
    const preview = await service.preview(orgId, actorUserId, {
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
      options: { ...options, deactivateMissingEnrollments: deactivate },
    };
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: 'Test School', status: OrganizationStatus.ACTIVE },
      select: { id: true },
    });
    orgId = org.id;
    const year = await prisma.academicYear.create({
      data: {
        orgId,
        label: '2025/2026',
        startsAt: new Date('2025-09-01'),
        endsAt: new Date('2026-06-30'),
        isCurrent: true,
      },
      select: { id: true },
    });
    yearId = year.id;

    await prisma.organizationIntegration.create({
      data: {
        organizationId: orgId,
        provider: IntegrationProvider.GOOGLE_WORKSPACE,
        status: IntegrationStatus.CONNECTED,
        scopes: ['scope.readonly'],
        encryptedAccessToken: 'access-token',
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
      },
    });
  });

  beforeEach(() => {
    data = buildDefaultMockData();
    buildService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('commit creates users, memberships, students, class sections and enrollments', async () => {
    const result = await service.commit(orgId, actorUserId, await commitDto());

    expect(result.summary.usersCreated).toBe(4);
    expect(result.summary.membershipsCreated).toBe(4);
    expect(result.summary.studentsCreated).toBe(2);
    expect(result.summary.teachersCreated).toBe(2); // teacher + director
    expect(result.summary.classSectionsCreated).toBe(1);
    expect(result.summary.enrollmentsCreated).toBe(2);

    const memberships = await prisma.membership.count({
      where: { organizationId: orgId },
    });
    expect(memberships).toBe(4);

    const director = await prisma.membership.findFirst({
      where: { organizationId: orgId, role: OrganizationRole.DIRECTOR },
    });
    expect(director).toBeTruthy();
  });

  it('second commit is idempotent — no duplicate users/memberships/enrollments', async () => {
    const result = await service.commit(orgId, actorUserId, await commitDto());

    expect(result.summary.usersCreated).toBe(0);
    expect(result.summary.membershipsCreated).toBe(0);
    expect(result.summary.enrollmentsCreated).toBe(0);

    expect(
      await prisma.user.count({
        where: { memberships: { some: { organizationId: orgId } } },
      }),
    ).toBe(4);
    expect(
      await prisma.enrollment.count({ where: { orgId, yearId } }),
    ).toBe(2);
    expect(
      await prisma.classSection.count({ where: { orgId, yearId } }),
    ).toBe(1);
  });

  it('preserves identity across a Google e-mail change (matched by externalId)', async () => {
    const before = await prisma.externalIdentity.findFirst({
      where: {
        organizationId: orgId,
        type: ExternalIdentityType.USER,
        externalId: 'g-user-1',
      },
      select: { userId: true },
    });
    expect(before?.userId).toBeTruthy();

    // Alice changes her primary e-mail in Google; the immutable id is stable.
    data.users = data.users.map((u) =>
      u.id === 'g-user-1'
        ? { ...u, primaryEmail: 'alice.newname@skola.cz' }
        : u,
    );
    buildService();

    const result = await service.commit(orgId, actorUserId, await commitDto());
    expect(result.summary.usersCreated).toBe(0); // no new account

    const after = await prisma.externalIdentity.findFirst({
      where: {
        organizationId: orgId,
        type: ExternalIdentityType.USER,
        externalId: 'g-user-1',
      },
      select: { userId: true, externalEmail: true },
    });
    expect(after?.userId).toBe(before?.userId);
    expect(after?.externalEmail).toBe('alice.newname@skola.cz');
  });

  it('marks a vanished student as LEFT instead of deleting the enrollment', async () => {
    // Bob (g-user-2) leaves the class group in Google.
    data.members['g-group-7a'] = data.members['g-group-7a']!.filter(
      (m) => m.id !== 'g-user-2',
    );
    buildService();

    const result = await service.commit(
      orgId,
      actorUserId,
      await commitDto(true),
    );
    expect(result.summary.enrollmentsDeactivated).toBe(1);

    const bobIdentity = await prisma.externalIdentity.findFirst({
      where: {
        organizationId: orgId,
        type: ExternalIdentityType.USER,
        externalId: 'g-user-2',
      },
      select: { membership: { select: { student: { select: { id: true } } } } },
    });
    const bobStudentId = bobIdentity?.membership?.student?.id;
    expect(bobStudentId).toBeTruthy();
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: bobStudentId ?? '', yearId },
      select: { status: true },
    });
    expect(enrollment).toBeTruthy();
    expect(enrollment?.status).toBe(EnrollmentStatus.LEFT);
  });

  it('status never returns token material', async () => {
    const status = (await service.getStatus(orgId)) as Record<string, unknown>;
    expect(JSON.stringify(status)).not.toContain('access-token');
    expect(status).not.toHaveProperty('encryptedAccessToken');
    expect(status).not.toHaveProperty('encryptedRefreshToken');
  });
});
