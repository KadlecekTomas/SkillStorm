import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SetHomeroomDto } from './dto/set-homeroom.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  bumpOrgVersion,
  cacheScopeForUser,
} from '../../shared/cache/org-cache.utils';

@Injectable()
export class ClassSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async setHomeroom(
    classSectionId: string,
    dto: SetHomeroomDto,
    user: JwtPayload,
  ) {
    const cls = await this.prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: { id: true, orgId: true, teacherId: true },
    });
    if (!cls) throw new NotFoundException('Třída nebyla nalezena.');

    const sameOrg = user.organizationId === cls.orgId;
    const isDirector = user.organizationRole === OrganizationRole.DIRECTOR;

    if (
      !(user.systemRole === SystemRole.SUPERADMIN || (sameOrg && isDirector))
    ) {
      throw new ForbiddenException(
        'Pouze ředitel dané školy nebo superadmin může měnit třídnictví.',
      );
    }

    const teacherId: string | null = dto.teacherId ?? null;

    if (teacherId) {
      // ověř, že teacher existuje, není smazaný a patří do stejné org
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true, organizationId: true, deletedAt: true },
      });
      if (!teacher || teacher.deletedAt)
        throw new NotFoundException('Učitel nebyl nalezen.');
      if (teacher.organizationId !== cls.orgId) {
        throw new ForbiddenException(
          'Učitel není ze stejné organizace jako třída.',
        );
      }
    }

    const updated = await this.prisma.classSection.update({
      where: { id: classSectionId },
      data: { teacherId },
      include: {
        academicYear: true, // obsahuje orgId → použije se pro InvalidateScopes
        teacher: { include: { membership: { include: { user: true } } } },
      },
    });

    // pro jistotu i service‑level bump (kontrolní síť)
    const scope = cacheScopeForUser(user.systemRole, cls.orgId);
    await bumpOrgVersion(this.cache, scope);

    return updated;
  }
}
