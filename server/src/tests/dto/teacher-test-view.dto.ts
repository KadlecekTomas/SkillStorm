export type TeacherQuestionViewDTO = {
  id: string;
  text: string;
  type: string;
  order: number | null;
  score: number;
  correctAnswer: string | null;
  correctAnswers: string[];
  options: Array<{ id: string; text: string }>;
  answers: Array<{ id: string; text: string }>;
};

export type TeacherTestViewDTO = {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  allowedGrades: string[];
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
  creator: {
    id: string;
    organizationId: string;
    user: { id: string; name: string; email: string | null } | null;
  } | null;
  questions: TeacherQuestionViewDTO[];
  assignability: unknown;
};
