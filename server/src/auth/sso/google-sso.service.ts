import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditEntityType, IdentityProvider, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { AuthService } from '@/auth/auth.service';
import {
  GoogleTokenVerifier,
  type GoogleIdentityProfile,
} from './google-token.verifier';
import type { GoogleSsoLoginDto } from '@/auth/dto/google-sso.dto';

/**
 * The only SSO provider values OrganizationSettings.ssoProvider may carry.
 * The column stays a string for migration safety; every consumer MUST go
 * through isSupportedSsoProvider() — arbitrary strings ("googleeee", "*",
 * "admin") are treated as SSO-disabled.
 */
export const SUPPORTED_SSO_PROVIDERS = ['google'] as const;
export type SupportedSsoProvider = (typeof SUPPORTED_SSO_PROVIDERS)[number];

export function isSupportedSsoProvider(
  value: string | null | undefined,
): value is SupportedSsoProvider {
  return (
    typeof value === 'string' &&
    (SUPPORTED_SSO_PROVIDERS as readonly string[]).includes(value)
  );
}

/** Error code surfaced when a multi-org user must pick an organization. */
export const SSO_ORG_SELECTION_REQUIRED = 'SSO_ORG_SELECTION_REQUIRED';

type OrgSsoPolicy = {
  organizationId: string;
  autoProvision: boolean;
};

type SsoFailureAction =
  | 'SSO_INVALID_TOKEN'
  | 'SSO_DOMAIN_MISMATCH_GOOGLE'
  | 'SSO_MEMBERSHIP_REQUIRED_FAILED'
  | 'SSO_LOGIN_GOOGLE_FAILED';

/**
 * Organization-scoped Google SSO identity layer — PILOT ID-TOKEN FLOW.
 *
 * This is deliberately NOT a full backend-first authorization-code flow
 * (no /start, /callback, no client secret, no Google session). The client
 * obtains a one-shot Google ID token (GIS) and POSTs it here; the backend
 * only verifies it and never stores or logs it. The production/enterprise
 * upgrade path (authorization-code flow) is documented in
 * docs/google-sso-architecture.md.
 *
 * Flow (POST /auth/sso/google):
 * 1. Verify the Google ID token server-side (issuer, audience, expiry,
 *    verified e-mail required).
 * 2. If an organizationId is supplied, enforce that organization's SSO
 *    policy: supported `ssoProvider` and, when configured, the e-mail
 *    domain allowlist (`ssoAllowedDomains`).
 * 3. Existing UserIdentity (provider, sub) → login as the linked user.
 * 4. Otherwise an existing local user with the same verified e-mail →
 *    link a new identity (provenance: the admitting organization) and login.
 * 5. Otherwise auto-provision a passwordless local account, but only when
 *    the organization's policy explicitly enables `ssoAutoProvision`.
 *    Memberships are NOT created here — role assignment stays in the
 *    invite flow.
 *
 * Organization selection is always explicit: when no organizationId is
 * supplied and the user belongs to more than one organization, the login
 * fails with SSO_ORG_SELECTION_REQUIRED instead of silently picking one.
 *
 * The whole endpoint is gated by GOOGLE_SSO_ENABLED (defaults to off).
 */
@Injectable()
export class GoogleSsoService {
  private readonly logger = new Logger(GoogleSsoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly verifier: GoogleTokenVerifier,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('GOOGLE_SSO_ENABLED') === 'true';
  }

  private assertEnabled() {
    if (!this.isEnabled()) {
      // 404 (not 403) so the endpoint is indistinguishable from a missing
      // route while the feature is dark. Intentionally NOT audited: the
      // audit trail would otherwise be a spam vector while disabled.
      throw new NotFoundException();
    }
  }

