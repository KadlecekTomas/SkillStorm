import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from '@/common/decorators/public.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  extractCookie,
  setAuthCookies,
} from './token-cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}
  private readonly logger = new Logger(AuthController.name);

  private cookieSecurity() {
    return { secure: this.config.get('NODE_ENV') !== 'development' };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @Throttle({ default: { limit: 3, ttl: 60 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.register(dto);
      setAuthCookies(res, result.tokens, this.cookieSecurity());
      return {
        user: result.user,
        organization: result.organization,
        membership: result.membership,
      };
    } catch (error) {
      this.logger.error('Register failed', error instanceof Error ? error.stack : error);
      if (process.env.NODE_ENV === 'test') {
        // eslint-disable-next-line no-console
        console.error('[auth][register]', error);
        if (error instanceof Error) {
          // eslint-disable-next-line no-console
          console.error(error.stack);
        }
      }
      throw error instanceof BadRequestException ? error : new BadRequestException('Registration failed');
    }
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.authService.login(dto);
      setAuthCookies(res, result.tokens, this.cookieSecurity());
      return { user: result.user };
    } catch (error) {
      this.logger.error('Login failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  }

  @Public()
  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshAccessToken(
      dto.refreshToken,
    );
    setAuthCookies(res, tokens, this.cookieSecurity());
    return { success: true };
  }

  @Public()
  @Post('logout')
  @ApiBearerAuth()
  async logout(
    @Req() req: Request,
    @Body('refreshToken') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accessToken = req.headers.authorization?.split(' ')[1];
    const tokenFromCookie =
      refreshToken ?? extractCookie(req, REFRESH_TOKEN_COOKIE);
    const result = await this.authService.logout(
      accessToken,
      tokenFromCookie ?? undefined,
    );
    clearAuthCookies(res, this.cookieSecurity());
    return result;
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Req() req) {
    return this.authService.getUserProfile(req.user.userId);
  }
}
