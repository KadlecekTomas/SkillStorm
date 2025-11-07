// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';
import {
  Membership,
  User,
  Prisma,
  SystemRole,
  OrganizationRole,
} from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type JwtClaims = {
  sub: string;
  email: string | null;
  username: string | null;
  systemRole: SystemRole | null;
  organizationRole: OrganizationRole | null;
  organizationId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------
  // Helpers
  // -------------------------
  private normalize(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private async ensureUniqueUsername(baseInput: string) {
    const base =
      (this.normalize(baseInput) || 'user')
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 16) || 'user';
    let candidate = base;
    let i = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      candidate = `${base}${i++}`;
    }
  }

  private buildClaims(user: User, membership: Membership | null): JwtClaims {
    return {
      sub: user.id,
      email: user.email ?? null,
      username: user.username ?? null,
      systemRole: user.systemRole ?? null,
      organizationRole: membership?.role ?? null,
      organizationId: membership?.organizationId ?? null,
    };
  }

  // ---------- Refresh token (opaque + retry na P2002) ----------
  private async issueRefreshToken(userId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const token = randomBytes(48).toString('hex'); // 96 znaků
        await this.prisma.refreshToken.create({
          data: {
            token,
            userId,
            expiresAt: addDays(new Date(), 7),
          },
        });
        return token;
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          // unikátní kolize tokenu – zkusíme znova
          continue;
        }
        throw e;
      }
    }
    throw new Error('Failed to issue refresh token after retries');
  }

  private async generateTokens(user: User, membership: Membership | null) {
    const claims = this.buildClaims(user, membership);
    const accessSecret = this.config.get<string>('JWT_SECRET');

    const accessToken = this.jwtService.sign(
      { ...claims },
      {
        secret: accessSecret,
        expiresIn: '15m',
        jwtid: randomUUID(), // unikátní JTI → lepší revokace
      },
    );

    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  // -------------------------
  // Public API
  // -------------------------

  async register(dto: RegisterDto) {
    // Email je volitelný – pokud je, ověř jedinečnost
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        // dřív: throw new BadRequestException('Email already exists');
        throw new ConflictException('Email already exists'); // ← změna na 409
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Username – volitelně z dto, jinak z emailu/jména
    const baseUname =
      dto.username ?? dto.email?.split('@')[0] ?? dto.name ?? 'user';

    // zkusíme 2× kvůli eventualitě závodu (P2002)
    const now = new Date();

    for (let attempt = 0; attempt < 2; attempt++) {
      const username = await this.ensureUniqueUsername(
        attempt === 0
          ? baseUname
          : `${baseUname}${Math.floor(Math.random() * 1000)}`,
      );

      try {
        const user = await this.prisma.user.create({
          data: {
            email: dto.email ?? null,
            username,
            name: dto.name,
            passwordHash,
            systemRole: dto.systemRole ?? null,
            lastLoginAt: now,
          },
        });

        const tokens = await this.generateTokens(user, null);
        return {
          ...tokens,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            name: user.name,
            systemRole: user.systemRole,
            organizationRole: null,
            organizationId: null,
            lastLoginAt: user.lastLoginAt,
          },
        };
      } catch (e) {
        // Prisma unique clash (username/email)
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          // pokud target obsahuje 'email' → vrať 409 hned
          const target = (e.meta as any)?.target as string[] | undefined;
          if (target?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
          // pokud username, zkusíme ještě jednou s jiným suffixem; jinak po 2 pokusech 409
          continue;
        }
        throw e;
      }
    }

    // po 2 pokusech stále kolize username → 409
    throw new ConflictException('Username already exists');
  }

  async login(dto: LoginDto) {
    // login = username NEBO email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.login }, { email: dto.login }],
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');

    // aktualizace lastLoginAt (DB) – ať se propíše i do response
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' }, // deterministicky, pokud má víc členství
    });

    const tokens = await this.generateTokens(updatedUser, membership);

    return {
      ...tokens,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        systemRole: updatedUser.systemRole,
        organizationRole: membership?.role ?? null,
        organizationId: membership?.organizationId ?? null,
        lastLoginAt: updatedUser.lastLoginAt, // ← propsáno ven
      },
    };
  }

  async refreshAccessToken(oldRefreshToken: string) {
    // 1) musí existovat v DB (opaque kontrola)
    const row = await this.prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
    });
    if (!row || row.expiresAt < new Date()) {
      if (row) {
        await this.prisma.refreshToken.delete({
          where: { token: oldRefreshToken },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2) rotate – smaž starý refresh token
    await this.prisma.refreshToken.delete({
      where: { token: oldRefreshToken },
    });

    // 3) získej uživatele + jeho (první) membership pro payload
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    const claims = this.buildClaims(user, membership);

    // 4) nové tokeny
    const accessToken = this.jwtService.sign(
      { ...claims },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
        jwtid: randomUUID(),
      },
    );
    const refreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async logout(accessToken: string, refreshToken: string) {
    // Blacklistni access token (aby nešel použít dál)
    if (accessToken) {
      await this.prisma.revokedToken.create({ data: { token: accessToken } });
    }

    // Smaž refresh token (může existovat i více – smažeme konkrétní)
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async getUserProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        systemRole: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }
}
