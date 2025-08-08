// src/modules/students/utils/access.utils.ts
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import { OrganizationRole, SystemRole } from '@prisma/client';

export function canAccessStudent(student: any, user: JwtPayload): void {
  if (user.systemRole === SystemRole.SUPERADMIN) return;

  // Ředitel v rámci organizace
  if (
    user.organizationRole === OrganizationRole.DIRECTOR &&
    student.orgId === user.organizationId
  )
    return;

  // Učitel – přístup pokud je třídní u některého z jeho Enrollmentů (ideálně current year)
  if (user.organizationRole === OrganizationRole.TEACHER) {
    const teachesThisStudent = (student.enrollments ?? []).some(
      (enr: any) =>
        enr.classSection?.teacher?.membership?.userId === user.userId &&
        enr.academicYear?.isCurrent === true,
    );
    if (teachesThisStudent) return;
    throw new ForbiddenException('Tento student není ve tvé třídě.');
  }

  // Student – sám sobě
  if (user.organizationRole === OrganizationRole.STUDENT) {
    if (student.membership?.user?.id === user.userId) return;
    throw new ForbiddenException('Nemáš oprávnění zobrazit jiného studenta.');
  }

  throw new UnauthorizedException('Neautorizovaný přístup.');
}
