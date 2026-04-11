import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RequestWithUser } from '@/types/request-with-user';
import { ok } from '@/common/http/envelope';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  setAuthCookies,
  setCsrfCookie,
  generateCsrfToken,
} from '@/auth/token-cookies';
import { OrgOperation, OrgOperationType } from '@/common/decorators/org-operation.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token (from invite link)' })
  @IsString()
  token!: string;
}

/**
 * Token-based invitation flow (production join flow).
 * GET /invitations/preview?token=... — public preview.
 * POST /invitations/accept — body { token }; requires auth.
 */
@ApiTags('Invitations')
@ApiStandardResponses()
@Controller('invitations')
@OrgOperation(OrgOperationType.AUTHORING)
export class InvitationsController {
  constructor(private readonly service: InvitesService) {}

  @Get('preview')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Preview invitation by token' })
  preview(@Query('token') token: string, @Req() req: RequestWithUser) {
    return ok(this.service.preview(token ?? '', req.ip));
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @ApiOperation({ summary: 'Accept invitation by token (idempotent if already member)' })
  async accept(
    @Body() dto: AcceptInvitationDto,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const body: { token: string } = {
      token: dto.token?.trim() ?? '',
    };
    const result = await this.service.acceptInvite(req.user.userId, body, req.ip);
    setAuthCookies(res, result.tokens);
    setCsrfCookie(res, generateCsrfToken());
    return ok({
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      roles: result.roles,
      permissions: result.permissions,
      classSectionId: result.classSectionId,
      yearId: result.yearId,
    });
  }
}
