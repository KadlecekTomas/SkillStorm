import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const revoked = await this.prisma.revokedToken.findUnique({
      where: { token },
    });
    if (revoked) throw new UnauthorizedException('Token has been revoked');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    let organizationRole = payload.organizationRole ?? null;
    let organizationId = payload.organizationId ?? null;

    if (requestedOrgId) {
      const m = user.memberships?.find(
        (x) => x.organizationId === requestedOrgId,
      );
      if (m) {
        organizationRole = m.role;
        organizationId = m.organizationId;
      }
    }
    if (!organizationRole && user.memberships?.length) {
      organizationRole = user.memberships[0].role;
      organizationId = user.memberships[0].organizationId;
    }

    return {
      userId: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      organizationRole: organizationRole ?? null,
      organizationId: organizationId ?? null,
    };
  }
}
