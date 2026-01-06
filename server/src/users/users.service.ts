// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Prisma } from '@prisma/client';
import { SystemRole, AuditEntityType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { QueryUsersDto } from './dto/query-users.dto';

// pokud to máš jinde, nech cestu dle projektu
import { makeUserSearch } from '@/shared/cache/org-cache.utils';

type ListQuery = { page: number; limit: number; search?: string };

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // -------- výběr bez citlivých polí --------
  private readonly selectSafe = {
    id: true,
    email: true,
    username: true,
    name: true,
    preferredLang: true,
    systemRole: true,
    status: true,
    lastLoginAt: true,
    anonymized: true,
    anonymizedAt: true,
    deletedAt: true,
  } as const;

  // -------- audit helper --------
  private async audit(opts: {
    userId?: string | null;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: any;
    changedFields?: any;
  }) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: opts.userId ?? null,
      organizationId: opts.orgId ?? null,
      entityType: AuditEntityType.USER,
      entityId: opts.entityId ?? null,
      action: opts.action,
    };
    if (opts.metadata !== undefined) {
      data.metadata = opts.metadata as Prisma.InputJsonValue;
    }
    if (opts.changedFields !== undefined) {
      data.changedFields = opts.changedFields as Prisma.InputJsonValue;
    }
    await this.prisma.auditLog.create({ data });
  }

  // -------- cache versioning --------
  private readonly GLOBAL_VER = 'users_version_global';
  private userVerKey = (id: string) => `user_v:${id}`;
  private detailKey = (id: string, ver: string | number) =>
    `users:detail:${id}:v${ver}`;

  private async getGlobalVer() {
    const v = await this.cache.get<number>(this.GLOBAL_VER);
    return typeof v === 'number' ? v : 1;
  }
  private async bumpGlobal() {
    const v = await this.getGlobalVer();
    // TTL musí být objekt; 0 = bez expirace
    await this.cache.set(this.GLOBAL_VER, v + 1, 0);
  }

  private async getUserVer(id: string) {
    const v = await this.cache.get<number>(this.userVerKey(id));
    return typeof v === 'number' ? v : 1;
  }
  private async bumpUser(id: string) {
    const v = await this.getUserVer(id);
    await this.cache.set(this.userVerKey(id), v + 1, 0);
  }

  private async cacheGetOrSet<T>(
    key: string,
    ttlSec: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, ttlSec);
    return fresh;
  }

  // -------- LIST (jednoduchý; nepoužívá controller) --------
  async findAll(q: ListQuery) {
    const skip = (q.page - 1) * q.limit;
    const where: Prisma.UserWhereInput = {
      anonymized: false,
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { username: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const ver = await this.getGlobalVer();
    const cacheKey = `users:list:v${ver}:p${q.page}:l${q.limit}:s=${q.search ?? ''}`;

    return this.cacheGetOrSet(cacheKey, 60, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: this.selectSafe,
          orderBy: [{ name: 'asc' }, { email: 'asc' }],
          skip,
          take: q.limit,
        }),
      ]);
      return {
        data,
        meta: {
          page: q.page,
          limit: q.limit,
          total,
          pages: Math.max(1, Math.ceil(total / q.limit)),
        },
      };
    });
  }

  // -------- DETAIL (verzovaná cache) --------
  async findOneSafe(id: string) {
    const ver = await this.getUserVer(id);
    const cacheKey = this.detailKey(id, ver);

    return this.cacheGetOrSet(cacheKey, 60, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          ...this.selectSafe,
          memberships: {
            select: { id: true, organizationId: true, role: true },
          },
        },
      });
      if (!user || user.anonymized || user.deletedAt) {
        throw new NotFoundException('User not found');
      }
      return user;
    });
  }

  // -------- CREATE --------
  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const created = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username ?? null,
          name: dto.name,
          preferredLang: dto.preferredLang ?? null,
          passwordHash,
          systemRole: dto.systemRole ?? null,
        },
        select: this.selectSafe,
      });

      await this.audit({
        action: 'USER_CREATE',
        entityId: created.id,
        changedFields: { ...dto, password: '***' },
      });

      await this.bumpGlobal(); // invalidace listů
      return { user: created, affectedOrgIds: [] as string[] };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.some((t) => t.includes('email'))) {
          throw new ConflictException('Email už existuje.');
        }
        if (target.some((t) => t.includes('username'))) {
          throw new ConflictException('Username už existuje.');
        }
      }
      throw error;
    }
  }

  // -------- UPDATE --------
  async update(
    id: string,
    dto: UpdateUserDto,
    opts: { requesterIsSuperadmin: boolean; requesterId: string },
  ) {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        systemRole: true,
        anonymized: true,
        deletedAt: true,
      },
    });
    if (!current || current.anonymized || current.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (dto.systemRole !== undefined && !opts.requesterIsSuperadmin) {
      throw new ForbiddenException('Změnu systemRole smí jen SUPERADMIN.');
    }
    if (
      opts.requesterIsSuperadmin &&
      opts.requesterId === id &&
      dto.systemRole !== undefined &&
      current.systemRole === SystemRole.SUPERADMIN &&
      dto.systemRole !== SystemRole.SUPERADMIN
    ) {
      throw new ForbiddenException('Nelze si odebrat roli SUPERADMIN.');
    }

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.preferredLang !== undefined) data.preferredLang = dto.preferredLang;
    if (dto.systemRole !== undefined) data.systemRole = dto.systemRole;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data,
        select: this.selectSafe,
      });

      await this.audit({
        userId: opts.requesterId,
        action: 'USER_UPDATE',
        entityId: id,
        changedFields: { ...dto, password: dto.password ? '***' : undefined },
      });

      const memberships = await this.prisma.membership.findMany({
        where: { userId: id },
        select: { organizationId: true },
      });
      const affectedOrgIds = [
        ...new Set(memberships.map((m) => m.organizationId)),
      ];

      // invalidace listů + detailu (přes bump verze)
      await this.bumpGlobal();
      await this.bumpUser(id);

      return { user: updated, affectedOrgIds };
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.some((t) => t.includes('email'))) {
          throw new ConflictException('Email už existuje.');
        }
        if (target.some((t) => t.includes('username'))) {
          throw new ConflictException('Username už existuje.');
        }
      }
      throw error;
    }
  }

  // -------- DELETE / anonymizace --------
  async remove(id: string, requester: any) {
    // Soft delete + anonymizace: historická data zůstávají, osobní údaje ne.
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        systemRole: true,
        anonymized: true,
        deletedAt: true,
        memberships: { select: { organizationId: true } },
      },
    });
    if (!target || target.anonymized || target.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const requesterIsSuperadmin = requester.systemRole === 'SUPERADMIN';
    if (target.systemRole === SystemRole.SUPERADMIN && !requesterIsSuperadmin) {
      throw new ForbiddenException('Smazat SUPERADMINa smí pouze SUPERADMIN.');
    }
    if (!requesterIsSuperadmin) {
      const sameOrg = target.memberships.some(
        (m) => m.organizationId === requester.organizationId,
      );
      const isDirector = requester.organizationRole === 'DIRECTOR';
      if (!(sameOrg && isDirector)) {
        throw new ForbiddenException(
          'Nemáš oprávnění smazat tohoto uživatele.',
        );
      }
    }

    const affectedOrgIds = [
      ...new Set(target.memberships.map((m) => m.organizationId)),
    ];

    const anonymizedEmail = `anonymized-${uuidv4()}@deleted.local`;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: anonymizedEmail,
        username: null,
        name: 'Deleted User',
        status: 'INACTIVE',
        anonymized: true,
        deletedAt: new Date(),
      },
      select: this.selectSafe,
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });

    await this.audit({
      userId: requester.userId ?? null,
      action: 'USER_DELETE_SOFT',
      entityId: id,
      metadata: {
        requesterOrgId: requester.organizationId ?? null,
      } as Prisma.InputJsonValue,
    });

    // bump verze → další GET detailu sáhne na nový klíč a vrátí 404
    await this.bumpGlobal();
    await this.bumpUser(id);

    return { user: updated, affectedOrgIds };
  }

  // -------- last login (bez list cache; ať se hned projeví v detailu) --------
  async updateLastLogin(userId: string) {
    const res = await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: this.selectSafe,
    });
    await this.bumpUser(userId);
    return res;
  }

  // -------- LIST (plně filtrovaný/řazený; používá controller) --------
  async findAllQuery(requester: any, q: QueryUsersDto) {
    const page = q.page ?? 1;
    const limit = Math.min(200, q.limit ?? 50);
    const skip = (page - 1) * limit;

    let membershipsFilter: Prisma.MembershipWhereInput | undefined;

    if (requester.systemRole !== 'SUPERADMIN') {
      membershipsFilter = {
        ...(membershipsFilter ?? {}),
        organizationId: requester.organizationId,
      };
    }

    if (requester.systemRole === 'SUPERADMIN' && q.organizationId) {
      membershipsFilter = {
        ...(membershipsFilter ?? {}),
        organizationId: q.organizationId,
      };
    }

    if (q.hasOrgRole) {
      membershipsFilter = {
        ...(membershipsFilter ?? {}),
        role: q.hasOrgRole,
      };
    }

    const where: Prisma.UserWhereInput = {
      anonymized: false,
      deletedAt: null,
      ...(membershipsFilter
        ? { memberships: { some: membershipsFilter } }
        : {}),
      ...(makeUserSearch(q.search) ?? {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput =
      q.orderBy === 'email'
        ? { email: q.orderDir ?? 'asc' }
        : q.orderBy === 'username'
          ? { username: q.orderDir ?? 'asc' }
          : q.orderBy === 'lastLoginAt'
            ? { lastLoginAt: q.orderDir ?? 'asc' }
            : { name: q.orderDir ?? 'asc' };

    const ver = await this.getGlobalVer();
    const cacheKey = [
      'users:q',
      `v${ver}`,
      `p${page}`,
      `l${limit}`,
      `s=${(q.search ?? '').trim().toLowerCase()}`,
      `org=${q.organizationId ?? (requester.systemRole === 'SUPERADMIN' ? 'ALL' : (requester.organizationId ?? '-'))}`,
      `role=${q.hasOrgRole ?? '-'}`,
      `ob=${q.orderBy ?? 'name'}`,
      `od=${q.orderDir ?? 'asc'}`,
    ].join(':');

    return this.cacheGetOrSet(cacheKey, 60, async () => {
      const [total, data] = await this.prisma.$transaction([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          select: {
            ...this.selectSafe,
            memberships: {
              select: {
                id: true,
                role: true,
                organization: { select: { id: true, name: true } },
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
      ]);

      return {
        data,
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }
}
