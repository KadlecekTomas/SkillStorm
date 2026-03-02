import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from './types/jwt-payload';
import { ACCESS_TOKEN_COOKIE } from './token-cookies';
import { SystemRole, UserStatus } from '@prisma/client';

const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();
const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
const sessionHeaderExtractor = (req: Request): string | null => {
  const header = req?.headers?.['x-session-token'];
  if (Array.isArray(header)) {
    return header[0] ?? null;
  }
  return typeof header === 'string' && header.length ? header : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly extractToken: (req: Request) => string | null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    configService: ConfigService,
  ) {
    const tokenExtractor = ExtractJwt.fromExtractors([
      cookieExtractor,
      bearerExtractor,
      sessionHeaderExtractor,
    ]);
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }
    super({
      jwtFromRequest: tokenExtractor,
      secretOrKey: secret,
      ignoreExpiration: false,
      passReqToCallback: true,
    });
    this.extractToken = tokenExtractor;
  }

  async validate(
    req: Request,
    payload: JwtPayload & { sub?: string; role?: string },
  ) {
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const revoked = await this.prisma.revokedToken.findUnique({
      where: { token },
    });
    if (revoked) throw new UnauthorizedException('Token has been revoked');

    const userId = payload.userId ?? payload.sub;
    if (!userId) throw new UnauthorizedException('User not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        systemRole: true,
        status: true,
        deletedAt: true,
        isPlatformAdmin: true,
        passwordChangedAt: true,
        tokenVersion: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status !== UserStatus.ACTIVE || user.deletedAt) {
      throw new UnauthorizedException('Token invalid');
    }

    const iat = (payload as { iat?: number }).iat;
    if (typeof iat !== 'number') {
      throw new UnauthorizedException('Invalid token.');
    }
    if (user.passwordChangedAt) {
      const issuedAtMs = iat * 1000;
      if (issuedAtMs < user.passwordChangedAt.getTime()) {
        throw new UnauthorizedException('Token invalidated due to password change.');
      }
    }
    // tokenVersion mismatch also invalidates (e.g. after reset or admin reset)
    const payloadTokenVersion = (payload as { tokenVersion?: number }).tokenVersion;
    const userTokenVersion = user.tokenVersion ?? 0;
    if (payloadTokenVersion !== userTokenVersion) {
      throw new UnauthorizedException('Token invalidated due to password change.');
    }

    let organizationRole: string | null = null;
    let organizationId: string | null = null;
    let membershipId: string | null = null;

    if (payload.membershipId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          id: payload.membershipId,
          userId: user.id,
          deletedAt: null,
        },
        select: { id: true, organizationId: true, role: true },
      });
      if (!membership) {
        throw new UnauthorizedException('Invalid token: membership not found or revoked');
      }
      organizationId = membership.organizationId;
      organizationRole = membership.role;
      membershipId = membership.id;
    } else {
      organizationRole = null;
      organizationId = null;
      membershipId = null;
    }

    // CONTRACT (effective platform admin): SUPERADMIN is always platform admin (governance).
    // DB flag user.isPlatformAdmin is ONLY for delegated platform admins (non-SUPERADMIN).
    // Effective value must be (user.isPlatformAdmin ?? false) || user.systemRole === SUPERADMIN.
    // PlatformAdminGuard must NOT be changed: it only checks req.user.isPlatformAdmin; this payload supplies it.
    const isPlatformAdmin =
      (user.isPlatformAdmin ?? false) || user.systemRole === SystemRole.SUPERADMIN;

    return {
      userId: user.id,
      email: user.email,
      role: organizationRole ?? null,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      organizationRole: organizationRole ?? null,
      organizationId: organizationId ?? null,
      membershipId: membershipId ?? null,
      isPlatformAdmin,
    };
  }
}
