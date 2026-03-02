import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditEntityType, OrganizationRole } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import type { RequestWithUser } from '@/types/request-with-user';
import { AuditService, type AuditQueryInput } from './audit.service';
import { AuditDataScopeService } from './audit-data-scope.service';

/**
 * Organization-level audit log access.
 *
 * Requires authenticated user with DIRECTOR or OWNER organization role.
 * Results are automatically scoped to the caller's organizationId.
 * IP address and user agent are always redacted (not visible to org roles).
 *
 * GDPR compliance:
 *  - Purpose limitation: org admins can only see their own org's logs.
 *  - Data minimization: ipAddress and userAgent are never returned to org roles.
 */
@ApiTags('Audit')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('audit')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly auditDataScope: AuditDataScopeService,
  ) {}

  @Get('logs')
  @ApiOperation({ summary: 'Organization audit logs (DIRECTOR | OWNER only)' })
  async listOrgLogs(
    @Req() req: RequestWithUser,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = req.user?.organizationId ?? null;
    const orgRole = req.user?.organizationRole as OrganizationRole | null;

    if (!orgId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_NO_ORG_CONTEXT',
        message: 'No active organization membership.',
      });
    }
    if (orgRole !== OrganizationRole.DIRECTOR && orgRole !== OrganizationRole.OWNER) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORG_ADMIN_ONLY',
        message: 'Audit log access requires DIRECTOR or OWNER role.',
      });
    }

    const input: AuditQueryInput = { organizationId: orgId }; // hard-scoped — never trust client
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
}
