export interface StatsOverviewResponse {
  scope: 'evaluated' | 'all';
  totalTests: number;

  counts: {
    approved: number;
    rejected: number;
    pending: number;
    all: number;
  };

  totalSubmissions: number;
  pendingSubmissions: number;

  passRate: number;
  passRateEvaluated: number;
  passRateAll: number;
  avgScore: number | null;
  lastSubmittedAt: Date | null;
}
