import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PlatformService } from './platform.service';
import { PlatformDataScopeService } from './platform-data-scope.service';
import { PlatformMutationAuditInterceptor } from './platform-mutation-audit.interceptor';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import {
  RequirePlatformAccess,
  PlatformAccessLevel,
} from '@/common/decorators/platform-access.decorator';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import type { RequestWithUser } from '@/types/request-with-user';
import { AuditService, type AuditQueryInput } from '@/audit/audit.service';
import { AuditDataScopeService } from '@/audit/audit-data-scope.service';
import { PlatformHealthService } from './platform-health.service';
import { CatalogSyncService } from './catalog-sync.service';
import type { AuditEntityType } from '@prisma/client';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { applyNoStoreHeaders } from '@/common/http/no-store-headers';

// NEVER return raw Prisma entities in the platform layer.
// All organization data must pass through PlatformDataScopeService
// before being serialized so PII fields are correctly filtered per system role.

/**
 * Platform controller.
 *
 * Guard chain:  JwtAuthGuard → PlatformAccessGuard
 * Data layer:   PlatformDataScopeService (field-level PII filtering)
 * Audit:        PlatformMutationAuditInterceptor (applied to MUTATION endpoints only)
 *
 * Access levels (resolved via @RequirePlatformAccess metadata):
 *   READ     → SUPERADMIN | DEVOPS | SUPPORT
 *   MUTATION → SUPERADMIN only
 *
 * Data scope per role:
 *   SUPERADMIN  → full view including ownerEmail
 *   DEVOPS      → ownerEmail redacted
 *   SUPPORT     → ownerEmail redacted
 */
@ApiTags('Platform')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('platform')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard, PlatformAccessGuard)
@RequirePlatformAccess(PlatformAccessLevel.READ)
export class PlatformController {
  constructor(
    private readonly service: PlatformService,
    private readonly dataScope: PlatformDataScopeService,
    private readonly auditService: AuditService,
    private readonly auditDataScope: AuditDataScopeService,
    private readonly healthService: PlatformHealthService,
    private readonly catalogSync: CatalogSyncService,
  ) {}

  @Get('users')
  @ApiOperation({
    summary: 'Global users list (READ — SUPERADMIN | DEVOPS | SUPPORT)',
  })
  @NoHttpCache()
  async listUsers(
    @Req() req: RequestWithUser,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const parsedLimit = Math.min(
      100,
      Math.max(1, parseInt(limit ?? '20', 10) || 20),
    );

    const opts: { page: number; limit: number; search?: string } = {
      page: parsedPage,
      limit: parsedLimit,
    };
    if (search) opts.search = search;

    const { items, meta } = await this.service.listPlatformUsers(opts);
    return ok({
      items: this.dataScope.scopeUsers(req.user, items),
      meta,
    });
  }

  @Get('organizations')
  @ApiOperation({
    summary: 'List organizations (READ — SUPERADMIN | DEVOPS | SUPPORT)',
  })
  @NoHttpCache()
  async listOrganizations(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') search?: string,
  ) {
    applyNoStoreHeaders(res);

    const opts: { page?: number; limit?: number; search?: string } = {};
    if (page) opts.page = parseInt(page, 10);
    if (limit) opts.limit = parseInt(limit, 10);
    if (search) opts.search = search;

    const { items, meta } = await this.service.listOrganizations(opts);
    return ok({
      items: this.dataScope.scopeOrganizationList(req.user, items),
      meta,
    });
  }

  @Get('organizations/:id')
  @ApiOperation({
    summary: 'Organization detail (READ — SUPERADMIN | DEVOPS | SUPPORT)',
  })
  async getOrganizationDetail(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    const org = await this.service.getOrganizationDetail(id);
    return ok(this.dataScope.scopeOrganizationDetail(req.user, org));
  }