  /**
   * Audit an SSO failure. Never receives or logs token material — only
   * coarse reason codes and (when known) user/organization ids.
   */
  private async auditFailure(
    action: SsoFailureAction,
    details: { userId?: string | null; organizationId?: string | null },
  ) {
    try {
      await this.auditService.log({
        action,
        entityType: AuditEntityType.USER,
        userId: details.userId ?? null,
        organizationId: details.organizationId ?? null,
        entityId: details.userId ?? null,
      });
    } catch (error) {
      // Audit must never mask the original auth error.
      this.logger.error(
        'SSO failure audit write failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async loginWithGoogle(dto: GoogleSsoLoginDto) {
    this.assertEnabled();

    let profile: GoogleIdentityProfile;
    try {
      profile = await this.verifier.verify(dto.idToken);
    } catch (error) {
      await this.auditFailure('SSO_INVALID_TOKEN', {
        organizationId: dto.organizationId ?? null,
      });
      throw error;
    }
    if (!profile.email || !profile.emailVerified) {
      await this.auditFailure('SSO_INVALID_TOKEN', {
        organizationId: dto.organizationId ?? null,
      });
      throw new UnauthorizedException('Google account e-mail is not verified.');
    }

    const orgPolicy = await this.resolveOrgPolicy(
      dto.organizationId ?? null,
      profile,
    );

    // 1) Known identity → straight login.
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: IdentityProvider.GOOGLE,
          providerSubject: profile.subject,
        },
      },
    });
    if (identity) {
      await this.prisma.userIdentity.update({
        where: { id: identity.id },
        data: {
          lastUsedAt: new Date(),
          email: profile.email,
          emailVerified: true,
          displayName: profile.name,
        },
      });
      return this.issueScopedSession(
        identity.userId,
        dto.organizationId ?? null,
      );
    }

    // 2) Existing local account with the same verified e-mail → link.
    const user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (user) {
      if (
        user.status !== UserStatus.ACTIVE ||
        user.deletedAt ||
        user.anonymized
      ) {
        await this.auditFailure('SSO_LOGIN_GOOGLE_FAILED', {
          userId: user.id,
          organizationId: orgPolicy?.organizationId ?? null,
        });
        throw new UnauthorizedException('Account disabled');
      }
      await this.prisma.userIdentity.create({
        data: {
          userId: user.id,
          organizationId: orgPolicy?.organizationId ?? null,
          provider: IdentityProvider.GOOGLE,
          providerSubject: profile.subject,
          email: profile.email,
          emailVerified: true,
          displayName: profile.name,
          lastUsedAt: new Date(),
        },
      });
      await this.auditService.log({
        action: 'SSO_IDENTITY_LINKED_GOOGLE',
        entityType: AuditEntityType.USER,
        userId: user.id,
        organizationId: orgPolicy?.organizationId ?? null,
        entityId: user.id,
      });
      return this.issueScopedSession(user.id, dto.organizationId ?? null);
    }

    // 3) Unknown identity and no matching account → org-scoped provisioning.
    if (!orgPolicy?.autoProvision) {
      await this.auditFailure('SSO_LOGIN_GOOGLE_FAILED', {
        organizationId: orgPolicy?.organizationId ?? null,
      });
      throw new UnauthorizedException(
        'No account is linked to this Google identity.',
      );
    }
    const created = await this.provisionUser(profile, orgPolicy.organizationId);
    return this.authService.issueSessionForVerifiedUser(created.id, {
      // The freshly provisioned user has no membership yet; membership/role
      // assignment is handled by the invite flow.
      organizationId: null,
      auditAction: 'SSO_LOGIN_GOOGLE',
    });
  }

  /**
   * Explicit organization selection (no "first membership wins"):
   * - organizationId supplied → the user must be a member (enforced by
   *   AuthService.resolveSessionMembership, which throws otherwise).
   * - organizationId missing → 0 memberships = personal session,
   *   1 membership = that one, >1 memberships = SSO_ORG_SELECTION_REQUIRED.
   */
  private async issueScopedSession(
    userId: string,
    requestedOrganizationId: string | null,
  ) {
    let organizationId = requestedOrganizationId;
    if (!organizationId) {
      const memberships = await this.prisma.membership.findMany({
        where: { userId, deletedAt: null },
        select: { organizationId: true },
        take: 2,
      });
      if (memberships.length > 1) {
        await this.auditFailure('SSO_MEMBERSHIP_REQUIRED_FAILED', { userId });
        throw new BadRequestException({
          message:
            'Účet patří do více organizací. Zvolte organizaci (organizationId).',
          code: SSO_ORG_SELECTION_REQUIRED,
        });
      }
      organizationId = memberships[0]?.organizationId ?? null;
    }

    try {
      return await this.authService.issueSessionForVerifiedUser(userId, {
        organizationId,
        auditAction: 'SSO_LOGIN_GOOGLE',
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.auditFailure('SSO_MEMBERSHIP_REQUIRED_FAILED', {
          userId,
          organizationId,
        });
      }
      throw error;
    }
  }

  private async resolveOrgPolicy(
    organizationId: string | null,
    profile: GoogleIdentityProfile,
  ): Promise<OrgSsoPolicy | null> {
    if (!organizationId) return null;

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      include: { settings: true },
    });
    // Generic message: do not leak which organizations exist or how they
    // are configured to unauthenticated callers. Unsupported provider
    // strings (anything outside SUPPORTED_SSO_PROVIDERS) mean SSO is off.
    if (!org || !isSupportedSsoProvider(org.settings?.ssoProvider)) {
      await this.auditFailure('SSO_LOGIN_GOOGLE_FAILED', { organizationId });
      throw new UnauthorizedException(
        'Google SSO is not enabled for this organization.',
      );
    }

    const allowedDomains = (org.settings.ssoAllowedDomains ?? [])
      .map((domain) => domain.trim().replace(/^@/, '').toLowerCase())
      .filter(Boolean);
    if (allowedDomains.length > 0) {
      const emailDomain =
        profile.email?.split('@')[1]?.toLowerCase() ??
        profile.hostedDomain?.toLowerCase() ??
        '';
      if (!allowedDomains.includes(emailDomain)) {
        await this.auditFailure('SSO_DOMAIN_MISMATCH_GOOGLE', {
          organizationId: org.id,
        });
        throw new UnauthorizedException(
          'E-mail domain is not allowed for this organization.',
        );
      }
    }

    return {
      organizationId: org.id,
      autoProvision: org.settings.ssoAutoProvision === true,
    };
  }

  private async provisionUser(
    profile: GoogleIdentityProfile,
    organizationId: string,
  ) {
    // Random unusable password: the account can only authenticate via SSO
    // until the user performs a password reset through the standard flow.
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: profile.email,
          name: profile.name ?? profile.email ?? 'SSO user',
          passwordHash,
        },
      });
      await tx.userIdentity.create({
        data: {
          userId: user.id,
          organizationId,
          provider: IdentityProvider.GOOGLE,
          providerSubject: profile.subject,
          email: profile.email,
          emailVerified: true,
          displayName: profile.name,
          lastUsedAt: new Date(),
        },
      });
      return user;
    });

    await this.auditService.log({
      action: 'SSO_USER_PROVISIONED_GOOGLE',
      entityType: AuditEntityType.USER,
      userId: created.id,
      organizationId,
      entityId: created.id,
    });
    this.logger.log(
      JSON.stringify({
        event: 'sso_user_provisioned',
        provider: 'google',
        userId: created.id,
        organizationId,
      }),
    );
    return created;
  }
}
