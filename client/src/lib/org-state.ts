/**
 * Jediný zdroj pravdy pro stav organizace – odvozen výhradně z /auth/me.
 * Backend vrací user.memberships a organization; status organizace není v API,
 * proto rozlišujeme NO_ORG vs HAS_ORG. PENDING/ACTIVE/SUSPENDED lze doplnit,
 * až backend začne vracet organization.status.
 */
export type OrgState =
  | "NO_ORG"
  | "PENDING"
  | "ACTIVE"
  | "SUSPENDED"
  | "HAS_ORG";

/** Minimální tvar pro odvození stavu; přijímá MembershipSummary z /auth/me. */
export type OrgStateInput = {
  memberships?: Array<{
    organizationId: string;
    organization?: { name?: string; type?: string; status?: string | null };
  }> | undefined;
  organization?: { id: string; status?: string | null } | null | undefined;
};

/**
 * Odvození stavu organizace výhradně z dat z /auth/me.
 * - NO_ORG: uživatel nemá žádnou membership
 * - HAS_ORG: má membership, ale status není k dispozici (fallback)
 * - PENDING | ACTIVE | SUSPENDED: když backend vrací organization.status
 */
export function deriveOrgState(input: OrgStateInput): OrgState {
  const memberships = input.memberships ?? [];
  const org = input.organization;

  if (memberships.length === 0) {
    return "NO_ORG";
  }

  const status = org?.status ?? memberships[0]?.organization?.status;
  if (status === "PENDING") return "PENDING";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "SUSPENDED") return "SUSPENDED";

  return "HAS_ORG";
}

/** Má uživatel alespoň jednu organizaci (membership)? Nikdy nehádat – jen z backend dat. */
export function hasAnyOrganization(input: OrgStateInput): boolean {
  return (input.memberships?.length ?? 0) > 0;
}

/** Kód odpovědi backendu při pokusu o druhou organizaci. */
export const ORG_OWNER_LIMIT_REACHED = "ORG_OWNER_LIMIT_REACHED";