  @Post('organizations/:id/activate')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @UseInterceptors(PlatformMutationAuditInterceptor)
  @ApiOperation({
    summary:
      'Approve organization PENDING → ACTIVE (MUTATION — SUPERADMIN only)',
  })
  activate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return ok(this.service.activate(id, req.user.userId));
  }

  @Post('organizations/:id/suspend')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @UseInterceptors(PlatformMutationAuditInterceptor)
  @ApiOperation({
    summary: 'Suspend organization (MUTATION — SUPERADMIN only)',
  })
  suspend(@Param('id') id: string) {
    return ok(this.service.suspend(id));
  }

  @Post('organizations/:id/reactivate')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @UseInterceptors(PlatformMutationAuditInterceptor)
  @ApiOperation({
    summary: 'Reactivate organization (MUTATION — SUPERADMIN only)',
  })
  reactivate(@Param('id') id: string) {
    return ok(this.service.reactivate(id));
  }

  @Post('catalog/sync-subjects')
  @RequirePlatformAccess(PlatformAccessLevel.MUTATION)
  @UseInterceptors(PlatformMutationAuditInterceptor)
  @ApiOperation({
    summary:
      'Sync default subjects + subject levels to all organizations (MUTATION — SUPERADMIN only)',
    description:
      'Idempotent. Upserts one Subject per CatalogSubject and one SubjectLevel per SchoolGrade for every non-deleted organization. Use after adding a new CatalogSubject to propagate it to existing schools.',
  })
  syncCatalogSubjects() {
    return ok(this.catalogSync.syncSubjectsToAllOrgs());
  }

  /**
   * Platform-wide audit log.
   *
   * Access: READ level (SUPERADMIN | DEVOPS | SUPPORT).
   * SUPERADMIN sees full rows including ipAddress + userAgent.
   * DEVOPS and SUPPORT see ipAddress/userAgent redacted.
   *
   * Can filter by organizationId to scope to a single tenant.
   * Omitting organizationId returns platform-wide logs (all orgs).
   */
  @Get('audit/logs')
  @ApiOperation({
    summary: 'Platform-wide audit logs (READ — SUPERADMIN | DEVOPS | SUPPORT)',
  })
  async listAuditLogs(
    @Req() req: RequestWithUser,
    @Query('organizationId') organizationId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const input: AuditQueryInput = {};
    if (organizationId) input.organizationId = organizationId;
    if (entityType) input.entityType = entityType as AuditEntityType;
    if (action) input.action = action;
    if (dateFrom) input.dateFrom = new Date(dateFrom);
    if (dateTo) input.dateTo = new Date(dateTo);
    if (page) input.page = parseInt(page, 10);
    if (limit) input.limit = parseInt(limit, 10);
    const result = await this.auditService.query(input);

    return ok({
      items: this.auditDataScope.scopeAuditList(req.user, result.items),
      meta: result.meta,
    });
  }

  /**
   * Platform analytics overview.
   *
   * Computes organization health scores across all ACTIVE organizations
   * and returns aggregate KPIs for the platform dashboard.
   * Access: READ level (SUPERADMIN | DEVOPS | SUPPORT).
   *
   * ?nocache=1 — bypass the 5-minute in-memory cache (SUPERADMIN only for debugging).
   */
  @Get('analytics/overview')
  @ApiOperation({
    summary:
      'Platform analytics overview (READ — SUPERADMIN | DEVOPS | SUPPORT)',
  })
  async analyticsOverview(
    @Req() req: RequestWithUser,
    @Query('nocache') nocache?: string,
  ) {
    const bypass = nocache === '1' && req.user?.systemRole === 'SUPERADMIN';
    return ok(await this.healthService.computePlatformOverview(bypass));
  }

  /**
   * Organization health detail.
   *
   * Returns a full breakdown of health signals + recommendations for a single org.
   * No PII — no emails, no IP, no user agents.
   * Access: READ level (SUPERADMIN | DEVOPS | SUPPORT).
   */
  @Get('organizations/:id/health')
  @ApiOperation({
    summary:
      'Organization health detail (READ — SUPERADMIN | DEVOPS | SUPPORT)',
  })
  async orgHealth(@Param('id') id: string) {
    return ok(await this.healthService.computeOrgHealth(id));
  }
}
