import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import type { PermissionKey } from '@prisma/client';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { CacheEntry } from './rbac.types';
import type { RbacInvalidatePayload } from './rbac.events';
import { RBAC_INVALIDATE_EVENT, rbacEvents } from './rbac.events';
import { isPermissionAllowedByDefault } from './rbac.defaults';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class RbacService implements OnModuleDestroy {
  private readonly logger = new Logger(RbacService.name);
  private cache = new Map<string, CacheEntry>();
  private userIndex = new Map<string, Set<string>>();
  private orgIndex = new Map<string, Set<string>>();
  private readonly invalidationHandler = (payload: RbacInvalidatePayload) =>
    this.handleInvalidation(payload);

  constructor(private readonly prisma: PrismaService) {
    rbacEvents.on(RBAC_INVALIDATE_EVENT, this.invalidationHandler);
  }

  onModuleDestroy() {
    rbacEvents.off(RBAC_INVALIDATE_EVENT, this.invalidationHandler);
  }

  async canUser(
    userId: string,
    organizationId: string | null,
    permissionKey: PermissionKey,
  ): Promise<boolean> {
    const cacheKey = this.buildCacheKey(userId, organizationId, permissionKey);
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });
    if (!user) {
      this.setCache(cacheKey, userId, organizationId, false);
      return false;
    }

    if (
      user.systemRole === SystemRole.SUPERADMIN ||
      user.systemRole === SystemRole.DEVOPS
    ) {
      this.setCache(cacheKey, userId, organizationId, true);
      return true;
    }

    const userPermission = await this.prisma.userPermission.findFirst({
      where: {
        userId,
        ...(organizationId === null
          ? { organizationId: null }
          : organizationId
            ? { organizationId }
            : {}),
        permission: { key: permissionKey },
        allowed: true,
      },
    });

    if (userPermission) {
      this.setCache(cacheKey, userId, organizationId, true);
      return true;
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
        deletedAt: null,
      },
      select: { role: true, organizationId: true },
    });

    if (!membership) {
      this.setCache(cacheKey, userId, organizationId, false);
      return false;
    }

    // Invariant: OWNER has full access; bypass all permission checks.
    if (membership.role === OrganizationRole.OWNER) {
      this.setCache(cacheKey, userId, organizationId, true);
      return true;
    }

    const rolePermission = await this.prisma.rolePermission.findFirst({
      where: {
        role: membership.role,
        permission: { key: permissionKey },
        OR: [
          { organizationId: membership.organizationId },
          { organizationId: null },
        ],
      },
      orderBy: { organizationId: 'desc' }, // prefer org-specific over global
      select: { allowed: true },
    });

    const allowed = rolePermission
      ? rolePermission.allowed
      : this.isAllowedByDefault(membership.role, permissionKey);
    this.setCache(cacheKey, userId, organizationId, allowed);
    return allowed;
  }

  async canUserMultiple(
    userId: string,
    organizationId: string | null,
    keys: PermissionKey[],
  ): Promise<Record<string, boolean>> {
    const entries = await Promise.all(
      keys.map(async (key) => ({
        key,
        allowed: await this.canUser(userId, organizationId, key),
      })),
    );

    return entries.reduce<Record<string, boolean>>((acc, entry) => {
      acc[entry.key] = entry.allowed;
      return acc;
    }, {});
  }

  invalidateAll() {
    this.logger.verbose('RBAC cache cleared (global).');
    this.cache.clear();
    this.userIndex.clear();
    this.orgIndex.clear();
  }

  invalidateUser(userId: string) {
    const keys = this.userIndex.get(userId);
    if (!keys) return;
    for (const key of Array.from(keys)) {
      this.deleteKey(key);
    }
  }

  invalidateOrganization(orgId: string | null) {
    const scope = orgId ?? 'global';
    const keys = this.orgIndex.get(scope);
    if (!keys) return;
    for (const key of Array.from(keys)) {
      this.deleteKey(key);
    }
  }

  handleInvalidation(payload: RbacInvalidatePayload) {
    if (payload.userId) {
      this.invalidateUser(payload.userId);
    }
    if (payload.organizationId !== undefined) {
      this.invalidateOrganization(payload.organizationId);
    }
  }

  private buildCacheKey(
    userId: string,
    orgId: string | null,
    key: PermissionKey,
  ) {
    return `${userId}:${orgId ?? 'global'}:${key}`;
  }

  private getFromCache(cacheKey: string) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.deleteKey(cacheKey);
      return undefined;
    }
    return entry.value;
  }

  private setCache(
    cacheKey: string,
    userId: string,
    organizationId: string | null | undefined,
    value: boolean,
  ) {
    const expires = Date.now() + CACHE_TTL_MS;
    this.cache.set(cacheKey, { value, expires, cacheKey });
    this.indexKey(this.userIndex, userId, cacheKey);
    const orgKey = organizationId ?? 'global';
    this.indexKey(this.orgIndex, orgKey, cacheKey);
  }

  private deleteKey(cacheKey: string) {
    if (!this.cache.has(cacheKey)) return;
    this.cache.delete(cacheKey);
    this.removeFromIndex(cacheKey);
  }

  private indexKey(
    index: Map<string, Set<string>>,
    key: string,
    cacheKey: string,
  ) {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)?.add(cacheKey);
  }

  private removeFromIndex(cacheKey: string) {
    const { userId, organizationId } = this.parseCacheKey(cacheKey);
    const userSet = this.userIndex.get(userId);
    if (userSet) {
      userSet.delete(cacheKey);
      if (userSet.size === 0) this.userIndex.delete(userId);
    }
    const orgKey = organizationId ?? 'global';
    const orgSet = this.orgIndex.get(orgKey);
    if (orgSet) {
      orgSet.delete(cacheKey);
      if (orgSet.size === 0) this.orgIndex.delete(orgKey);
    }
  }

  private parseCacheKey(cacheKey: string) {
    const [userId = '', org = 'global', ...rest] = cacheKey.split(':');
    return {
      userId,
      organizationId: org === 'global' ? null : org,
      permission: rest.join(':'),
    };
  }

  private isAllowedByDefault(
    role: OrganizationRole,
    key: PermissionKey,
  ): boolean {
    return isPermissionAllowedByDefault(role, key);
  }

  // no system-workspace shortcuts; permissions are evaluated uniformly
}
