import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  GuardianPermissionKey,
  GuardianRelationStatus,
  OrganizationRole,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export const GUARDIAN_PERMISSION_KEY = 'requireGuardianPermission';

/**
 * Endpoint nad konkrétním dítětem (`:studentId`): vyžaduje aktivní roli
 * PARENT, VERIFIED vztah k dítěti a dané oprávnění NA TOM vztahu.
 */
export const RequireGuardianPermission = (key: GuardianPermissionKey) =>
  SetMetadata(GUARDIAN_PERMISSION_KEY, key);

/**
 * Server je jediný soudce identity (neporušitelný princip 3): studentId
 * z URL se nikdy nepřijímá bez ověření vztahu. Sémantika chyb (STOP #2 §4):
 * - žák mimo organizaci rodiče / neexistuje → 404 (nepotvrzujeme existenci),
 * - žák v org, ale bez VERIFIED vztahu s oprávněním → 403,
 * - revokace/expirace vztahu platí okamžitě (čte se DB, ne JWT).
 */
@Injectable()
export class GuardianAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<GuardianPermissionKey>(
      GUARDIAN_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as
      | {
          membershipId?: string;
          organizationId?: string;
          organizationRole?: OrganizationRole;
        }
      | undefined;
    if (
      !user?.membershipId ||
      !user.organizationId ||
      user.organizationRole !== OrganizationRole.PARENT
    ) {
      throw new ForbiddenException('PARENT_ROLE_REQUIRED');
    }

    const studentId = req.params?.studentId as string | undefined;
    if (!studentId) {
      throw new ForbiddenException('STUDENT_SCOPE_REQUIRED');
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        orgId: user.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const relation = await this.prisma.guardianStudentRelation.findFirst({
      where: {
        guardianMembershipId: user.membershipId,
        studentId: student.id,
        status: GuardianRelationStatus.VERIFIED,
        revokedAt: null,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      select: { id: true, permissions: true },
    });
    if (!relation || !relation.permissions.includes(required)) {
      throw new ForbiddenException('NOT_YOUR_CHILD');
    }

    req.guardianRelation = { id: relation.id, studentId: student.id };
    return true;
  }
}
