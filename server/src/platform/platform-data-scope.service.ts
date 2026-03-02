import { Injectable } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type {
  PlatformOrgListDto,
  PlatformOrgDetailDto,
  PlatformUserInternal,
} from './platform.service';

// ---------------------------------------------------------------------------
// Scoped view types
// ---------------------------------------------------------------------------

/**
 * Full organization view — SUPERADMIN only.
 * Includes owner PII (email) and all operational fields.
 */
export type PlatformOrgFullView = PlatformOrgListDto;

/**
 * Restricted organization view — DEVOPS | SUPPORT.
 * Owner email is redacted; structural / operational fields are preserved.
 * Use this for any observability or support role that should not see PII.
 */
export type PlatformOrgRestrictedView = Omit<PlatformOrgListDto, 'ownerEmail'> & {
  ownerEmail: null;
};

export type PlatformOrgScopedView = PlatformOrgFullView | PlatformOrgRestrictedView;

/**
 * Full detail view — SUPERADMIN only.
 */
export type PlatformOrgDetailFullView = PlatformOrgDetailDto;

/**
 * Restricted detail view — DEVOPS | SUPPORT.
 */
export type PlatformOrgDetailRestrictedView = Omit<PlatformOrgDetailDto, 'ownerEmail'> & {
  ownerEmail: null;
};

export type PlatformOrgDetailScopedView =
  | PlatformOrgDetailFullView
  | PlatformOrgDetailRestrictedView;

/**
 * Public user view returned by the platform users endpoint.
 * `anonymized` is stripped — it is never serialized to clients.
 */
export type PlatformUserScopedItem = Omit<PlatformUserInternal, 'anonymized'>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Data scope service for the platform layer.
 *
 * Enforces field-level access control on top of endpoint-level role guards:
 *
 *   SUPERADMIN  → full view (all fields including PII)
 *   DEVOPS      → restricted view (ownerEmail redacted)
 *   SUPPORT     → restricted view (ownerEmail redacted)
 *
 * Rules:
 *  - NEVER return raw Prisma entities from the platform layer.
 *  - ALWAYS pass DTOs through this service before returning them in a controller.
 *  - PII fields (ownerEmail) must NOT reach non-SUPERADMIN callers.
 */
@Injectable()
export class PlatformDataScopeService {
  private isSuperAdmin(user: JwtPayload): boolean {
    return user.systemRole === SystemRole.SUPERADMIN;
  }

  scopeOrganization(
    user: JwtPayload,
    org: PlatformOrgListDto,
  ): PlatformOrgScopedView {
    if (this.isSuperAdmin(user)) {
      return org;
    }
    // DEVOPS / SUPPORT — redact owner PII
    const { ownerEmail: _redacted, ...rest } = org;
    return { ...rest, ownerEmail: null };
  }

  scopeOrganizationList(
    user: JwtPayload,
    items: PlatformOrgListDto[],
  ): PlatformOrgScopedView[] {
    return items.map((org) => this.scopeOrganization(user, org));
  }

  /**
   * Scope users list.
   *
   * - SUPERADMIN / DEVOPS: all users, `anonymized` stripped.
   * - SUPPORT: anonymized users excluded, `anonymized` stripped.
   */
  scopeUsers(
    user: JwtPayload,
    items: PlatformUserInternal[],
  ): PlatformUserScopedItem[] {
    const visible =
      user.systemRole === SystemRole.SUPPORT
        ? items.filter((u) => !u.anonymized)
        : items;
    return visible.map(({ anonymized: _, ...rest }) => rest);
  }

  scopeOrganizationDetail(
    user: JwtPayload,
    org: PlatformOrgDetailDto,
  ): PlatformOrgDetailScopedView {
    if (this.isSuperAdmin(user)) {
      return org;
    }
    const { ownerEmail: _redacted, ...rest } = org;
    return { ...rest, ownerEmail: null };
  }
}
