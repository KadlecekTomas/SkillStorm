import { ChildVerification, SessionInitiation } from '@prisma/client';

export type SubmissionProvenance = {
  initiatedVia: SessionInitiation | null;
  verificationMethod: ChildVerification | null;
  assistanceDeclared: boolean;
  initiatorName: string | null;
  /** Lidská věta pro učitele (bod 14 — žádné enum dumpy). */
  label: string;
};

/**
 * Provenance odevzdání pro učitelský pohled (spec bod 7). NULL relace =
 * dítě se přihlásilo samostatně; nikdy nevytváříme falešný dojem ověřeného
 * samostatného výkonu.
 */
export function buildSubmissionProvenance(
  session: {
    initiatedVia: SessionInitiation;
    verificationMethod: ChildVerification;
    assistanceDeclared: boolean;
    initiatorMembership?: {
      user: { name: string };
    } | null;
  } | null,
  childFirstName: string,
): SubmissionProvenance {
  if (!session) {
    return {
      initiatedVia: null,
      verificationMethod: null,
      assistanceDeclared: false,
      initiatorName: null,
      label: `${childFirstName} se přihlásil(a) samostatně.`,
    };
  }
  const verified =
    session.verificationMethod === ChildVerification.PIN
      ? `${childFirstName} potvrdil(a) PINem`
      : `${childFirstName} nebyl(a) dodatečně ověřen(a)`;
  const parts = [`Spustil rodič, ${verified}.`];
  if (session.assistanceDeclared) {
    parts.push('Rodič uvedl, že s prací pomáhal.');
  }
  return {
    initiatedVia: session.initiatedVia,
    verificationMethod: session.verificationMethod,
    assistanceDeclared: session.assistanceDeclared,
    initiatorName: session.initiatorMembership?.user.name ?? null,
    label: parts.join(' '),
  };
}
