type WhereLike = Record<string, unknown>;

export const withOrg = <T extends WhereLike>(
  where: T,
  organizationId: string,
): T & { organizationId: string } => ({
  ...where,
  organizationId,
});

export const withOrgAndYear = <T extends WhereLike>(
  where: T,
  organizationId: string,
  academicYearId: string,
): T & { organizationId: string; academicYearId: string } => ({
  ...where,
  organizationId,
  academicYearId,
});

export const withOrgAndYearKey = <T extends WhereLike>(
  where: T,
  organizationId: string,
  yearId: string,
  yearKey: 'academicYearId' | 'yearId' = 'academicYearId',
): T & {
  organizationId: string;
  academicYearId?: string;
  yearId?: string;
} => ({
  ...where,
  organizationId,
  [yearKey]: yearId,
});

export const assertTenantWhere = (
  where: WhereLike,
  organizationId: string,
): void => {
  if (
    process.env.NODE_ENV !== 'development' &&
    process.env.NODE_ENV !== 'test'
  ) {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(where, 'organizationId')) {
    throw new Error(
      'TENANT_SCOPE_VIOLATION: missing organizationId in Prisma where',
    );
  }

  if ((where.organizationId as string | undefined) !== organizationId) {
    throw new Error(
      'TENANT_SCOPE_VIOLATION: organizationId mismatch in Prisma where',
    );
  }
};
