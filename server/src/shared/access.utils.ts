// src/modules/shared/access.utils.ts
import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SystemRole, OrganizationRole } from '@prisma/client';
import type { JwtPayload } from '@/auth/types/jwt-payload';

const ROLE_ORDER: Record<OrganizationRole, number> = {
  STUDENT: 1,
  PARENT: 1,
  TEACHER: 2,
  DIRECTOR: 3,
  OWNER: 4,
};

/**
 * Školní personál (TEACHER/DIRECTOR/OWNER) — pozitivní allowlist pro školní
 * pohledy. Guardian audit (docs/guardian.md §1): služby NIKDY nesmí větvit
 * „STUDENT…, TEACHER…, jinak škola" — role mimo tento výčet (dnes PARENT,
 * zítra cokoliv dalšího) musí končit 403, ne školním fallbackem.
 */
export function isSchoolStaffRole(
  role: OrganizationRole | string | null | undefined,
): boolean {
  return (
    role === OrganizationRole.TEACHER ||
    role === OrganizationRole.DIRECTOR ||
    role === OrganizationRole.OWNER
  );
}

export function hasAtLeastRole(
  roleOrMembership:
    | OrganizationRole
    | { role?: OrganizationRole | null }
    | null
    | undefined,
  required: OrganizationRole,
): boolean {
  const role =
    typeof roleOrMembership === 'string'
      ? roleOrMembership
      : (roleOrMembership?.role ?? null);
  if (!role) return false;
  return ROLE_ORDER[role] >= ROLE_ORDER[required];
}

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

  if (
    user.organizationId !== orgId ||
    !hasAtLeastRole(user.organizationRole ?? null, OrganizationRole.TEACHER)
  ) {
    throw new ForbiddenException(
      `Pouze učitel/ředitel/owner dané školy nebo superadmin může spravovat tento ${context}.`,
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
    throw new ForbiddenException(
      `Cross-organization přístup k ${context} není povolen.`,
    );
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

/**
 * Aktivní úvazek učitele (TeacherClassSection) — platnostní okno + soft delete.
 * Volitelný yearId zúží na konkrétní školní rok (úvazek je na rok vázaný
 * i přes classSection, takže vynechání yearId je bezpečné pro obecné scope).
 */
export function activeTeacherClassSectionCondition(
  teacherId: string,
  yearId?: string,
): Prisma.TeacherClassSectionWhereInput {
  const now = new Date();
  return {
    teacherId,
    ...(yearId ? { yearId } : {}),
    deletedAt: null,
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
      { OR: [{ validTo: null }, { validTo: { gte: now } }] },
    ],
  };
}

/**
 * Třídy, které učitel UČÍ: homeroom (třídnictví) NEBO aktivní úvazek.
 * Jednotný vzor pro RBAC i datové scope — nikdy nepoužívat samotné
 * `{ teacherId }` (homeroom-only), viz docs/visual-qa-findings.md.
 */
export function teacherClassScope(
  teacherId: string,
  yearId?: string,
): Prisma.ClassSectionWhereInput {
  return {
    OR: [
      { teacherId },
      { teachers: { some: activeTeacherClassSectionCondition(teacherId, yearId) } },
    ],
  };
}
