import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateMembershipDto } from './dto/create-membership.dto';
import type { UpdateMembershipDto } from './dto/update-membership.dto';
import type { QueryMembershipsDto } from './dto/query-memberships.dto';
import type { Prisma } from '@prisma/client';
import { SystemRole, OrganizationRole, AuditEntityType } from '@prisma/client';
import { hasAtLeastRole } from '@/shared/access.utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  buildVersionedListKey,
  cacheGetOrSet,
  getOrgVersion,
  bumpOrgVersion,
  makeUserSearch,
} from '@/shared/cache/org-cache.utils';
import { emitRbacInvalidation } from '@/modules/rbac/rbac.events';

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // -------- CREATE --------
  async create(dto: CreateMembershipDto, user: any) {
    // RBAC: director může jen ve své org; superadmin kdekoliv
    const isSuper = user?.systemRole === SystemRole.SUPERADMIN;
    const sameOrg =
      user?.organizationId && user.organizationId === dto.organizationId;
    if (!(isSuper || sameOrg)) {
      throw new ForbiddenException('Cross-organization create is forbidden.');
    }

    // Validace existence org + user
    const [org, memberUser] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      }),
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
    ]);
    if (!org) throw new NotFoundException('Organizace nebyla nalezena');
    if (!memberUser) throw new NotFoundException('Uživatel nebyl nalezen');

    // Unikátní členství v rámci organizace
    const exists = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: dto.userId,
          organizationId: dto.organizationId,
        },
      },
    });
    if (exists) {
      throw new ConflictException('Uživatel je už členem této organizace.');
    }

    const created = await this.prisma.membership.create({ data: dto });

    // invalidace listů v rámci org
    await Promise.all([
      bumpOrgVersion(this.cache, dto.organizationId),
      this.auditMembershipChange({
        action: 'MEMBERSHIP_CREATE',
        membershipId: created.id,
        organizationId: dto.organizationId,
        actorId: user?.userId ?? user?.sub ?? null,
        metadata: { userId: created.userId, role: created.role },
      }),
    ]);
    emitRbacInvalidation({
      userId: created.userId,
      organizationId: created.organizationId,
      reason: 'MEMBERSHIP_CREATE',
    });
    return created;
  }

  // -------- LIST (search + pagination + cache) --------
  async findAll(user: any, q: QueryMembershipsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const isSuper = user?.systemRole === SystemRole.SUPERADMIN;

    // 1) organizationId je POVINNÝ pro všechny (včetně superadmina)
    if (!q.organizationId) {
      throw new BadRequestException('organizationId is required.');
    }

    // 2) RBAC: ne-superadmin → jen ve své org + musí být DIRECTOR
    if (!isSuper) {
      if (user?.organizationId !== q.organizationId) {
        throw new ForbiddenException('Cross-organization list is forbidden.');
      }

      const director = await this.prisma.membership.findFirst({
        where: {
          userId: user?.userId ?? user?.sub,
          organizationId: q.organizationId,
          role: { in: [OrganizationRole.DIRECTOR, OrganizationRole.OWNER] },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!director) {
        throw new ForbiddenException(
          'Access denied (not a director/owner in this organization).',
        );
      }
    }

    // 3) where + search
    const userSearch = makeUserSearch(q.search);
    const where: Prisma.MembershipWhereInput = {
      organizationId: q.organizationId,
      deletedAt: null,
      ...(q.role ? { role: q.role } : {}),
      ...(userSearch ? { user: { is: userSearch } } : {}),
    };

    // 4) stabilní řazení
    const orderBy: Prisma.MembershipOrderByWithRelationInput[] = [
      { user: { name: 'asc' } },
      { id: 'asc' },
    ];

    // 5) cache klíč (scope = org)
    const scopeId = q.organizationId;
    const ver = await getOrgVersion(this.cache, scopeId);
    const cacheKey = buildVersionedListKey({
      namespace: 'memberships',
      scopeId,
      version: ver,
      page,
      limit,
      search: q.search ?? '',
      order: [{ user: { name: 'asc' } }, { id: 'asc' }],
      filters: { role: q.role ?? null },
    });

    return cacheGetOrSet(this.cache, cacheKey, 600_000, async () => {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.membership.count({ where }),
        this.prisma.membership.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            user: {
              select: {
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
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
              },
            },
            teacher: {
              include: {
                subjects: {
                  include: { subject: { select: { id: true, name: true } } },
                },
                homeroomOf: {
                  select: {
                    id: true,
                    grade: true,
                    section: true,
                    label: true,
                    academicYear: {
                      select: { id: true, label: true, isCurrent: true },
                    },
                  },
                },
              },
            },
            student: {
              include: {
                enrollments: {
                  include: {
                    academicYear: {
                      select: { id: true, label: true, isCurrent: true },
                    },
                    classSection: {
                      select: {
                        id: true,
                        grade: true,
                        section: true,
                        label: true,
                      },
                    },
                  },
                },
                StudentClassroom: {
                  include: {
                    classSection: {
                      select: {
                        id: true,
                        grade: true,
                        section: true,
                        label: true,
                      },
                    },
                    TopicLevel: {
                      select: {
                        id: true,
                        phase: true,
                        difficulty: true,
                        subjectLevel: {
                          select: {
                            id: true,
                            grade: true,
                            subject: { select: { id: true, name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

      return {
        items,
        meta: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    });
  }

  // -------- DETAIL (pro interní použití) --------
  async findOne(id: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return membership;
  }

  // -------- UPDATE --------
  async update(id: string, dto: UpdateMembershipDto, user: any) {
    const current = await this.prisma.membership.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Membership not found');

    const isSuper = user?.systemRole === SystemRole.SUPERADMIN;
    const sameOrg = user?.organizationId === current.organizationId;
    const isOwner = user?.organizationRole === OrganizationRole.OWNER;

    if (!isSuper) {
      if (!sameOrg)
        throw new ForbiddenException('Cross-organization update is forbidden.');
      if (current.role === OrganizationRole.OWNER) {
        throw new ForbiddenException('Ownera může upravit pouze SUPERADMIN.');
      }
      if (current.role === OrganizationRole.DIRECTOR && !isOwner) {
        throw new ForbiddenException(
          'Ředitele může upravit pouze SUPERADMIN nebo owner.',
        );
      }
      if (current.userId === (user?.userId ?? user?.sub)) {
        throw new ForbiddenException('Nemůžeš měnit vlastní členství.');
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        userId: true,
        organizationId: true, // 👈 důležité pro invalidaci
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await Promise.all([
      bumpOrgVersion(this.cache, current.organizationId),
      this.auditMembershipChange({
        action: 'MEMBERSHIP_ROLE_CHANGE',
        membershipId: updated.id,
        organizationId: current.organizationId,
        actorId: user?.userId ?? user?.sub ?? null,
        metadata: {
          previousRole: current.role,
          nextRole: updated.role,
          userId: updated.userId,
        },
      }),
    ]);
    emitRbacInvalidation({
      userId: updated.userId,
      organizationId: updated.organizationId,
      reason: 'MEMBERSHIP_ROLE_CHANGE',
    });
    return updated;
  }

  // -------- DELETE --------
  async remove(id: string, user: any) {
    const current = await this.prisma.membership.findUnique({ where: { id } });
    if (!current || current.deletedAt)
      throw new NotFoundException('Membership not found');

    const isSuper = user?.systemRole === SystemRole.SUPERADMIN;
    const sameOrg = user?.organizationId === current.organizationId;
    const isOwner = user?.organizationRole === OrganizationRole.OWNER;

    if (!isSuper) {
      if (!sameOrg)
        throw new ForbiddenException('Cross-organization delete is forbidden.');
      if (current.role === OrganizationRole.OWNER) {
        throw new ForbiddenException('Ownera může odstranit pouze SUPERADMIN.');
      }
      if (current.role === OrganizationRole.DIRECTOR && !isOwner) {
        throw new ForbiddenException(
          'Ředitele může odstranit pouze SUPERADMIN nebo owner.',
        );
      }
      if (current.userId === (user?.userId ?? user?.sub)) {
        throw new ForbiddenException('Nemůžeš smazat vlastní členství.');
      }
    }

    // Soft delete kvůli auditní stopě (submissions/assignments zůstávají čitelné).
    const deleted = await this.prisma.membership.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    const teachers = await this.prisma.teacher.findMany({
      where: { membershipId: id, deletedAt: null },
      select: { id: true },
    });
    const teacherIds = teachers.map((t) => t.id);
    if (teacherIds.length > 0) {
      // Odpoj homeroom vazby + smaž teacher-subject mapování (konfigurační vazby bez historické hodnoty).
      await this.prisma.classSection.updateMany({
        where: { teacherId: { in: teacherIds } },
        data: { teacherId: null },
      });
      await this.prisma.teacherSubject.deleteMany({
        where: { teacherId: { in: teacherIds } },
      });
    }

    await Promise.all([
      this.prisma.teacher.updateMany({
        where: { membershipId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      // Student soft delete; enrollments zůstávají pro auditní stopu.
      this.prisma.student.updateMany({
        where: { membershipId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    await Promise.all([
      bumpOrgVersion(this.cache, current.organizationId),
      this.auditMembershipChange({
        action: 'MEMBERSHIP_DELETE_SOFT',
        membershipId: current.id,
        organizationId: current.organizationId,
        actorId: user?.userId ?? user?.sub ?? null,
        metadata: {
          userId: current.userId,
          role: current.role,
        },
      }),
    ]);
    emitRbacInvalidation({
      userId: current.userId,
      organizationId: current.organizationId,
      reason: 'MEMBERSHIP_DELETE_SOFT',
    });
    return { ...deleted, organizationId: current.organizationId };
  }

  private auditMembershipChange(opts: {
    action: string;
    membershipId: string;
    organizationId: string;
    actorId?: string | null;
    metadata?: Record<string, any>;
  }) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      userId: opts.actorId ?? null,
      organizationId: opts.organizationId,
      entityType: AuditEntityType.PERMISSION,
      entityId: opts.membershipId,
      action: opts.action,
    };
    if (opts.metadata !== undefined) {
      data.metadata = opts.metadata as Prisma.InputJsonValue;
    }
    return this.prisma.auditLog.create({ data });
  }
}
