import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import type { RequestWithUser } from '@/types/request-with-user';

@ApiTags('Platform')
@ApiStandardResponses()
@ApiBearerAuth()
@Controller('platform')
@AllowAnyOrgStatus()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly service: PlatformService) {}

  @Get('organizations')
  @ApiOperation({ summary: 'List organizations (metadata only, no PII)' })
  listOrganizations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') search?: string,
  ) {
    const opts: { page?: number; limit?: number; search?: string } = {};
    if (page) opts.page = parseInt(page, 10);
    if (limit) opts.limit = parseInt(limit, 10);
    if (search) opts.search = search;
    return ok(this.service.listOrganizations(opts));
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Organization detail (metadata + last activity)' })
  getOrganizationDetail(@Param('id') id: string) {
    return ok(this.service.getOrganizationDetail(id));
  }

  @Post('organizations/:id/activate')
  @ApiOperation({
    summary: 'Approve organization (PENDING → ACTIVE). SUPERADMIN only.',
  })
  activate(@Param('id') id: string, @Req() req: RequestWithUser) {
    return ok(this.service.activate(id, req.user.userId));
  }

  @Post('organizations/:id/suspend')
  @ApiOperation({ summary: 'Suspend organization' })
  suspend(@Param('id') id: string) {
    return ok(this.service.suspend(id));
  }

  @Post('organizations/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate organization (ACTIVE if ready, else PENDING)' })
  reactivate(@Param('id') id: string) {
    return ok(this.service.reactivate(id));
  }
}
