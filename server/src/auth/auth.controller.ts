import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  GoneException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleSsoService } from './sso/google-sso.service';
import { LoginDto } from './dto/login.dto';
import { GoogleSsoLoginDto } from './dto/google-sso.dto';
import { RegisterDto } from './dto/register.dto';
import { JoinOrganizationDto } from './dto/join-organization.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RequestWithUser } from '@/types/request-with-user';
import { Throttle, seconds } from '@nestjs/throttler';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  setCsrfCookie,
  clearCsrfCookie,
  generateCsrfToken,
} from './token-cookies';
import { ok } from '@/common/http/envelope';
import { UseOrgDto } from './dto/use-org.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AllowAnyOrgStatus } from '@/common/decorators/allow-any-org-status.decorator';
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';
import { NoHttpCache } from '@/common/cache/no-http-cache.decorator';

@ApiTags('auth')
@ApiStandardResponses()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleSsoService: GoogleSsoService,
  ) {}
  private readonly logger = new Logger(AuthController.name);

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const ip = req.ip;
      const result = await this.authService.register(
        dto,
        ip ? { ip } : undefined,
      );
      setAuthCookies(res, result.tokens);
      setCsrfCookie(res, generateCsrfToken());

      const orgId =
        result.organization != null
          ? (result.organization as { id: string }).id
          : null;
      const ctx = await this.authService.getMeContext(result.user.id, {
        organizationId: orgId,
      });

      return ok(ctx);
    } catch (error) {
      this.logger.error(
        'Register failed',
        error instanceof Error ? error.stack : error,
      );
      if (process.env.NODE_ENV === 'test') {
        // eslint-disable-next-line no-console
        console.error('[auth][register]', error);
        if (error instanceof Error) {
          // eslint-disable-next-line no-console
          console.error(error.stack);
        }
      }
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Registration failed',
      );
    }
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @Throttle({ default: { limit: 10, ttl: seconds(900) } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const requestId = req.requestId ?? null;
    try {
      const result = await this.authService.login(dto);
      setAuthCookies(res, result.tokens);
      setCsrfCookie(res, generateCsrfToken());

      const ctx = await this.authService.getMeContext(result.user.id, {
        organizationId: result.user.organizationId ?? null,
      });

      this.logger.log(
        JSON.stringify({
          event: 'auth_login_success',
          email: dto.email,
          userId: result.user.id,
          requestId,
        }),
      );
      return ok(ctx);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'auth_login_fail',
          email: dto.email,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  @Public()
  @Post('sso/google')
  @ApiOperation({
    summary:
      'Login with a Google ID token (organization-scoped SSO; gated by GOOGLE_SSO_ENABLED)',
  })
  @Throttle({ default: { limit: 10, ttl: seconds(900) } })
  async googleSso(
    @Body() dto: GoogleSsoLoginDto,
    @Req() req: Request & { requestId?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const requestId = req.requestId ?? null;
    try {
      const result = await this.googleSsoService.loginWithGoogle(dto);
      setAuthCookies(res, result.tokens);
      setCsrfCookie(res, generateCsrfToken());

      const ctx = await this.authService.getMeContext(result.user.id, {
        organizationId: result.user.organizationId ?? null,
      });

      this.logger.log(
        JSON.stringify({
          event: 'auth_sso_google_success',
          userId: result.user.id,
          requestId,
        }),
      );
      return ok(ctx);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth_sso_google_fail',
          requestId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: seconds(600) } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) {
      clearAuthCookies(res);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const tokens = await this.authService.refreshToken(token);
    setAuthCookies(res, tokens);
    setCsrfCookie(res, generateCsrfToken());
    return ok({ refreshed: true });
  }

  @Public()
  @Post('logout')
  @ApiBearerAuth()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const tokenFromCookie = req.cookies?.[REFRESH_TOKEN_COOKIE];
    const result = await this.authService.logout(
      accessToken,
      tokenFromCookie ?? undefined,
    );
    clearAuthCookies(res);
    clearCsrfCookie(res);
    return result;
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowAnyOrgStatus()
  @NoHttpCache()
  @ApiOperation({ summary: 'Get current user profile (auth context)' })
  async me(
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private',
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const ctx = await this.authService.getMeContext(req.user.userId, {
      membershipId: req.user.membershipId ?? null,
      organizationId: req.user.organizationId ?? null,
      activeRole: req.user.organizationRole ?? null,
    });

    return ok(ctx);
  }

  @Post('join')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join organization by code' })
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async joinOrganization(
    @Body() _dto: JoinOrganizationDto,
    @Req() _req: RequestWithUser,
    @Res({ passthrough: true }) _res: Response,
  ) {
    throw new GoneException('Legacy join disabled. Use invitation token.');
  }

  @Post('use-org')
  @AllowAnyOrgStatus()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Switch active organization (by orgId, persists lastActiveMembershipId)',
  })
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async useOrganization(
    @Req() req: RequestWithUser,
    @Body() dto: UseOrgDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.useOrganization(
      req.user.userId,
      dto.orgId,
    );
    setAuthCookies(res, result.tokens);
    setCsrfCookie(res, generateCsrfToken());
    // Contract: auth envelope must include context (onboarding redirect depends on context.mode).
    return ok({
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      roles: result.roles ?? [],
      permissions: result.permissions ?? [],
      context: result.context,
    });
  }

  @Post('switch-organization')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowAnyOrgStatus()
  @ApiOperation({
    summary:
      'Switch active organization by membershipId (persists lastActiveMembershipId)',
  })
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async switchOrganization(
    @Req() req: RequestWithUser,
    @Body() dto: SwitchOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchOrganization(
      req.user.userId,
      dto.membershipId,
    );
    setAuthCookies(res, result.tokens);
    setCsrfCookie(res, generateCsrfToken());
    return ok({
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      roles: result.roles ?? [],
      activeRole: result.activeRole ?? null,
      permissions: result.permissions ?? [],
    });
  }

  @Post('switch-role')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowAnyOrgStatus()
  @ApiOperation({
    summary:
      'Switch active role context within the active membership (multi-role; persists lastActiveRole)',
  })
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async switchRole(
    @Req() req: RequestWithUser,
    @Body() dto: SwitchRoleDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchRoleContext(
      req.user.userId,
      req.user.membershipId ?? null,
      dto.role,
    );
    setAuthCookies(res, result.tokens);
    setCsrfCookie(res, generateCsrfToken());
    return ok({
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      roles: result.roles ?? [],
      activeRole: result.activeRole ?? null,
      permissions: result.permissions ?? [],
      context: result.context,
    });
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change password (authenticated user)' })
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async changePassword(
    @Req() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    const ctx = {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };
    await this.authService.changePassword(req.user.userId, dto, ctx);
    return ok({ ok: true });
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset email' })
  @Throttle({ default: { limit: 5, ttl: seconds(900) } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ctx = {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };
    return ok(await this.authService.requestPasswordReset(dto, ctx));
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @Throttle({ default: { limit: 5, ttl: seconds(900) } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ctx = {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };
    await this.authService.resetPasswordWithToken(dto, ctx);
    return ok({ ok: true });
  }
}
