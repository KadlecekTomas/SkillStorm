import { Injectable } from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import type { AuditLogDto } from './audit.service';

// ---------------------------------------------------------------------------
// Scoped view types
// ---------------------------------------------------------------------------

/** Full audit entry — SUPERADMIN only (includes ipAddress + userAgent). */
export type AuditLogFullView = AuditLogDto;

/** Restricted audit entry — DEVOPS | SUPPORT | DIRECTOR | OWNER. */
export type AuditLogRestrictedView = Omit<AuditLogDto, 'ipAddress' | 'userAgent'> & {
  ipAddress: null;
  userAgent: null;
};

export type AuditLogScopedView = AuditLogFullView | AuditLogRestrictedView;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Field-level scoping for audit log entries.
 *
 * SUPERADMIN  → full view (all fields including ipAddress, userAgent, systemRole)
 * DEVOPS      → no ipAddress, no userAgent (all orgs accessible via platform endpoint)
 * SUPPORT     → no ipAddress, no userAgent (all orgs accessible via platform endpoint)
 * DIRECTOR    → no ipAddress, no userAgent; must match organizationId
 * OWNER       → same as DIRECTOR
 *
 * `scopeAudit` returns null if the caller has no access to the specific entry.
 * `scopeAuditList` filters out null entries automatically.
 */
@Injectable()
export class AuditDataScopeService {
  scopeAudit(
    user: JwtPayload,
    log: AuditLogDto,
  ): AuditLogScopedView | null {
    const isSuperAdmin = user.systemRole === SystemRole.SUPERADMIN;
    const isPlatformRole =
      user.systemRole === SystemRole.DEVOPS ||
      user.systemRole === SystemRole.SUPPORT;

    // SUPERADMIN: full view, all orgs
    if (isSuperAdmin) {
      return log;
    }

    // DEVOPS / SUPPORT: restricted view, all orgs
    if (isPlatformRole) {
      return this.restrict(log);
    }

    // Org roles: restricted view, own org only
    const orgRole = user.organizationRole as OrganizationRole | null | undefined;
    const callerOrgId = user.organizationId ?? null;

    if (
      (orgRole === OrganizationRole.DIRECTOR || orgRole === OrganizationRole.OWNER) &&
      log.organizationId === callerOrgId
    ) {
      return this.restrict(log);
    }

    return null;
  }

  scopeAuditList(
    user: JwtPayload,
    logs: AuditLogDto[],
  ): AuditLogScopedView[] {
    return logs
      .map((log) => this.scopeAudit(user, log))
      .filter((log): log is AuditLogScopedView => log !== null);
  }

  private restrict(log: AuditLogDto): AuditLogRestrictedView {
    const { ipAddress: _ip, userAgent: _ua, ...rest } = log;
    return { ...rest, ipAddress: null, userAgent: null };
  }
}
