import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, SystemRole, AuditEntityType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { QueryUsersDto } from './dto/query-users.dto';
import { makeUserSearch } from 'shared/cache/org-cache.utils';

type ListQuery = { page: number; limit: number; search?: string };

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ---- safe select (bez hashů) ----
  private selectSafe = {
    id: true,
    email: true,
    username: true,
    name: true,
    preferredLang: true,
    systemRole: true,
    status: true,
    lastLoginAt: true,
    isAnonymized: true,
    deletedAt: true,
  } as const;

  // ---- audit helper ----
  private async audit(opts: {
    userId?: string | null;
    orgId?: string | null;
    action: string;
    entityId?: string | null;
    metadata?: any;
    changedFields?: any;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        organizationId: opts.orgId ?? null,
        entityType: AuditEntityType.USER,
        entityId: opts.entityId ?? null,
        action: opts.action,
        metadata: opts.metadata ?? null,
        changedFields: opts.changedFields ?? null,
      },
    });
  }

  // ---- versioning keys ----
  private GLOBAL_VER = 'users_version_global';
  private userVerKey = (id: string) => `user_v:${id}`;

  private async getGlobalVer() {
    const v = await this.cache.get<number>(this.GLOBAL_VER);
    return typeof v === 'number' ? v : 1;
    // necháme implicitně 1, a první bump nastaví -> 2
  }
  private async bumpGlobal() {
    const v = await this.getGlobalVer();
    await this.cache.set(this.GLOBAL_VER, v + 1, 0);
  }
  private async bumpUser(id: string) {
    const key = this.userVerKey(id);
    const v = ((await this.cache.get<number>(key)) ?? 1) + 1;
    await this.cache.set(key, v, 0);
  }

  private async cacheGetOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.cache.get<T>(key);
    if (hit !== undefined && hit !== null) return hit;
    const fresh = await factory();
    await this.cache.set(key, fresh, ttlMs);
    return fresh;
  }

  // -------- LIST (ADMIN) --------
  async findAll(q: ListQuery) {
    const skip = (q.page - 1) * q.limit;
    const where: Prisma.UserWhereInput = {
      isAnonymized: false,
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

    return this.cacheGetOrSet(cacheKey, 60_000, async () => {
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

  // -------- DETAIL --------
  async findOneSafe(id: string) {
    const ver = (await this.cache.get<number>(this.userVerKey(id))) ?? 1;
    const cacheKey = `users:detail:${id}:v${ver}`;

    return this.cacheGetOrSet(cacheKey, 60_000, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          ...this.selectSafe,
          memberships: {
            select: { id: true, organizationId: true, role: true },
          },
        },
      });
      if (!user || user.isAnonymized || user.deletedAt)
        throw new NotFoundException('User not found');
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
      await this.bumpGlobal(); // invaliduj listy

      return created;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.some((t) => t.includes('email')))
          throw new ConflictException('Email už existuje.');
        if (target.some((t) => t.includes('username')))
          throw new ConflictException('Username už existuje.');
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
        isAnonymized: true,
        deletedAt: true,
      },
    });
    if (!current || current.isAnonymized || current.deletedAt)
      throw new NotFoundException('User not found');

    if (dto.systemRole !== undefined && !opts.requesterIsSuperadmin) {
      throw new ForbiddenException('Změnu systemRole smí jen SUPERADMIN.');
    }
    if (
      opts.requesterIsSuperadmin &&
      opts.requesterId === id &&
      dto.systemRole !== undefined
    ) {
      if (
        current.systemRole === SystemRole.SUPERADMIN &&
        dto.systemRole !== SystemRole.SUPERADMIN
      ) {
        throw new ForbiddenException('Nelze si odebrat roli SUPERADMIN.');
      }
    }

    const data: Prisma.UserUpdateInput = {
      email: dto.email ?? undefined,
      username: dto.username ?? undefined,
      name: dto.name ?? undefined,
      preferredLang: dto.preferredLang ?? undefined,
      systemRole: dto.systemRole ?? undefined,
    };
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

      await this.bumpUser(id); // invaliduj detail
      await this.bumpGlobal(); // a i listy (jméno/email se může projevit ve vyhledávání)

      return updated;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.some((t) => t.includes('email')))
          throw new ConflictException('Email už existuje.');
        if (target.some((t) => t.includes('username')))
          throw new ConflictException('Username už existuje.');
      }
      throw error;
    }
  }

  // -------- DELETE (soft/anonymize) --------
  async remove(id: string, requester: any) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        systemRole: true,
        isAnonymized: true,
        deletedAt: true,
        memberships: { select: { organizationId: true } },
      },
    });
    if (!target || target.isAnonymized || target.deletedAt)
      throw new NotFoundException('User not found');

    const requesterIsSuperadmin = requester.systemRole === 'SUPERADMIN';
    if (target.systemRole === SystemRole.SUPERADMIN && !requesterIsSuperadmin) {
      throw new ForbiddenException('Smazat SUPERADMINa smí pouze SUPERADMIN.');
    }
    if (!requesterIsSuperadmin) {
      const sameOrg = target.memberships.some(
        (m) => m.organizationId === requester.organizationId,
      );
      const isDirector = requester.organizationRole === 'DIRECTOR';
      if (!(sameOrg && isDirector))
        throw new ForbiddenException(
          'Nemáš oprávnění smazat tohoto uživatele.',
        );
    }

    const anonymizedEmail = `anonymized-${uuidv4()}@deleted.local`;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: anonymizedEmail,
        username: null,
        name: 'Deleted User',
        status: 'INACTIVE',
        isAnonymized: true,
        deletedAt: new Date(),
      },
      select: this.selectSafe,
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.audit({
      userId: requester.userId ?? null,
      action: 'USER_DELETE_SOFT',
      entityId: id,
    });

    await this.bumpUser(id); // invaliduj detail
    await this.bumpGlobal(); // invaliduj listy

    return updated;
  }

  // -------- last login (bez cache, je to “hot path”) --------
  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: this.selectSafe,
    });
  }

  async findAllQuery(requester: any, q: QueryUsersDto) {
    const page = q.page ?? 1;
    const limit = Math.min(200, q.limit ?? 50);
    const skip = (page - 1) * limit;

    // base scope: jen neanonymizovaní a ne-smazaní
    const base: Prisma.UserWhereInput = {
      isAnonymized: false,
      deletedAt: null,
    };

    // RBAC: pokud není SUPERADMIN → omez na vlastní org přes memberships.some
    const orgFilter: Prisma.UserWhereInput =
      requester.systemRole === 'SUPERADMIN'
        ? q.organizationId
          ? { memberships: { some: { organizationId: q.organizationId } } }
          : {}
        : {
            memberships: { some: { organizationId: requester.organizationId } },
          };

    // filtr role v rámci organizace (přes memberships.some.role)
    const roleFilter: Prisma.UserWhereInput = q.hasOrgRole
      ? { memberships: { some: { role: q.hasOrgRole } } }
      : {};

    const where: Prisma.UserWhereInput = {
      ...base,
      ...orgFilter,
      ...roleFilter,
      ...(makeUserSearch(q.search) ?? {}),
    };

    // orderBy bezpečně mapni na konkrétní pole
    const orderBy: Prisma.UserOrderByWithRelationInput =
      q.orderBy === 'email'
        ? { email: q.orderDir ?? 'asc' }
        : q.orderBy === 'username'
          ? { username: q.orderDir ?? 'asc' }
          : q.orderBy === 'lastLoginAt'
            ? { lastLoginAt: q.orderDir ?? 'asc' }
            : { name: q.orderDir ?? 'asc' }; // default

    // (volitelné) využij tvoji cache verzi pro listy – pokud už máš v UsersService
    // const ver = await this.getGlobalVer();
    // const cacheKey = `users:q:v${ver}:p${page}:l${limit}:s=${q.search ?? ''}:org=${q.organizationId ?? '-'}:role=${q.hasOrgRole ?? '-' }:ob=${q.orderBy}:${q.orderDir}`;
    // return this.cacheGetOrSet(cacheKey, 60_000, async () => { ... });

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
  }
}
