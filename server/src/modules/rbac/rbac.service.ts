import { Injectable } from '@nestjs/common';
import { PermissionKey, SystemRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheEntry } from './rbac.types';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class RbacService {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

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
      this.setCache(cacheKey, false);
      return false;
    }

    if (
      user.systemRole === SystemRole.SUPERADMIN ||
      user.systemRole === SystemRole.DEVOPS
    ) {
      this.setCache(cacheKey, true);
      return true;
    }

    const orgFilter = organizationId ?? undefined;

    const userPermission = await this.prisma.userPermission.findFirst({
      where: {
        userId,
        organizationId: orgFilter,
        permission: { key: permissionKey },
        allowed: true,
      },
    });

    if (userPermission) {
      this.setCache(cacheKey, true);
      return true;
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
      },
      select: { role: true, organizationId: true },
    });

    if (!membership) {
      this.setCache(cacheKey, false);
      return false;
    }

    const rolePermission = await this.prisma.rolePermission.findFirst({
      where: {
        role: membership.role,
        permission: { key: permissionKey },
        OR: [
          { organizationId: membership.organizationId },
          { organizationId: null },
        ],
        allowed: true,
      },
    });

    const allowed = !!rolePermission;
    this.setCache(cacheKey, allowed);
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
      this.cache.delete(cacheKey);
      return undefined;
    }
    return entry.value;
  }

  private setCache(cacheKey: string, value: boolean) {
    this.cache.set(cacheKey, {
      value,
      expires: Date.now() + CACHE_TTL_MS,
    });
  }
}
