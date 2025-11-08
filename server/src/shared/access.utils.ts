// src/modules/shared/access.utils.ts
import { ForbiddenException } from '@nestjs/common';
import { Prisma, SystemRole, $Enums } from '@prisma/client';
import { JwtPayload } from 'src/auth/types/jwt-payload';

/**
 * Čtení v rámci stejné organizace (superadmin výjimka).
 */
export function assertSameOrganization(
  resourceOrgId: string,
  user: JwtPayload,
  context = 'zdroj',
) {
  if (user.systemRole === SystemRole.SUPERADMIN) return;
  if (user.organizationId !== resourceOrgId) {
    throw new ForbiddenException(
      `Nemáš oprávnění přistupovat k tomuto ${context}.`,
    );
  }
}

/**
 * Mutace (create/update/delete) – povolen učitel/ředitel v dané org nebo superadmin.
 * context = co spravuješ (např. "předmět", "student", "třída") pro hezkou hlášku.
 */
export function assertTeacherOrDirectorInOrgOrSuperadmin(
  user: JwtPayload,
  orgId: string,
  context = 'zdroj',
) {
  if (user.systemRole === SystemRole.SUPERADMIN) return;

  // Typově bezpečné s Prisma enumy
  const allowedRoles = new Set<$Enums.OrganizationRole>([
    $Enums.OrganizationRole.TEACHER,
    $Enums.OrganizationRole.DIRECTOR,
  ]);

  if (
    user.organizationId !== orgId ||
    !user.organizationRole ||
    !allowedRoles.has(user.organizationRole as $Enums.OrganizationRole)
  ) {
    throw new ForbiddenException(
      `Pouze učitel/ředitel dané školy nebo superadmin může spravovat tento ${context}.`,
    );
  }
}

/**
 * Read‑scope – povol čtení jen v rámci vlastní organizace (superadmin výjimka).
 */
export function assertReadScope(
  user: JwtPayload,
  orgId: string,
  context = 'zdroj',
) {
  if (user.systemRole === SystemRole.SUPERADMIN) return;
  if (user.organizationId !== orgId) {
    throw new ForbiddenException(
      `Přístup k tomuto ${context} je omezen na vlastní organizaci.`,
    );
  }
}

export function assertSameOrganizationIds(
  referenceOrgId: string,
  targetOrgId?: string | null,
  context = 'zdroj',
) {
  if (!referenceOrgId || !targetOrgId) {
    throw new ForbiddenException(
      `Organizace ${context} nelze ověřit (missing organization context).`,
    );
  }
  if (referenceOrgId !== targetOrgId) {
    throw new ForbiddenException(`Cross-organization přístup k ${context} není povolen.`);
  }
}

/**
 * Full‑text pro Subject list.
 * – trim
 * – více polí (subject.name, catalogSubject.name, catalogSubject.code)
 * – normalizace whitespace
 */
export function makeSubjectSearch(
  search?: string,
): Prisma.SubjectWhereInput | undefined {
  const raw = search?.trim();
  if (!raw) return undefined;

  const s = raw.replace(/\s+/g, ' '); // collapse whitespace
  return {
    OR: [
      { name: { contains: s, mode: 'insensitive' } },
      {
        catalogSubject: { is: { name: { contains: s, mode: 'insensitive' } } },
      },
      {
        catalogSubject: { is: { code: { contains: s, mode: 'insensitive' } } },
      },
    ],
  };
}
