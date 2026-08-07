import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { UsersService } from './users.service';
import type { UpdateSchoolPersonDto } from './dto/update-school-person.dto';

const STAFF_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.DIRECTOR,
  OrganizationRole.TEACHER,
] as const;

function effectiveStaffRole(
  primary: OrganizationRole,
  assigned: OrganizationRole[],
): OrganizationRole | null {
  const roles = new Set<OrganizationRole>([primary, ...assigned]);
  if (roles.has(OrganizationRole.OWNER)) return OrganizationRole.OWNER;
  if (roles.has(OrganizationRole.DIRECTOR)) return OrganizationRole.DIRECTOR;
  if (roles.has(OrganizationRole.TEACHER)) return OrganizationRole.TEACHER;
  return null;
}

@Injectable()
export class SchoolPeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private requireOrganization(user: JwtPayload): string {
    if (user.systemRole === SystemRole.SUPERADMIN && user.organizationId) {
      return user.organizationId;
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Chybí kontext školy.');
    }
    return user.organizationId;
  }

  async list(user: JwtPayload) {
    const organizationId = this.requireOrganization(user);
    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId,
        deletedAt: null,
        user: { deletedAt: null, anonymized: false },
        OR: [
          { role: { in: [...STAFF_ROLES] } },
          {
            roleAssignments: {
              some: { role: { in: [...STAFF_ROLES] }, deletedAt: null },
            },
          },
        ],
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        roleAssignments: {
          where: { deletedAt: null },
          select: { role: true },
        },
      },
      orderBy: [{ user: { name: 'asc' } }, { createdAt: 'asc' }],
    });

    return memberships
      .map((membership) => {
        const role = effectiveStaffRole(
          membership.role,
          membership.roleAssignments.map((assignment) => assignment.role),
        );
        return role
          ? {
              membershipId: membership.id,
              userId: membership.user.id,
              name: membership.user.name,
              email: membership.user.email,
              role,
              createdAt: membership.createdAt,
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async update(
    membershipId: string,
    dto: UpdateSchoolPersonDto,
    user: JwtPayload,
  ) {
    const organizationId = this.requireOrganization(user);
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        deletedAt: true,
        userId: true,
        roleAssignments: {
          where: { deletedAt: null },
          select: { role: true },
        },
      },
    });

    if (!membership || membership.deletedAt) {
      throw new NotFoundException('Člen školy nebyl nalezen.');
    }
    if (membership.organizationId !== organizationId) {
      throw new ForbiddenException('Člena jiné školy nelze upravit.');
    }

    const targetRole = effectiveStaffRole(
      membership.role,
      membership.roleAssignments.map((assignment) => assignment.role),
    );
    if (!targetRole) {
      throw new ForbiddenException('Tento účet není členem vedení ani učitelem.');
    }

    const actorRole = user.activeRole ?? user.organizationRole ?? null;
    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      targetRole === OrganizationRole.OWNER &&
      actorRole !== OrganizationRole.OWNER
    ) {
      throw new ForbiddenException('Účet vlastníka může upravit pouze vlastník.');
    }

    const result = await this.users.update(
      membership.userId,
      {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
      },
      {
        requesterIsSuperadmin: user.systemRole === SystemRole.SUPERADMIN,
        requesterId: user.userId,
      },
    );

    return {
      membershipId: membership.id,
      userId: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: targetRole,
    };
  }
}
