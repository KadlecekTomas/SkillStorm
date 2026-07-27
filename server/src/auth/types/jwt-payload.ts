import type { SystemRole, OrganizationRole } from '@prisma/client';

export type JwtPayload = {
  userId: string;
  email: string;
  systemRole?: SystemRole;
  organizationRole?: OrganizationRole;
  /**
   * Aktivní role membershipu (multi-role, guardian Etapa A). Chybí-li (starý
   * token), efektivní role = primární Membership.role. Platnost claimu ověřuje
   * jwt.strategy proti aktivním assignments na každém requestu.
   */
  activeRole?: OrganizationRole;
  organizationId?: string;
  membershipId?: string;
  isPlatformAdmin?: boolean;
  /**
   * Guardian Etapa C: identifikátor žákovské relace („Spustit pro Matěje").
   * Přítomnost claimu znamená token relace — jwt.strategy ověřuje, že relace
   * je ACTIVE a neexpirovaná, při každém requestu.
   */
  learningSessionId?: string;
};
