export type StudentDiagnosticStatus =
  | 'WEAK'
  | 'WARNING'
  | 'GOOD'
  | 'INSUFFICIENT_DATA';

export type StudentDiagnosticSampleMistake = {
  questionId: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string | null;
  attemptedAt: string | null;
};

export type StudentDiagnosticRepeatedQuestion = {
  questionId: string;
  questionText: string;
  wrongCount: number;
};

export type StudentDiagnosticTopic = {
  topicId: string;
  topic: string;
  totalAnswers: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  status: StudentDiagnosticStatus;
  sampleMistakes: StudentDiagnosticSampleMistake[];
  repeatedlyWrongQuestions: StudentDiagnosticRepeatedQuestion[];
};

export type StudentDiagnosticSubject = {
  subjectId: string;
  subject: string;
  topics: StudentDiagnosticTopic[];
};

export type StudentDiagnosticWeakTopic = {
  subjectId: string;
  subject: string;
  topicId: string;
  topic: string;
  accuracy: number;
  totalAnswers: number;
  status: StudentDiagnosticStatus;
};

export type StudentDiagnosticResponse = {
  studentId: string;
  summary: {
    subjectsCount: number;
    topicsEvaluated: number;
    weakTopicsCount: number;
  };
  subjects: StudentDiagnosticSubject[];
  weakestTopics: StudentDiagnosticWeakTopic[];
};
