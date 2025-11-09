import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
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

    // 2️⃣ Ředitel – kontrola, zda má členství v organizaci jako DIRECTOR
    if (user.organizationRole === 'DIRECTOR') {
      const directorMembership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId,
          role: 'DIRECTOR',
        },
      });
      if (!directorMembership) {
        throw new ForbiddenException('Nemáš přístup k této škole.');
      }
      return true;
    }

    // 3️⃣ Učitel
    if (user.organizationRole === 'TEACHER') {
      const teacherMembership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId,
          role: 'TEACHER',
        },
      });
      if (!teacherMembership) {
        throw new ForbiddenException('Nemáš přístup k této škole.');
      }
      return true;
    }

    // 4️⃣ Student
    if (user.organizationRole === 'STUDENT') {
      const studentMembership = await this.prisma.membership.findFirst({
        where: {
          userId: user.userId,
          organizationId,
          role: 'STUDENT',
        },
      });
      if (!studentMembership) {
        throw new ForbiddenException('Nemáš přístup k této škole.');
      }
      return true;
    }

    throw new ForbiddenException('Nemáš oprávnění.');
  }
}
