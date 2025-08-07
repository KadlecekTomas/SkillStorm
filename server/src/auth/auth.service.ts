import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, systemRole: user.systemRole };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    // uložit refresh token do DB
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      if (!existing.isAnonymized || existing.status !== 'INACTIVE') {
        throw new BadRequestException('Email already exists');
      }

      // Pokud user existuje, ale byl anonymizován → smažeme jeho starý anonymní záznam
      await this.prisma.user.delete({ where: { id: existing.id } });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        systemRole: dto.systemRole || 'SUPERADMIN',
      },
    });

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Najít organizační roli z Membership
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      select: {
        role: true,
        organizationId: true,
      },
    });

    const organizationRole = membership?.role || null;

    const payload = {
      sub: user.id,
      systemRole: user.systemRole,
      organizationRole,
      organizationId: membership?.organizationId
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        systemRole: user.systemRole,
        organizationRole,
      },
    };
  }

  async refreshAccessToken(oldRefreshToken: string) {
    try {
      // 1. Najdi refresh token v DB
      const existingToken = await this.prisma.refreshToken.findUnique({
        where: { token: oldRefreshToken },
      });

      if (!existingToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 2. Ověř JWT podpis refresh tokenu
      const payload = this.jwtService.verify(oldRefreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // 3. Smaž starý refresh token z DB
      await this.prisma.refreshToken.delete({
        where: { token: oldRefreshToken },
      });

      // 4. Najdi uživatele
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // 5. Vytvoř nový access token
      const newAccessToken = this.jwtService.sign(
        { sub: user.id, systemRole: user.systemRole },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '15m',
        },
      );

      // 6. Vytvoř nový refresh token
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, systemRole: user.systemRole },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      );

      // 7. Ulož nový refresh token do DB
      await this.prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dní
        },
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(accessToken: string, refreshToken: string) {
    // 1. Uložit access token do blacklistu
    await this.prisma.revokedToken.create({
      data: { token: accessToken },
    });

    // 2. Smazat refresh token z DB
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { message: 'Logged out successfully' };
  }

  async getUserProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }
}
