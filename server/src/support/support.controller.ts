import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { RequireSystemRole } from '@/common/decorators/require-system-role.decorator';
import { SystemRoleGuard } from '@/common/guards/system-role.guard';
import type { RequestWithUser } from '@/types/request-with-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiStandardResponses()
@ApiBearerAuth()
@AllowAnyOrgStatus()
@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('support/tickets')
  @Permission(OrganizationRole.OWNER, OrganizationRole.DIRECTOR, OrganizationRole.TEACHER)
  @ApiOperation({ summary: 'Create lightweight support ticket' })
  createTicket(@Body() dto: CreateTicketDto, @Req() req: RequestWithUser) {
    return ok(this.supportService.createTicket(dto, req.user, req));
  }

  @Get('support/my-tickets')
  @Permission(OrganizationRole.OWNER, OrganizationRole.DIRECTOR, OrganizationRole.TEACHER)
  @ApiOperation({ summary: 'List current user support tickets in active organization' })
  @NoHttpCache()
  @CacheTTL(0)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  listMyTickets(@Req() req: RequestWithUser) {
    return ok(this.supportService.listMyTickets(req.user));
  }

  @Get('admin/support/tickets')
  @UseGuards(SystemRoleGuard)
  @RequireSystemRole(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all open support tickets (SUPERADMIN only)' })
  @NoHttpCache()
  @CacheTTL(0)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  listOpenTickets() {
    return ok(this.supportService.listOpenTickets());
  }

  @Patch('admin/support/tickets/:id/resolve')
  @UseGuards(SystemRoleGuard)
  @RequireSystemRole(SystemRole.SUPERADMIN)
  @ApiOperation({ summary: 'Resolve support ticket (SUPERADMIN only)' })
  resolveTicket(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveTicketDto,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.supportService.resolveTicket(id, dto, req.user, req));
  }
}
