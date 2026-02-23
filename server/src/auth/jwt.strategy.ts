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
import { SystemRole } from '@prisma/client';

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
    private readonly configService: ConfigService,
  ) {
    const tokenExtractor = ExtractJwt.fromExtractors([
      cookieExtractor,
      bearerExtractor,
      sessionHeaderExtractor,
    ]);
    const secret = configService.get<string>('JWT_SECRET');
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('JWT_SECRET is required in production');
    }
    const effectiveSecret =
      secret ||
      (process.env.NODE_ENV !== 'production'
        ? (() => {
            // eslint-disable-next-line no-console
            console.warn('JWT_SECRET not set. Using insecure development mode.');
            return 'insecure-local-only';
          })()
        : undefined);
    if (!effectiveSecret) {
      throw new Error('JWT_SECRET is required in production');
    }
    super({
      jwtFromRequest: tokenExtractor,
      secretOrKey: effectiveSecret,
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
        isPlatformAdmin: true,
        passwordChangedAt: true,
        tokenVersion: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

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
