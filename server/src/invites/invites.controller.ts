import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Permission } from '@/modules/rbac/permission.decorator';
import { PermissionKey } from '@prisma/client';
import { RequestWithUser } from '@/types/request-with-user';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  setAuthCookies,
  setCsrfCookie,
  generateCsrfToken,
} from '@/auth/token-cookies';

@ApiTags('Invites')
@ApiStandardResponses()
@Controller('invites')
export class InvitesController {
  constructor(private readonly service: InvitesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Permission(PermissionKey.MANAGE_STUDENTS, PermissionKey.MANAGE_TEACHERS, PermissionKey.INVITE_STUDENTS, PermissionKey.INVITE_TEACHERS)
  @ApiOperation({ summary: 'Create invite' })
  create(@Body() dto: CreateInviteDto, @Req() req: RequestWithUser) {
    return ok(this.service.createInvite(dto, req.user));
  }

  @Get('preview')
  @Public()
  @ApiOperation({ summary: 'Preview invite by code (resolves type, org, class)' })
  preview(
    @Query('inviteToken') inviteToken: string,
    @Query('code') code: string,
    @Query('token') token: string,
    @Req() req: RequestWithUser,
  ) {
    return ok(this.service.preview(inviteToken ?? code ?? token ?? '', req.ip));
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept invite' })
  async accept(
    @Body() dto: AcceptInviteDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.acceptInvite(req.user.userId, dto, req.ip);
    setAuthCookies(res, result.tokens);
    setCsrfCookie(res, generateCsrfToken());
    return ok({
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      roles: result.roles,
      permissions: result.permissions,
      sessionToken: result.tokens.accessToken,
      classSectionId: result.classSectionId,
      yearId: result.yearId,
    });
  }
}
