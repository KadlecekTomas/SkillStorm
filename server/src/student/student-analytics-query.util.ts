import { Prisma, SubmissionStatus } from '@prisma/client';

type CompletedStudentSubmissionScope = {
  membershipId: string;
  orgId: string;
  yearId?: string;
};

export function buildCompletedStudentSubmissionWhere(
  scope: CompletedStudentSubmissionScope,
): Prisma.SubmissionWhereInput {
  return {
    studentId: scope.membershipId,
    organizationId: scope.orgId,
    deletedAt: null,
    submittedAt: { not: null },
    status: {
      in: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED],
    },
    assignment: {
      organizationId: scope.orgId,
      ...(scope.yearId ? { yearId: scope.yearId } : {}),
    },
    test: {
      deletedAt: null,
    },
  };
}
