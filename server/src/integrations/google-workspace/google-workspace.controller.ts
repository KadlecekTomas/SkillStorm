import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationRole, PermissionKey } from '@prisma/client';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { ok } from '@/common/http/envelope';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { Permission } from '@/modules/rbac/permission.decorator';
import { RequestWithUser } from '@/types/request-with-user';
import { GoogleWorkspaceService } from './google-workspace.service';
import { ConnectGoogleWorkspaceDto } from './dto/connect-google-workspace.dto';
import { GoogleWorkspacePreviewRequestDto } from './dto/google-workspace-preview-request.dto';
import { GoogleWorkspaceCommitImportDto } from './dto/google-workspace-commit-import.dto';

/**
 * Google Workspace onboarding endpoints. Tenant-scoped: the `:organizationId`
 * path param MUST equal the caller's active organization (enforced by
 * assertOrgScope) — a user can never sync another organization. Access is
 * limited to OWNER/DIRECTOR or anyone holding MANAGE_STUDENTS / MANAGE_TEACHERS
 * (RbacGuard, applied globally, evaluates the @Permission tokens below).
 */
@ApiTags('Integrations / Google Workspace')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('organizations/:organizationId/integrations/google-workspace')
export class GoogleWorkspaceController {
  constructor(
    private readonly service: GoogleWorkspaceService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post('connect')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'Exchange OAuth code and connect Google Workspace' })
  async connect(
    @Param('organizationId') organizationId: string,
    @Body() dto: ConnectGoogleWorkspaceDto,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    return ok(
      this.service.connect(orgId, req.user.userId, dto.authorizationCode),
    );
  }

  @Get('auth-url')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({
    summary: 'Get the Google OAuth consent URL (or dev mock-connect URL)',
  })
  async authUrl(
    @Param('organizationId') organizationId: string,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    // Synchronous + org-scoped: this is the single place a signed `state` for
    // this org is minted, so it is the security boundary for the callback.
    return ok(this.service.generateAuthUrl(orgId, req.user.userId));
  }

  @Get('status')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'Get Google Workspace integration status' })
  async status(
    @Param('organizationId') organizationId: string,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    return ok(this.service.getStatus(orgId));
  }

  @Post('preview')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'Build a dry-run import preview' })
  async preview(
    @Param('organizationId') organizationId: string,
    @Body() dto: GoogleWorkspacePreviewRequestDto,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    const patterns = {
      ...(dto.classGroupPatterns
        ? { classGroupPatterns: dto.classGroupPatterns }
        : {}),
      ...(dto.teacherGroupPatterns
        ? { teacherGroupPatterns: dto.teacherGroupPatterns }
        : {}),
      ...(dto.directorGroupPatterns
        ? { directorGroupPatterns: dto.directorGroupPatterns }
        : {}),
      ...(dto.excludedGroupPatterns
        ? { excludedGroupPatterns: dto.excludedGroupPatterns }
        : {}),
    };
    const preview = await this.service.preview(orgId, req.user.userId, {
      ...(dto.academicYearId ? { academicYearId: dto.academicYearId } : {}),
      ...(Object.keys(patterns).length ? { patterns } : {}),
    });
    // Strip the internal plan from the public response.
    const { plan: _plan, ...publicPreview } = preview;
    return ok(publicPreview);
  }

  @Post('commit')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'Commit the selected import in a transaction' })
  async commit(
    @Param('organizationId') organizationId: string,
    @Body() dto: GoogleWorkspaceCommitImportDto,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    return ok(this.service.commit(orgId, req.user.userId, dto));
  }

  @Post('resync')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'Manually re-run the sync using auto-mappings' })
  async resync(
    @Param('organizationId') organizationId: string,
    @Body() body: { academicYearId?: string },
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    return ok(
      this.service.resync(orgId, req.user.userId, body?.academicYearId),
    );
  }

  @Get('sync-runs')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'List recent sync runs' })
  async syncRuns(
    @Param('organizationId') organizationId: string,
    @Query('limit') limit: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    const parsed = limit ? Number.parseInt(limit, 10) : 20;
    return ok(
      this.service.listSyncRuns(orgId, Number.isNaN(parsed) ? 20 : parsed),
    );
  }

  @Get('sync-runs/:syncRunId')
  @Permission(
    OrganizationRole.DIRECTOR,
    PermissionKey.MANAGE_STUDENTS,
    PermissionKey.MANAGE_TEACHERS,
  )
  @ApiOperation({ summary: 'Get one sync run with its issues' })
  async syncRun(
    @Param('organizationId') organizationId: string,
    @Param('syncRunId') syncRunId: string,
    @Req() req: RequestWithUser,
  ) {
    const orgId = await this.assertOrgScope(req, organizationId);
    return ok(this.service.getSyncRun(orgId, syncRunId));
  }

  /**
   * Enforce that the route's organization is the caller's active organization.
   * Prevents cross-tenant sync regardless of the permission tokens.
   */
  private async assertOrgScope(
    req: RequestWithUser,
    organizationId: string,
  ): Promise<string> {
    if (!organizationId) {
      throw new BadRequestException('Missing organizationId.');
    }
    const ctx = await this.orgContext.get(req);
    if (ctx.organizationId !== organizationId) {
      throw new ForbiddenException(
        'You cannot manage integrations for another organization.',
      );
    }
    return ctx.organizationId;
  }
}
