import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SchoolAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const organizationId = request.params.id || request.body.organizationId;

    if (!user) throw new ForbiddenException('Nepřihlášený uživatel.');

    // 1️⃣ Globální superadmin má přístup všude
    if (user.systemRole === 'SUPERADMIN') return true;

    if (!organizationId) {
      throw new ForbiddenException('Chybí kontext organizace.');
    }

    // 2️⃣ Stačí platné členství v organizaci (role řeší Permission decorator)
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Nemáš přístup k této škole.');
    }
    return true;
  }
}
