import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from 'generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchoolAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const schoolId = request.params.id || request.body.schoolId;

    if (!user) throw new ForbiddenException('Nepřihlášený uživatel.');

    if (user.role === Role.SUPERADMIN) return true;

    if (user.role === Role.DIRECTOR) {
      const directorSchool = await this.prisma.school.findFirst({
        where: { directorId: user.id },
      });
      if (!directorSchool || directorSchool.id !== schoolId) {
        throw new ForbiddenException('Nemáš přístup k této škole.');
      }
      return true;
    }

    if (user.role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { userId: user.id },
      });
      if (!teacher || teacher.schoolId !== schoolId) {
        throw new ForbiddenException('Nemáš přístup k této škole.');
      }
      return true;
    }

    if (user.role === Role.STUDENT) {
      const student = await this.prisma.student.findFirst({
        where: { userId: user.id },
        include: { classroom: true },
      });
      if (!student || student.classroom.schoolId !== schoolId) {
        throw new ForbiddenException('Nemáš přístup k této škole.');
      }
      return true;
    }

    throw new ForbiddenException('Nemáš oprávnění.');
  }
}
