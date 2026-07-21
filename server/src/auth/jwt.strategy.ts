import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from './types/jwt-payload';
import { ACCESS_TOKEN_COOKIE } from './token-cookies';
import { SystemRole, UserStatus } from '@prisma/client';
import { getJwtAccessSecret } from './jwt-secrets';

const bearerExtractor = ExtractJwt.fromAuthHeaderAsBearerToken();
const cookieExtractor = (req: Request): string | null =>
  req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;

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
    ]);
    const secret = getJwtAccessSecret(configService);
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
        throw new UnauthorizedException(
          'Token invalidated due to password change.',
        );
      }
    }
    // tokenVersion mismatch also invalidates (e.g. after reset or admin reset)
    const payloadTokenVersion = (payload as { tokenVersion?: number })
      .tokenVersion;
    const userTokenVersion = user.tokenVersion ?? 0;
    if (payloadTokenVersion !== userTokenVersion) {
      throw new UnauthorizedException(
        'Token invalidated due to password change.',
      );
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
        select: {
          id: true,
          organizationId: true,
          role: true,
          roleAssignments: {
            where: { deletedAt: null },
            select: { role: true },
          },
        },
      });
      if (!membership) {
        throw new UnauthorizedException(
          'Invalid token: membership not found or revoked',
        );
      }
      // Multi-role (guardian Etapa A): activeRole claim je platný jen dokud má
      // membership aktivní assignment té role — revokace se projeví příštím
      // requestem (docs/guardian/etapa-a-analyza.md §4.2). Token bez claimu
      // (starý) padá na primární roli.
      if (payload.activeRole) {
        const assigned = membership.roleAssignments.some(
          (assignment) => assignment.role === payload.activeRole,
        );
        if (!assigned) {
          throw new UnauthorizedException('ROLE_CONTEXT_REVOKED');
        }
        organizationRole = payload.activeRole;
      } else {
        organizationRole = membership.role;
      }
      organizationId = membership.organizationId;
      membershipId = membership.id;
    } else {
      organizationRole = null;
      organizationId = null;
      membershipId = null;
    }

    // Guardian Etapa C: token žákovské relace platí jen dokud je relace
    // ACTIVE a neexpirovaná — server je jediný soudce, ukončení platí
    // okamžitě (vzor okamžité revokace rolí z Etapy A). Expirovanou relaci
    // líně překlopíme na EXPIRED, ať ji škola/rodič vidí pravdivě.
    let learningSessionId: string | null = null;
    const sessionClaim = (payload as { learningSessionId?: string })
      .learningSessionId;
    if (sessionClaim) {
      const session = await this.prisma.learningSession.findFirst({
        where: { id: sessionClaim },
        select: { id: true, status: true, expiresAt: true },
      });
      if (!session || session.status !== 'ACTIVE') {
        throw new UnauthorizedException('SESSION_ENDED');
      }
      if (session.expiresAt < new Date()) {
        await this.prisma.learningSession.updateMany({
          where: { id: session.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED', endedAt: new Date() },
        });
        throw new UnauthorizedException('SESSION_ENDED');
      }
      learningSessionId = session.id;
    }

    // CONTRACT (effective platform admin): SUPERADMIN is always platform admin (governance).
    // DB flag user.isPlatformAdmin is ONLY for delegated platform admins (non-SUPERADMIN).
    // Effective value must be (user.isPlatformAdmin ?? false) || user.systemRole === SUPERADMIN.
    // PlatformAdminGuard must NOT be changed: it only checks req.user.isPlatformAdmin; this payload supplies it.
    const isPlatformAdmin =
      (user.isPlatformAdmin ?? false) ||
      user.systemRole === SystemRole.SUPERADMIN;

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
      ...(learningSessionId ? { learningSessionId } : {}),
    };
  }
}
