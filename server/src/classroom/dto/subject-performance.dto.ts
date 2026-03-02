export type SubjectPerformanceTrend = 'UP' | 'DOWN' | 'STABLE';

export type SubjectPerformanceItemDto = {
  subjectId: string;
  name: string;
  averageScorePercent: number;
  testCount: number;
  submissionCount: number;
  trend: SubjectPerformanceTrend;
};

export type SubjectPerformanceResponseDto = {
  classroomId: string;
  subjects: SubjectPerformanceItemDto[];
};
