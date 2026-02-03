import {
  ForbiddenException,
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
    super({
      jwtFromRequest: tokenExtractor,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'dev',
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
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

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
      const memberships = await this.prisma.membership.findMany({
        where: { userId: user.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, organizationId: true, role: true },
      });

      const requestedOrgId =
        (req.query?.organizationId as string) ??
        (req.body as any)?.organizationId ??
        null;

      if (requestedOrgId) {
        const m = memberships.find((x) => x.organizationId === requestedOrgId);
        if (m) {
          organizationRole = m.role;
          organizationId = m.organizationId;
          membershipId = m.id;
        } else {
          throw new ForbiddenException({
            statusCode: 403,
            message: 'Forbidden: organization scope not allowed for user',
          });
        }
      } else {
        const first = memberships[0];
        if (first) {
          organizationRole = first.role;
          organizationId = first.organizationId;
          membershipId = null;
        }
      }
    }

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
      isPlatformAdmin: user.isPlatformAdmin ?? false,
    };
  }
}
