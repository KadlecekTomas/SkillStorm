import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { OrganizationRole, SystemRole } from '@prisma/client';

export function canAccessStudent(student: any, user: JwtPayload): void {
  if (user.systemRole === SystemRole.SUPERADMIN) return;

  const jwtUserId =
    (user as any).userId ?? (user as any).id ?? (user as any).sub ?? null;

  // ✅ Self access – kontroluj 3 způsoby: membership.user.id, membership.userId i fallback na přímé porovnání, pokud je payload jinak pojmenovaný
  const isSelf =
    (student?.membership?.user?.id &&
      String(student.membership.user.id) === String(jwtUserId)) ||
    (student?.membership?.userId &&
      String(student.membership.userId) === String(jwtUserId));

  if (isSelf) return;

  if (
    user.organizationRole === OrganizationRole.DIRECTOR &&
    student.orgId === user.organizationId
  ) {
    return;
  }

  if (user.organizationRole === OrganizationRole.TEACHER) {
    const teachesThisStudent = (student.enrollments ?? []).some(
      (enr: any) =>
        enr?.academicYear?.isCurrent === true &&
        enr?.classSection?.teacher?.membership?.userId &&
        String(enr.classSection.teacher.membership.userId) ===
          String(jwtUserId),
    );
    if (teachesThisStudent) return;
    throw new ForbiddenException('Tento student není ve tvé třídě.');
  }

  if (user.organizationRole === OrganizationRole.STUDENT) {
    // student může jen sám sebe – když to neprošlo výše, tak zakázat
    throw new ForbiddenException('Nemáš oprávnění zobrazit jiného studenta.');
  }

  throw new UnauthorizedException('Neautorizovaný přístup.');
}
