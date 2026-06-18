import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AuditEntityType,
  EnrollmentStatus,
  ExternalIdentityType,
  IntegrationProvider,
  IntegrationStatus,
  OrganizationRole,
  Prisma,
  SchoolGrade,
  SyncIssueSeverity,
  SyncMode,
  SyncRunStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';
import { GoogleWorkspaceConfigService } from './google-workspace-config.service';
import { TokenEncryptionService } from './token-encryption.service';
import { OAuthStateService } from './oauth-state.service';
import {
  GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED,
  GOOGLE_WORKSPACE_DIRECTORY_CLIENT,
  GOOGLE_WORKSPACE_NOT_CONFIGURED,
  GOOGLE_WORKSPACE_REAUTH_REQUIRED,
  GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING,
  GOOGLE_WORKSPACE_TENANT_MISMATCH,
  ONBOARDING_FRONTEND_PATH,
} from './google-workspace.constants';
import type { GoogleWorkspaceDirectoryClientFactory } from './directory/google-workspace-directory.client';
import type {
  DirectoryScope,
  GoogleWorkspaceDirectoryClient,
} from './directory/google-workspace.types';
import {
  buildPreview,
  type ExistingState,
  type GoogleWorkspacePreview,
  type PreviewPatterns,
  type UserPlan,
  type ClassPlan,
} from './mapping/preview-builder';
import type { DetectedRole } from './mapping/role-detector';
import type { GoogleWorkspaceCommitImportDto } from './dto/google-workspace-commit-import.dto';

const PROVIDER = IntegrationProvider.GOOGLE_WORKSPACE;

export interface SyncCounts {
  usersCreated: number;
  usersUpdated: number;
  usersSkipped: number;
  membershipsCreated: number;
  studentsCreated: number;
  teachersCreated: number;
  classSectionsCreated: number;
  enrollmentsCreated: number;
  enrollmentsUpdated: number;
  enrollmentsDeactivated: number;
}

export interface SyncIssueDraft {
  severity: SyncIssueSeverity;
  code: string;
  message: string;
  payload?: Prisma.InputJsonValue;
}

const ROLE_MAP: Record<DetectedRole, OrganizationRole> = {
  STUDENT: OrganizationRole.STUDENT,
  TEACHER: OrganizationRole.TEACHER,
  DIRECTOR: OrganizationRole.DIRECTOR,
};

@Injectable()
export class GoogleWorkspaceService {
  private readonly logger = new Logger(GoogleWorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly academicYears: AcademicYearsService,
    private readonly config: GoogleWorkspaceConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly oauthState: OAuthStateService,
    @Inject(GOOGLE_WORKSPACE_DIRECTORY_CLIENT)
    private readonly directoryFactory: GoogleWorkspaceDirectoryClientFactory,
  ) {}

  // =========================================================================
  // OAUTH: AUTH URL + CALLBACK
  // =========================================================================

  /**
   * Build the consent URL the admin's browser is redirected to. The returned
   * URL embeds a signed `state` binding (orgId + userId). In mock mode it
   * points at the dev mock-connect endpoint instead of Google. Throws a 503
   * with code GOOGLE_WORKSPACE_NOT_CONFIGURED when the OAuth env is missing.
   */
  async generateAuthUrl(
    orgId: string,
    userId: string,
  ): Promise<{ url: string }> {
    // Issuing the (one-time) state requires the OAuth env / mock mode to be a
    // valid config; reject early otherwise so we never persist a useless nonce.
    if (!this.config.isConfigured() && !this.config.mockMode) {
      throw new ServiceUnavailableException({
        message:
          'Google Workspace OAuth client is not configured on this server.',
        code: GOOGLE_WORKSPACE_NOT_CONFIGURED,
      });
    }

    const state = await this.oauthState.issue({
      organizationId: orgId,
      userId,
    });

    if (this.config.mockMode) {
      const url = `${this.config.apiBaseUrl}/dev/google-workspace/mock-connect?state=${encodeURIComponent(
        state,
      )}`;
      return { url };
    }

    return { url: this.config.buildAuthorizationUrl(state) };
  }

  /** Map a one-time-state consume failure to a safe redirect error param. */
  private stateErrorParam(reason: 'INVALID' | 'EXPIRED' | 'REPLAYED'): string {
    switch (reason) {
      case 'EXPIRED':
        return 'expired_state';
      case 'REPLAYED':
        return 'replayed_state';
      default:
        return 'invalid_state';
    }
  }

  /**
   * Handle the Google OAuth redirect. Verifies the signed state, runs the
   * existing connect token-exchange, and returns the frontend URL to redirect
   * to. Never echoes the code/token back into the URL.
   */
  async handleCallback(input: {
    code?: string | undefined;
    state?: string | undefined;
    error?: string | undefined;
  }): Promise<{ redirectUrl: string }> {
    if (input.error || !input.code) {
      return {
        redirectUrl: this.frontendUrl({ error: 'google_connect_failed' }),
      };
    }
    const result = await this.oauthState.consume(input.state);
    if (!result.ok) {
      return {
        redirectUrl: this.frontendUrl({
          error: this.stateErrorParam(result.reason),
        }),
      };
    }
    try {
      await this.connect(result.organizationId, result.userId, input.code);
      return { redirectUrl: this.frontendUrl({ connected: '1' }) };
    } catch (error) {
      this.logger.warn(
        `Google Workspace connect failed: ${this.errorMessage(error)}`,
      );
      // Surface the tenant-uniqueness conflicts as a distinct, safe error so
      // the UI can explain the 1↔1 tenant rule (no token/identifier leaked).
      const code = this.conflictCode(error);
      const errorParam =
        code === GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED ||
        code === GOOGLE_WORKSPACE_TENANT_MISMATCH
          ? 'tenant_conflict'
          : 'google_connect_failed';
      return { redirectUrl: this.frontendUrl({ error: errorParam }) };
    }
  }

