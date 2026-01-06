import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RequestWithUser } from '@/types/request-with-user';
import { Throttle } from '@nestjs/throttler';
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
import { ApiStandardResponses } from '@/common/http/api-standard-responses.decorator';

@ApiTags('auth')
@ApiStandardResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  private readonly logger = new Logger(AuthController.name);

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @Throttle({ default: { limit: 3, ttl: 60 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.register(dto);
      setAuthCookies(res, result.tokens);
      return {
        user: result.user,
        organization: result.organization,
        membership: result.membership,
      };
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
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Registration failed');
    }
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.login(dto);
      setAuthCookies(res, result.tokens);
      setCsrfCookie(res, generateCsrfToken());
      return ok({
        user: result.user,
        sessionToken: result.tokens.accessToken,
      });
    } catch (error) {
      this.logger.error(
        'Login failed',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 600 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) {
      clearAuthCookies(res);
      throw new BadRequestException('Refresh token is required');
    }
    const tokens = await this.authService.refreshToken(token);
    setAuthCookies(res, tokens);
    setCsrfCookie(res, generateCsrfToken());
    return ok({ refreshed: true });
  }

  @Public()
  @Post('logout')
  @ApiBearerAuth()
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Req() req: RequestWithUser) {
    return ok(await this.authService.getUserProfile(req.user.userId));
  }

  @Post('use-org')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Switch active organization' })
  @Throttle({ default: { limit: 10, ttl: 60 } })
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
    return ok({
      user: result.user,
      organization: result.organization,
      membership: result.membership,
      sessionToken: result.tokens.accessToken,
    });
  }
}
