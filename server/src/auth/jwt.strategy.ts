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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId ?? payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        systemRole: true,
        memberships: {
          where: { deletedAt: null },
          select: { organizationId: true, role: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Preferuj org z query/body (list/create), jinak nech payload, jinak první členství
    const requestedOrgId =
      (req.query?.organizationId as string) ??
      (req.body as any)?.organizationId ??
      null;

    let organizationRole = payload.organizationRole ?? payload.role ?? null;
    let organizationId = payload.organizationId ?? null;

    if (requestedOrgId) {
      const m = user.memberships?.find(
        (x) => x.organizationId === requestedOrgId,
      );
      if (m) {
        organizationRole = m.role;
        organizationId = m.organizationId;
      } else {
        throw new ForbiddenException({
          statusCode: 403,
          message: 'Forbidden: organization scope not allowed for user',
        });
      }
    }
    if (!organizationRole && user.memberships?.length) {
      const firstMembership = user.memberships[0];
      if (firstMembership) {
        organizationRole = firstMembership.role;
        organizationId = firstMembership.organizationId;
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
    };
  }
}