  /**
   * Dev-only mock connect (NODE_ENV !== production + GOOGLE_WORKSPACE_MOCK_MODE).
   * Verifies the same signed state, then persists a CONNECTED integration with
   * placeholder token material so the rest of the flow (status/preview/commit)
   * works against the in-memory fixture directory — no real Google access.
   */
  async mockConnect(state?: string): Promise<{ redirectUrl: string }> {
    if (!this.config.mockMode) {
      throw new NotFoundException();
    }
    const result = await this.oauthState.consume(state);
    if (!result.ok) {
      return {
        redirectUrl: this.frontendUrl({
          error: this.stateErrorParam(result.reason),
        }),
      };
    }
    const payload = {
      organizationId: result.organizationId,
      userId: result.userId,
    };

    await this.prisma.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: payload.organizationId,
          provider: PROVIDER,
        },
      },
      create: {
        organizationId: payload.organizationId,
        provider: PROVIDER,
        status: IntegrationStatus.CONNECTED,
        domain: 'mock.skola.cz',
        // Per-org synthetic customerId keeps the 1↔1 tenant model intact for
        // mock onboarding (two mock orgs never collide on tenant uniqueness).
        customerId: `mock-${payload.organizationId}`,
        scopes: this.config.scopes,
        connectedById: payload.userId,
        // Placeholder, never decrypted in mock mode (see directoryClientFor).
        encryptedAccessToken: 'MOCK',
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
        errorMessage: null,
      },
      update: {
        status: IntegrationStatus.CONNECTED,
        domain: 'mock.skola.cz',
        customerId: `mock-${payload.organizationId}`,
        scopes: this.config.scopes,
        connectedById: payload.userId,
        encryptedAccessToken: 'MOCK',
        tokenExpiresAt: new Date(Date.now() + 3_600_000),
        errorMessage: null,
        deletedAt: null,
      },
    });

    await this.audit.log({
      action: 'GOOGLE_WORKSPACE_CONNECTED',
      entityType: AuditEntityType.ORGANIZATION,
      organizationId: payload.organizationId,
      entityId: payload.organizationId,
      userId: payload.userId,
      metadata: { mock: true },
    });

    return { redirectUrl: this.frontendUrl({ connected: '1' }) };
  }

  private frontendUrl(query: Record<string, string>): string {
    const qs = new URLSearchParams(query).toString();
    return `${this.config.publicAppUrl}${ONBOARDING_FRONTEND_PATH}?${qs}`;
  }

  // =========================================================================
  // CONNECT
  // =========================================================================

  /**
   * Exchange the OAuth authorization code for tokens and persist an encrypted
   * OrganizationIntegration. Tokens are never returned or logged.
   *
   * FRONTEND TODO: the consent redirect (GET to Google's auth URL built by
   * GoogleWorkspaceConfigService.buildAuthorizationUrl) and the redirect_uri
   * handler that forwards the `code` to this endpoint live in the client.
   */
  async connect(orgId: string, actorUserId: string, authorizationCode: string) {
    this.assertConfigured();

    const tokenResponse =
      await this.exchangeAuthorizationCode(authorizationCode);
    const { domain, customerId } = await this.probeDirectoryTenant(
      tokenResponse.access_token,
    );

    return this.persistConnection({
      orgId,
      actorUserId,
      domain: domain ?? null,
      customerId: customerId ?? null,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      expiresIn: tokenResponse.expires_in ?? null,
    });
  }

  /**
   * Persist a (re)connection after the token exchange.
   *
   * MVP invariant: 1 Organization ↔ 1 Google Workspace tenant. Enforced by two
   * tenant guards BEFORE any token is written, so a failed connect never
   * persists tokens and never repoints an existing integration:
   *  - GOOGLE_WORKSPACE_TENANT_MISMATCH — this org is already bound to a
   *    different customerId (the existing CONNECTED integration is preserved);
   *  - GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED — this customerId is already
   *    claimed by another organization.
   * A same-org reconnect with the same customerId is allowed (tokens refreshed,
   * organizationId + ExternalIdentity mappings untouched, no duplicate row).
   */
  async persistConnection(input: {
    orgId: string;
    actorUserId: string;
    domain: string | null;
    customerId: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
  }) {
    const existing = await this.prisma.organizationIntegration.findFirst({
      where: {
        organizationId: input.orgId,
        provider: PROVIDER,
        deletedAt: null,
      },
      select: { id: true, customerId: true, status: true },
    });

    // Guard 1: this org is already bound to a different tenant.
    if (
      existing?.customerId &&
      input.customerId &&
      existing.customerId !== input.customerId
    ) {
      throw new ConflictException({
        message:
          'This organization is already connected to a different Google Workspace tenant.',
        code: GOOGLE_WORKSPACE_TENANT_MISMATCH,
      });
    }

    // Guard 2: this tenant is already claimed by another organization.
    if (input.customerId) {
      const claimedElsewhere =
        await this.prisma.organizationIntegration.findFirst({
          where: {
            provider: PROVIDER,
            customerId: input.customerId,
            deletedAt: null,
            organizationId: { not: input.orgId },
          },
          select: { id: true },
        });
      if (claimedElsewhere) {
        throw new ConflictException({
          message:
            'This Google Workspace tenant is already connected to another organization.',
          code: GOOGLE_WORKSPACE_CUSTOMER_ALREADY_CONNECTED,
        });
      }
    }

    // Guards passed → encrypt tokens (never before this point) and upsert.
    const encryptedAccessToken = this.encryption.encrypt(input.accessToken);
    const encryptedRefreshToken = input.refreshToken
      ? this.encryption.encrypt(input.refreshToken)
      : undefined;
    const tokenExpiresAt = input.expiresIn
      ? new Date(Date.now() + input.expiresIn * 1000)
      : undefined;

    const integration = await this.prisma.organizationIntegration.upsert({
      where: {
        organizationId_provider: {
          organizationId: input.orgId,
          provider: PROVIDER,
        },
      },
      create: {
        organizationId: input.orgId,
        provider: PROVIDER,
        status: IntegrationStatus.CONNECTED,
        domain: input.domain,
        customerId: input.customerId,
        scopes: this.config.scopes,
        connectedById: input.actorUserId,
        encryptedAccessToken,
        encryptedRefreshToken: encryptedRefreshToken ?? null,
        tokenExpiresAt: tokenExpiresAt ?? null,
        errorMessage: null,
      },
      update: {
        status: IntegrationStatus.CONNECTED,
        domain: input.domain,
        customerId: input.customerId,
        scopes: this.config.scopes,
        connectedById: input.actorUserId,
        encryptedAccessToken,
        // Google only re-issues a refresh token on first consent; keep the
        // existing one if the exchange did not include a new one.
        ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
        tokenExpiresAt: tokenExpiresAt ?? null,
        errorMessage: null,
        deletedAt: null,
      },
    });

    await this.audit.log({
      action: 'GOOGLE_WORKSPACE_CONNECTED',
      entityType: AuditEntityType.ORGANIZATION,
      organizationId: input.orgId,
      entityId: input.orgId,
      userId: input.actorUserId,
      metadata: { domain: input.domain, customerId: input.customerId },
    });

    return this.toStatusView(integration);
  }

  // =========================================================================
  // STATUS
  // =========================================================================

  async getStatus(orgId: string) {
    const integration = await this.prisma.organizationIntegration.findFirst({
      where: { organizationId: orgId, provider: PROVIDER, deletedAt: null },
    });
    if (!integration) {
      return {
        connected: false,
        provider: PROVIDER,
        status: null,
        domain: null,
        lastSyncAt: null,
        scopes: [] as string[],
        // Surfaces a config-vs-connection distinction to the UI without leaking
        // anything: true means the server can start an OAuth/mock connect.
        configured: this.config.isConfigured() || this.config.mockMode,
        mockMode: this.config.mockMode,
      };
    }
    return { ...this.toStatusView(integration), configured: true };
  }

  // =========================================================================
  // PREVIEW
  // =========================================================================

  async preview(
    orgId: string,
    actorUserId: string,
    request: {
      academicYearId?: string;
      patterns?: PreviewPatterns;
    },
  ): Promise<GoogleWorkspacePreview> {
    this.assertConfigured();
    const yearId = await this.resolveYear(orgId, request.academicYearId);

    const { client, scope } = await this.directoryClientFor(orgId);
    const snapshot = await this.loadDirectorySnapshot(client, scope);
    const existing = await this.loadExistingState(orgId, yearId);

    const preview = buildPreview({
      users: snapshot.users,
      groups: snapshot.groups,
      membersByGroupId: snapshot.membersByGroupId,
      ...(request.patterns ? { patterns: request.patterns } : {}),
      existing,
    });

    await this.audit.log({
      action: 'GOOGLE_WORKSPACE_PREVIEWED',
      entityType: AuditEntityType.ORGANIZATION,
      organizationId: orgId,
      entityId: orgId,
      userId: actorUserId,
      metadata: { summary: preview.summary, yearId },
    });

    return preview;
  }

  // =========================================================================
  // COMMIT
  // =========================================================================

  async commit(
    orgId: string,
    actorUserId: string,
    dto: GoogleWorkspaceCommitImportDto,
  ) {
    this.assertConfigured();
    const yearId = await this.resolveYear(orgId, dto.academicYearId);

    const syncRun = await this.acquireSyncRun(orgId);

    const issues: SyncIssueDraft[] = [];
    const counts: SyncCounts = {
      usersCreated: 0,
      usersUpdated: 0,
      usersSkipped: 0,
      membershipsCreated: 0,
      studentsCreated: 0,
      teachersCreated: 0,
      classSectionsCreated: 0,
      enrollmentsCreated: 0,
      enrollmentsUpdated: 0,
      enrollmentsDeactivated: 0,
    };

    try {
      const { client, scope } = await this.directoryClientFor(orgId);
      const snapshot = await this.loadDirectorySnapshot(client, scope);
      const existing = await this.loadExistingState(orgId, yearId);
      const preview = buildPreview({
        users: snapshot.users,
        groups: snapshot.groups,
        membersByGroupId: snapshot.membersByGroupId,
        existing,
      });

      const ignored = new Set(dto.ignoredExternalIds ?? []);
      const classOverrides = new Map(
        dto.selectedClassMappings.map((m) => [m.externalGroupId, m]),
      );
      const roleOverrides = this.buildRoleOverrideMap(dto);

      // --- resolve effective class plans -------------------------------
      const effectiveClasses = new Map<string, ClassPlan>();
      for (const c of preview.plan.classes) {
        if (ignored.has(c.externalGroupId)) continue;
        const override = classOverrides.get(c.externalGroupId);
        if (override) {
          if (override.action === 'IGNORE') continue;
          effectiveClasses.set(c.externalGroupId, {
            ...c,
            action: override.action,
            existingClassSectionId: override.existingClassSectionId ?? null,
            grade: override.grade,
            section: override.section,
            label: override.label,
          });
        } else if (c.action !== 'IGNORE') {
          effectiveClasses.set(c.externalGroupId, c);
        }
      }

      await this.prisma.$transaction(async (tx) => {
        // 1) Ensure class sections (CREATE or MAP_EXISTING), record identity.
        const classSectionIdByGroup = new Map<string, string>();
        for (const c of effectiveClasses.values()) {
          if (c.locked) {
            issues.push({
              severity: SyncIssueSeverity.WARNING,
              code: 'CLASS_MAPPING_LOCKED',
              message: `Mapování skupiny ${c.externalGroupEmail} je ručně uzamčeno; ponecháno beze změny.`,
              payload: { externalGroupId: c.externalGroupId },
            });
            const existingMapping = existing.groupIdentityByExternalId.get(
              c.externalGroupId,
            );
            if (existingMapping?.classSectionId) {
              classSectionIdByGroup.set(
                c.externalGroupId,
                existingMapping.classSectionId,
              );
            }
            continue;
          }

          const sectionId = await this.ensureClassSection(
            tx,
            orgId,
            yearId,
            c,
            counts,
          );
          classSectionIdByGroup.set(c.externalGroupId, sectionId);

          await this.upsertExternalIdentity(tx, {
            organizationId: orgId,
            type: ExternalIdentityType.GROUP,
            externalId: c.externalGroupId,
            externalEmail: c.externalGroupEmail,
            displayName: c.externalGroupName,
            classSectionId: sectionId,
            raw: { grade: c.grade, section: c.section, label: c.label },
          });
        }

        // 2) Users → memberships → student/teacher profiles.
        const userIdByExternal = new Map<string, string>();
        const studentIdByExternal = new Map<string, string>();
        for (const u of preview.plan.users) {
          if (ignored.has(u.externalId)) {
            counts.usersSkipped += 1;
            continue;
          }
          const role = roleOverrides.get(u.externalId) ?? u.role;
          const resolved = await this.commitUser(
            tx,
            orgId,
            { ...u, role },
            dto.options,
            counts,
            issues,
          );
          if (!resolved) {
            counts.usersSkipped += 1;
            continue;
          }
          userIdByExternal.set(u.externalId, resolved.userId);
          if (resolved.studentId) {
            studentIdByExternal.set(u.externalId, resolved.studentId);
          }
        }

        // 3) Enrollments.
        const enrolledExternalIds = new Set<string>();
        for (const e of preview.plan.enrollments) {
          if (ignored.has(e.externalUserId) || ignored.has(e.externalGroupId)) {
            continue;
          }
          const studentId = studentIdByExternal.get(e.externalUserId);
          const classSectionId = classSectionIdByGroup.get(e.externalGroupId);
          if (!studentId || !classSectionId) continue;
          await this.commitEnrollment(
            tx,
            orgId,
            yearId,
            studentId,
            classSectionId,
            dto.options,
            counts,
            issues,
          );
          enrolledExternalIds.add(e.externalUserId);
        }

        // 4) Deactivate enrollments of Google-sourced students that vanished.
        if (dto.options.deactivateMissingEnrollments) {
          await this.deactivateMissingEnrollments(
            tx,
            orgId,
            yearId,
            enrolledExternalIds,
            counts,
            issues,
          );
        }
      });

      const status = issues.some((i) => i.severity === SyncIssueSeverity.ERROR)
        ? SyncRunStatus.PARTIAL
        : issues.some((i) => i.severity === SyncIssueSeverity.WARNING)
          ? SyncRunStatus.PARTIAL
          : SyncRunStatus.DONE;

      await this.finalizeSyncRun(syncRun.id, status, counts, issues);
      await this.prisma.organizationIntegration.updateMany({
        where: { organizationId: orgId, provider: PROVIDER, deletedAt: null },
        data: {
          lastSyncAt: new Date(),
          status: IntegrationStatus.CONNECTED,
          errorMessage: null,
        },
      });

      await this.audit.log({
        action: 'GOOGLE_WORKSPACE_IMPORT_COMMITTED',
        entityType: AuditEntityType.ORGANIZATION,
        organizationId: orgId,
        entityId: orgId,
        userId: actorUserId,
        metadata: {
          syncRunId: syncRun.id,
          counts: counts as unknown as Prisma.InputJsonValue,
          status,
        },
      });

      return { syncRunId: syncRun.id, status, summary: counts, issues };
    } catch (error) {
      await this.failSyncRun(syncRun.id, error, counts);
      await this.prisma.organizationIntegration.updateMany({
        where: { organizationId: orgId, provider: PROVIDER, deletedAt: null },
        data: {
          status: IntegrationStatus.ERROR,
          errorMessage: this.errorMessage(error),
        },
      });
      await this.audit.log({
        action: 'GOOGLE_WORKSPACE_SYNC_FAILED',
        entityType: AuditEntityType.ORGANIZATION,
        organizationId: orgId,
        entityId: orgId,
        userId: actorUserId,
        metadata: { syncRunId: syncRun.id, error: this.errorMessage(error) },
      });
      throw error;
    }
  }

  // =========================================================================
  // RESYNC
  // =========================================================================

  /**
   * Manual re-run: rebuilds the plan from the live directory and commits it
   * using the plan's own proposals (no UI overrides), with conservative
   * defaults. Idempotent — safe to call repeatedly.
   */
  async resync(orgId: string, actorUserId: string, academicYearId?: string) {
    this.assertConfigured();
    const yearId = await this.resolveYear(orgId, academicYearId);
    const preview = await this.preview(orgId, actorUserId, {
      academicYearId: yearId,
    });

    const dto: GoogleWorkspaceCommitImportDto = {
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

    const result = await this.commit(orgId, actorUserId, dto);
    await this.audit.log({
      action: 'GOOGLE_WORKSPACE_RESYNCED',
      entityType: AuditEntityType.ORGANIZATION,
      organizationId: orgId,
      entityId: orgId,
      userId: actorUserId,
      metadata: { syncRunId: result.syncRunId, status: result.status },
    });
    return result;
  }

  // =========================================================================
  // SYNC RUNS
  // =========================================================================

  async listSyncRuns(orgId: string, limit = 20) {
    const runs = await this.prisma.syncRun.findMany({
      where: { organizationId: orgId, provider: PROVIDER },
      orderBy: { startedAt: 'desc' },
      take: Math.min(100, limit),
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        summary: true,
        _count: { select: { issues: true } },
      },
    });
    return runs;
  }

  async getSyncRun(orgId: string, syncRunId: string) {
    const run = await this.prisma.syncRun.findFirst({
      where: { id: syncRunId, organizationId: orgId, provider: PROVIDER },
      include: {
        issues: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Sync run not found.');
    return run;
  }

  // =========================================================================
  // Internals
  // =========================================================================

  private assertConfigured() {
    // Mock mode (dev only) is a valid, self-contained configuration.
    if (!this.config.isConfigured() && !this.config.mockMode) {
      throw new ServiceUnavailableException({
        message:
          'Google Workspace integration is not configured on this server.',
        code: GOOGLE_WORKSPACE_NOT_CONFIGURED,
      });
    }
  }

  private async resolveYear(
    orgId: string,
    academicYearId?: string,
  ): Promise<string> {
    if (academicYearId) {
      const year = await this.prisma.academicYear.findFirst({
        where: { id: academicYearId, orgId, deletedAt: null },
        select: { id: true },
      });
      if (!year) {
        throw new BadRequestException('INVALID_ACADEMIC_YEAR');
      }
      return year.id;
    }
    const current = await this.academicYears.getCurrentForOrgOrFail(orgId);
    return current.id;
  }

  private async directoryClientFor(orgId: string): Promise<{
    client: GoogleWorkspaceDirectoryClient;
    scope: DirectoryScope;
  }> {
    const integration = await this.prisma.organizationIntegration.findFirst({
      where: { organizationId: orgId, provider: PROVIDER, deletedAt: null },
    });
    if (!integration || integration.status === IntegrationStatus.DISABLED) {
      throw new BadRequestException(
        'Google Workspace integration is not connected for this organization.',
      );
    }
    const scope: DirectoryScope = {};
    if (integration.customerId) scope.customerId = integration.customerId;
    else if (integration.domain) scope.domain = integration.domain;
    // In mock mode the directory factory ignores the token and serves the
    // in-memory fixture, so never attempt to decrypt the placeholder token.
    const accessToken = this.config.mockMode
      ? 'mock'
      : await this.ensureAccessToken(integration);
    return { client: this.directoryFactory.create(accessToken), scope };
  }

  private async ensureAccessToken(integration: {
    id: string;
    encryptedAccessToken: string | null;
    encryptedRefreshToken: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    const stillValid =
      integration.encryptedAccessToken &&
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt.getTime() - 60_000 > Date.now();
    if (stillValid && integration.encryptedAccessToken) {
      return this.encryption.decrypt(integration.encryptedAccessToken);
    }

    if (!integration.encryptedRefreshToken) {
      await this.markReauthRequired(integration.id, 'No refresh token stored.');
      throw new ConflictException({
        message:
          'Google Workspace integration requires reconnecting (no refresh token).',
        code: GOOGLE_WORKSPACE_REAUTH_REQUIRED,
      });
    }

    let refreshed: { access_token: string; expires_in?: number };
    try {
      const refreshToken = this.encryption.decrypt(
        integration.encryptedRefreshToken,
      );
      refreshed = await this.refreshAccessToken(refreshToken);
    } catch (error) {
      // A failed refresh (e.g. invalid_grant: token revoked / consent removed)
      // means the integration can no longer talk to Google. Flag it for reauth
      // — never log token material.
      this.logger.warn(
        `Google Workspace token refresh failed: ${this.errorMessage(error)}`,
      );
      await this.markReauthRequired(
        integration.id,
        'Access token refresh failed; reconnect required.',
      );
      throw new ConflictException({
        message: 'Google Workspace access could not be refreshed.',
        code: GOOGLE_WORKSPACE_REAUTH_REQUIRED,
      });
    }

    await this.prisma.organizationIntegration.update({
      where: { id: integration.id },
      data: {
        encryptedAccessToken: this.encryption.encrypt(refreshed.access_token),
        tokenExpiresAt: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : null,
        // A successful refresh clears any prior error state.
        status: IntegrationStatus.CONNECTED,
        errorMessage: null,
      },
    });
    return refreshed.access_token;
  }

  /** Flag an integration as needing a fresh OAuth consent (status=ERROR). */
  private async markReauthRequired(
    integrationId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.organizationIntegration.update({
      where: { id: integrationId },
      data: {
        status: IntegrationStatus.ERROR,
        errorMessage: reason,
      },
    });
  }

  private async loadDirectorySnapshot(
    client: GoogleWorkspaceDirectoryClient,
    scope: DirectoryScope,
  ) {
    const [users, groups] = await Promise.all([
      client.listUsers(scope),
      client.listGroups(scope),
    ]);
    const membersByGroupId = new Map<
      string,
      Awaited<ReturnType<GoogleWorkspaceDirectoryClient['listGroupMembers']>>
    >();
    for (const group of groups) {
      const members = await client.listGroupMembers(group.id);
      membersByGroupId.set(group.id, members);
    }
    return { users, groups, membersByGroupId };
  }

  private async loadExistingState(
    orgId: string,
    yearId: string,
  ): Promise<ExistingState> {
    const [identities, classSections, memberships] = await Promise.all([
      this.prisma.externalIdentity.findMany({
        where: { organizationId: orgId, provider: PROVIDER, deletedAt: null },
        select: {
          type: true,
          externalId: true,
          externalEmail: true,
          userId: true,
          membershipId: true,
          classSectionId: true,
          syncMode: true,
        },
      }),
      this.prisma.classSection.findMany({
        where: { orgId, yearId },
        select: { id: true, grade: true, section: true, label: true },
      }),
      this.prisma.membership.findMany({
        where: { organizationId: orgId, deletedAt: null },
        select: { id: true, userId: true, user: { select: { email: true } } },
      }),
    ]);

    const userIdentityByExternalId = new Map<
      string,
      { userId: string; membershipId: string | null }
    >();
    const groupIdentityByExternalId = new Map<
      string,
      { classSectionId: string | null; syncMode: SyncMode }
    >();
    for (const id of identities) {
      if (id.type === ExternalIdentityType.USER && id.userId) {
        userIdentityByExternalId.set(id.externalId, {
          userId: id.userId,
          membershipId: id.membershipId,
        });
      } else if (id.type === ExternalIdentityType.GROUP) {
        groupIdentityByExternalId.set(id.externalId, {
          classSectionId: id.classSectionId,
          syncMode: id.syncMode,
        });
      }
    }

    const userByEmail = new Map<string, { id: string }>();
    const membershipUserIdsInOrg = new Set<string>();
    for (const m of memberships) {
      membershipUserIdsInOrg.add(m.userId);
      const email = m.user.email?.toLowerCase();
      if (email) userByEmail.set(email, { id: m.userId });
    }

    const classSectionByGradeSection = new Map<
      string,
      { id: string; label: string | null }
    >();
    for (const cs of classSections) {
      classSectionByGradeSection.set(`${cs.grade}|${cs.section}`, {
        id: cs.id,
        label: cs.label,
      });
    }

    return {
      userIdentityByExternalId,
      userByEmail,
      membershipUserIdsInOrg,
      classSectionByGradeSection,
      groupIdentityByExternalId,
    };
  }

  private buildRoleOverrideMap(
    _dto: GoogleWorkspaceCommitImportDto,
  ): Map<string, DetectedRole> {
    // Role overrides are applied per user via their external id. In MVP the
    // UI submits role mappings at the group/orgunit level; resolving those to
    // individual users requires the live membership snapshot, which the plan
    // already encodes. We therefore trust the plan's per-user roles (which the
    // admin reviewed in the preview) and keep this map for future per-user
    // overrides. Returning an empty map means "use plan roles".
    return new Map();
  }

  private async ensureClassSection(
    tx: Prisma.TransactionClient,
    orgId: string,
    yearId: string,
    plan: ClassPlan,
    counts: SyncCounts,
  ): Promise<string> {
    if (plan.action === 'MAP_EXISTING' && plan.existingClassSectionId) {
      return plan.existingClassSectionId;
    }
    const existing = await tx.classSection.findUnique({
      where: {
        orgId_yearId_grade_section: {
          orgId,
          yearId,
          grade: plan.grade as SchoolGrade,
          section: plan.section,
        },
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await tx.classSection.create({
      data: {
        orgId,
        yearId,
        grade: plan.grade as SchoolGrade,
        section: plan.section,
        label: plan.label,
      },
      select: { id: true },
    });
    counts.classSectionsCreated += 1;
    return created.id;
  }

  private async commitUser(
    tx: Prisma.TransactionClient,
    orgId: string,
    plan: UserPlan & { role: DetectedRole },
    options: GoogleWorkspaceCommitImportDto['options'],
    counts: SyncCounts,
    issues: SyncIssueDraft[],
  ): Promise<{ userId: string; studentId: string | null } | null> {
    // 1) Resolve the local user by external identity, then by e-mail.
    let userId = plan.existingUserId;
    if (!userId) {
      const byEmail = plan.email
        ? await tx.user.findUnique({
            where: { email: plan.email },
            select: { id: true },
          })
        : null;
      userId = byEmail?.id ?? null;
    }

    if (!userId) {
      if (!options.createMissingUsers) {
        issues.push({
          severity: SyncIssueSeverity.INFO,
          code: 'USER_SKIPPED_NO_CREATE',
          message: `Uživatel ${plan.email} přeskočen (createMissingUsers=false).`,
          payload: { externalId: plan.externalId },
        });
        return null;
      }
      // SSO-managed account: random unusable password (login via SSO only).
      const passwordHash = await bcrypt.hash(
        randomBytes(32).toString('hex'),
        10,
      );
      const created = await tx.user.create({
        data: {
          email: plan.email || null,
          name: plan.displayName,
          passwordHash,
        },
        select: { id: true },
      });
      userId = created.id;
      counts.usersCreated += 1;
    } else if (options.updateExistingUsers) {
      await tx.user.update({
        where: { id: userId },
        data: { name: plan.displayName },
      });
      counts.usersUpdated += 1;
    }

    // 2) Membership (idempotent on userId+organizationId).
    const membership = await tx.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      create: {
        userId,
        organizationId: orgId,
        role: ROLE_MAP[plan.role],
      },
      update: {},
      select: { id: true, role: true },
    });
    if (membership.role !== ROLE_MAP[plan.role]) {
      // Do not silently change an existing role; surface it for the admin.
      issues.push({
        severity: SyncIssueSeverity.WARNING,
        code: 'ROLE_DIFFERS_FROM_EXISTING',
        message: `Uživatel ${plan.email} má v SkillStormu roli ${membership.role}, Google navrhuje ${ROLE_MAP[plan.role]}; ponechána stávající.`,
        payload: { externalId: plan.externalId },
      });
    }
    if (plan.needsMembership) counts.membershipsCreated += 1;

    // 3) Role profile (Student/Teacher) for the (possibly pre-existing) membership.
    let studentId: string | null = null;
    const effectiveRole = membership.role;
    if (effectiveRole === OrganizationRole.STUDENT) {
      const existingStudent = await tx.student.findUnique({
        where: { membershipId: membership.id },
        select: { id: true },
      });
      if (existingStudent) {
        studentId = existingStudent.id;
      } else {
        const student = await tx.student.create({
          data: { membershipId: membership.id, orgId },
          select: { id: true },
        });
        studentId = student.id;
        counts.studentsCreated += 1;
      }
    } else if (
      effectiveRole === OrganizationRole.TEACHER ||
      effectiveRole === OrganizationRole.DIRECTOR
    ) {
      const existingTeacher = await tx.teacher.findUnique({
        where: { membershipId: membership.id },
        select: { id: true },
      });
      if (!existingTeacher) {
        await tx.teacher.create({
          data: { membershipId: membership.id, organizationId: orgId },
          select: { id: true },
        });
        counts.teachersCreated += 1;
      }
    }

    // 4) Persist USER external identity (idempotent).
    await this.upsertExternalIdentity(tx, {
      organizationId: orgId,
      type: ExternalIdentityType.USER,
      externalId: plan.externalId,
      externalEmail: plan.email,
      displayName: plan.displayName,
      userId,
      membershipId: membership.id,
      raw: { role: plan.role, suspended: plan.suspended },
    });

    return { userId, studentId };
  }

  private async commitEnrollment(
    tx: Prisma.TransactionClient,
    orgId: string,
    yearId: string,
    studentId: string,
    classSectionId: string,
    options: GoogleWorkspaceCommitImportDto['options'],
    counts: SyncCounts,
    issues: SyncIssueDraft[],
  ) {
    const existing = await tx.enrollment.findUnique({
      where: { studentId_yearId: { studentId, yearId } },
      select: { id: true, classSectionId: true, status: true },
    });

    if (!existing) {
      await tx.enrollment.create({
        data: {
          studentId,
          classSectionId,
          yearId,
          orgId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      counts.enrollmentsCreated += 1;
      return;
    }

    if (existing.classSectionId === classSectionId) {
      // Re-activate if it had been marked LEFT/etc., otherwise no-op (idempotent).
      if (existing.status !== EnrollmentStatus.ACTIVE) {
        await tx.enrollment.update({
          where: { id: existing.id },
          data: { status: EnrollmentStatus.ACTIVE },
        });
        counts.enrollmentsUpdated += 1;
      }
      return;
    }

    // Student moved to a different class within the same year.
    if (options.respectManualOverrides) {
      const manual = await tx.externalIdentity.findFirst({
        where: {
          organizationId: orgId,
          provider: PROVIDER,
          type: ExternalIdentityType.GROUP,
          classSectionId: existing.classSectionId,
          syncMode: { in: [SyncMode.MANUAL_OVERRIDE, SyncMode.IGNORED] },
        },
        select: { id: true },
      });
      if (manual) {
        issues.push({
          severity: SyncIssueSeverity.WARNING,
          code: 'STUDENT_MOVED_CLASS',
          message: `Student má ruční zařazení; přesun z Google ignorován.`,
          payload: { studentId, fromClass: existing.classSectionId },
        });
        return;
      }
    }

    await tx.enrollment.update({
      where: { id: existing.id },
      data: { classSectionId, status: EnrollmentStatus.ACTIVE },
    });
    counts.enrollmentsUpdated += 1;
    issues.push({
      severity: SyncIssueSeverity.INFO,
      code: 'STUDENT_MOVED_CLASS',
      message: `Student přesunut do nové třídy dle Google.`,
      payload: {
        studentId,
        fromClass: existing.classSectionId,
        toClass: classSectionId,
      },
    });
  }

  private async deactivateMissingEnrollments(
    tx: Prisma.TransactionClient,
    orgId: string,
    yearId: string,
    enrolledExternalIds: Set<string>,
    counts: SyncCounts,
    issues: SyncIssueDraft[],
  ) {
    // Students that previously came from Google sync (have a USER identity)
    // but are not in any current Google class group.
    const googleUserIdentities = await tx.externalIdentity.findMany({
      where: {
        organizationId: orgId,
        provider: PROVIDER,
        type: ExternalIdentityType.USER,
        deletedAt: null,
        membershipId: { not: null },
      },
      select: {
        externalId: true,
        membership: { select: { student: { select: { id: true } } } },
      },
    });

    for (const identity of googleUserIdentities) {
      if (enrolledExternalIds.has(identity.externalId)) continue;
      const studentId = identity.membership?.student?.id;
      if (!studentId) continue;

      const enrollment = await tx.enrollment.findUnique({
        where: { studentId_yearId: { studentId, yearId } },
        select: { id: true, status: true },
      });
      if (!enrollment || enrollment.status !== EnrollmentStatus.ACTIVE)
        continue;

      // Never hard-delete: mark as LEFT only.
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { status: EnrollmentStatus.LEFT },
      });
      counts.enrollmentsDeactivated += 1;
      issues.push({
        severity: SyncIssueSeverity.INFO,
        code: 'STUDENT_LEFT_GROUP',
        message: `Student už není v žádné Google třídě; enrollment označen jako LEFT.`,
        payload: { studentId, externalId: identity.externalId },
      });
    }
  }

  private async upsertExternalIdentity(
    tx: Prisma.TransactionClient,
    data: {
      organizationId: string;
      type: ExternalIdentityType;
      externalId: string;
      externalEmail?: string | null;
      displayName?: string | null;
      userId?: string | null;
      membershipId?: string | null;
      classSectionId?: string | null;
      raw?: Prisma.InputJsonValue;
    },
  ) {
    // Respect manual overrides: never repoint a MANUAL_OVERRIDE/IGNORED link.
    const existing = await tx.externalIdentity.findUnique({
      where: {
        organizationId_provider_type_externalId: {
          organizationId: data.organizationId,
          provider: PROVIDER,
          type: data.type,
          externalId: data.externalId,
        },
      },
      select: { id: true, syncMode: true },
    });

    const writable: Prisma.ExternalIdentityUncheckedUpdateInput = {
      externalEmail: data.externalEmail ?? null,
      displayName: data.displayName ?? null,
      deletedAt: null,
      ...(data.raw !== undefined ? { raw: data.raw } : {}),
    };
    if (!existing || existing.syncMode === SyncMode.AUTO) {
      writable.userId = data.userId ?? null;
      writable.membershipId = data.membershipId ?? null;
      writable.classSectionId = data.classSectionId ?? null;
    }

    if (existing) {
      await tx.externalIdentity.update({
        where: { id: existing.id },
        data: writable,
      });
      return;
    }

    await tx.externalIdentity.create({
      data: {
        organizationId: data.organizationId,
        provider: PROVIDER,
        type: data.type,
        externalId: data.externalId,
        externalEmail: data.externalEmail ?? null,
        displayName: data.displayName ?? null,
        userId: data.userId ?? null,
        membershipId: data.membershipId ?? null,
        classSectionId: data.classSectionId ?? null,
        ...(data.raw !== undefined ? { raw: data.raw } : {}),
      },
    });
  }

  /**
   * Acquire the per-organization sync lock by creating the RUNNING SyncRun.
   *
   * The lock is scoped to (organizationId, provider): syncs for different
   * schools run in parallel, but a second concurrent commit/resync for the
   * SAME org fails with GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING. A pre-check
   * gives a friendly error; the partial unique index
   * `sync_run_single_running_per_org` makes it race-safe (P2002 → same error).
   */
  private async acquireSyncRun(orgId: string): Promise<{ id: string }> {
    const running = await this.prisma.syncRun.findFirst({
      where: {
        organizationId: orgId,
        provider: PROVIDER,
        status: SyncRunStatus.RUNNING,
      },
      select: { id: true },
    });
    if (running) {
      throw new ConflictException({
        message:
          'A Google Workspace sync is already running for this organization.',
        code: GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING,
      });
    }
    try {
      return await this.prisma.syncRun.create({
        data: {
          organizationId: orgId,
          provider: PROVIDER,
          status: SyncRunStatus.RUNNING,
        },
        select: { id: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message:
            'A Google Workspace sync is already running for this organization.',
          code: GOOGLE_WORKSPACE_SYNC_ALREADY_RUNNING,
        });
      }
      throw error;
    }
  }

  private async finalizeSyncRun(
    syncRunId: string,
    status: SyncRunStatus,
    summary: SyncCounts,
    issues: SyncIssueDraft[],
  ) {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        finishedAt: new Date(),
        summary: {
          ...summary,
          warnings: issues.filter(
            (i) => i.severity === SyncIssueSeverity.WARNING,
          ).length,
          errors: issues.filter((i) => i.severity === SyncIssueSeverity.ERROR)
            .length,
        },
      },
    });
    if (issues.length) {
      await this.prisma.syncIssue.createMany({
        data: issues.map((i) => ({
          syncRunId,
          severity: i.severity,
          code: i.code,
          message: i.message,
          ...(i.payload !== undefined ? { payload: i.payload } : {}),
        })),
      });
    }
  }

  private async failSyncRun(
    syncRunId: string,
    error: unknown,
    summary: SyncCounts,
  ) {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: SyncRunStatus.FAILED,
        finishedAt: new Date(),
        summary: { ...summary, error: this.errorMessage(error) },
      },
    });
    await this.prisma.syncIssue.create({
      data: {
        syncRunId,
        severity: SyncIssueSeverity.ERROR,
        code: 'SYNC_FAILED',
        message: this.errorMessage(error),
      },
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  }

  /** Extract a machine-readable `code` from a thrown ConflictException, if any. */
  private conflictCode(error: unknown): string | undefined {
    if (error instanceof ConflictException) {
      const res = error.getResponse();
      if (res && typeof res === 'object' && 'code' in res) {
        return String((res as { code?: unknown }).code);
      }
    }
    return undefined;
  }

  private toStatusView(integration: {
    status: IntegrationStatus;
    domain: string | null;
    customerId: string | null;
    scopes: string[];
    lastSyncAt: Date | null;
    errorMessage: string | null;
    connectedById: string | null;
  }) {
    // Tokens are intentionally never included.
    return {
      connected: integration.status !== IntegrationStatus.DISABLED,
      provider: PROVIDER,
      status: integration.status,
      // Drives the "Znovu připojit" CTA: a refresh failure / revoked consent
      // leaves the integration in ERROR and needs a fresh OAuth grant.
      needsReconnect: integration.status === IntegrationStatus.ERROR,
      domain: integration.domain,
      customerId: integration.customerId,
      scopes: integration.scopes,
      lastSyncAt: integration.lastSyncAt,
      errorMessage: integration.errorMessage,
      connectedById: integration.connectedById,
    };
  }

  // --- OAuth HTTP (real) --------------------------------------------------

  private async exchangeAuthorizationCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const body = new URLSearchParams({
      code,
      client_id: this.config.clientId ?? '',
      client_secret: this.config.clientSecret ?? '',
      redirect_uri: this.config.redirectUri ?? '',
      grant_type: 'authorization_code',
    });
    return this.postToken(body);
  }

  private async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in?: number;
  }> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.config.clientId ?? '',
      client_secret: this.config.clientSecret ?? '',
      grant_type: 'refresh_token',
    });
    return this.postToken(body);
  }

  private async postToken(body: URLSearchParams): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      // Never log the body — it may echo the code/secret.
      this.logger.warn(`Google token endpoint responded ${res.status}`);
      throw new BadRequestException(
        'Google OAuth token exchange failed. Please reconnect.',
      );
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new BadRequestException(
        'Google OAuth response missing access token.',
      );
    }
    return {
      access_token: json.access_token,
      ...(json.refresh_token ? { refresh_token: json.refresh_token } : {}),
      ...(json.expires_in ? { expires_in: json.expires_in } : {}),
    };
  }

  private async probeDirectoryTenant(
    accessToken: string,
  ): Promise<{ domain?: string; customerId?: string }> {
    try {
      const client = this.directoryFactory.create(accessToken);
      const users = await client.listUsers({ customerId: 'my_customer' });
      const first = users[0];
      const domain = first?.primaryEmail?.split('@')[1];
      // The immutable tenant id lives on the raw Google user (`customerId`);
      // it anchors the 1↔1 tenant uniqueness guard (domains can be aliased).
      const rawCustomerId =
        first && typeof first.raw === 'object' && first.raw !== null
          ? (first.raw as { customerId?: unknown }).customerId
          : undefined;
      const customerId =
        typeof rawCustomerId === 'string' ? rawCustomerId : undefined;
      return {
        ...(domain ? { domain } : {}),
        ...(customerId ? { customerId } : {}),
      };
    } catch (error) {
      this.logger.warn(`Tenant probe failed: ${this.errorMessage(error)}`);
      return {};
    }
  }
}
