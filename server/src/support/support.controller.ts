import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { OrganizationRole, SupportTicketStatus, SystemRole } from '@prisma/client';
import { Permission } from '@/modules/rbac/permission.decorator';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';
import { RequireSystemRole } from '@/common/decorators/require-system-role.decorator';
import { SystemRoleGuard } from '@/common/guards/system-role.guard';
import {
  PlatformAccessLevel,
  RequirePlatformAccess,
} from '@/common/decorators/platform-access.decorator';
import { PlatformAccessGuard } from '@/common/guards/platform-access.guard';
import type { RequestWithUser } from '@/types/request-with-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { SupportDataScopeService } from './support-data-scope.service';
import { SupportService } from './support.service';

@ApiTags('Support')
@ApiStandardResponses()
@ApiBearerAuth()
@AllowAnyOrgStatus()
@Controller()
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly dataScope: SupportDataScopeService,
  ) {}

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
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  listMyTickets(@Req() req: RequestWithUser) {
    return ok(this.supportService.listMyTickets(req.user));
  }

  @Get('platform/support/tickets')
  @UseGuards(PlatformAccessGuard)
  @RequirePlatformAccess(PlatformAccessLevel.READ)
  @ApiOperation({ summary: 'List support tickets for platform triage (READ — SUPERADMIN | DEVOPS | SUPPORT)' })
  @NoHttpCache()
  @CacheTTL(0)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async listTickets(
    @Req() req: RequestWithUser,
    @Query('status', new ParseEnumPipe(SupportTicketStatus, { optional: true }))
    status?: SupportTicketStatus,
    @Query('organizationId') organizationId?: string,
    @Query('category') category?: string,
  ) {
    const tickets = await this.supportService.listTickets(req.user, {
      ...(status ? { status } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(category ? { category } : {}),
    });
    return ok(this.dataScope.scopeTicketList(req.user, tickets));
  }

  @Get('platform/support/tickets/:id')
  @UseGuards(PlatformAccessGuard)
  @RequirePlatformAccess(PlatformAccessLevel.READ)
  @ApiOperation({ summary: 'Get support ticket detail (READ — SUPERADMIN | DEVOPS | SUPPORT)' })
  async getTicket(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: RequestWithUser,
  ) {
    const ticket = await this.supportService.getTicketById(id, req.user);
    return ok(this.dataScope.scopeTicket(req.user, ticket));
  }

  @Patch('platform/support/tickets/:id')
  @UseGuards(SystemRoleGuard)
  @RequireSystemRole(SystemRole.SUPERADMIN, SystemRole.SUPPORT)
  @ApiOperation({ summary: 'Update support ticket triage state (MUTATION — SUPERADMIN | SUPPORT)' })
  async updateTicket(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketDto,
    @Req() req: RequestWithUser,
  ) {
    const ticket = await this.supportService.updateTicket(id, dto, req.user, req);
    return ok(this.dataScope.scopeTicket(req.user, ticket));
  }
}
