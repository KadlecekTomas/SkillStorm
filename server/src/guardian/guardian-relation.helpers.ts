import { BadRequestException } from '@nestjs/common';
import {
  GuardianRelationStatus,
  InvitationType,
  OrganizationRole,
  Prisma,
} from '@prisma/client';

/**
 * Založení PENDING vztahu při přijetí GUARDIAN kódu. Volá se z OBOU accept
 * cest (registrace s kódem i přijetí přihlášeným uživatelem) uvnitř jejich
 * transakce — proto čistá funkce nad tx, ne DI služba (žádný cyklus
 * AuthModule ↔ GuardianModule).
 *
 * Vztah vzniká až tady, ne při generování kódu: guardian membership před
 * registrací rodiče neexistuje (FK je NOT NULL). Provenance vystavitele nese
 * invite.createdById → relation.verifiedById; verifiedAt zůstává null do
 * potvrzení rodičem (VERIFIED) na potvrzovací obrazovce.
 *
 * Idempotence: živý vztah páru (PENDING/VERIFIED/DISPUTED) se vrací beze
 * změny; závod dvou acceptů chytá partial unique
 * guardian_relation_single_live_per_pair.
 */
export async function createPendingGuardianRelation(
  tx: Prisma.TransactionClient,
  guardianMembershipId: string,
  invite: {
    organizationId: string;
    role: OrganizationRole;
    type: InvitationType;
    targetStudentId: string | null;
    createdById: string | null;
  },
): Promise<{ relationId: string; created: boolean }> {
  if (invite.role !== OrganizationRole.PARENT || !invite.targetStudentId) {
    throw new BadRequestException('Invalid guardian invite.');
  }

  const student = await tx.student.findFirst({
    where: {
      id: invite.targetStudentId,
      orgId: invite.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!student) {
    throw new BadRequestException('Invalid guardian invite.');
  }

  const existing = await tx.guardianStudentRelation.findFirst({
    where: {
      guardianMembershipId,
      studentId: student.id,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return { relationId: existing.id, created: false };
  }

  const relation = await tx.guardianStudentRelation.create({
    data: {
      guardianMembershipId,
      studentId: student.id,
      organizationId: invite.organizationId,
      status: GuardianRelationStatus.PENDING,
      verifiedById: invite.createdById,
    },
    select: { id: true },
  });
  return { relationId: relation.id, created: true };
}
