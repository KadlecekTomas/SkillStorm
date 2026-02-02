export type InvitePreviewResponse = {
  type: 'ORG_ONLY' | 'STUDENT_CLASS';
  organizationId: string;
  organizationName: string;
  role?: string | undefined;
  classSectionId?: string | undefined;
  yearId?: string | undefined;
  classLabel?: string | undefined;
  yearLabel?: string | undefined;
};
