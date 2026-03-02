export type StudentQuestionViewDTO = {
  id: string;
  text: string;
  type: string;
  options: Array<{ id: string; text: string }>;
};

export type StudentTestViewDTO = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  subject: {
    id: string;
    name: string;
    catalogSubject: { code: string; name: string } | null;
  } | null;
  academicYear: {
    id: string;
    label: string;
    isCurrent: boolean;
  } | null;
  questions: StudentQuestionViewDTO[];
};
