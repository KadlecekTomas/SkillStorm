export type MyAssignmentDto = {
  id: string;
  testId: string;
  classSectionId: string | null;
  organizationId: string;
  openAt: Date;
  closeAt: Date;
  maxAttempts: number;
  attemptNo: number;
};
