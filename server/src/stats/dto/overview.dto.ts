// Pokud máš radši interface:
export interface StatsOverviewResponse {
  scope: 'evaluated' | 'all';
  totalTests: number;

  // holé počty
  counts: {
    approved: number;
    rejected: number;
    pending: number;
    all: number;
  };

  // ALIASY kvůli zpětné kompatibilitě (to po tobě chtějí testy)
  totalSubmissions: number; // evaluated ? (approved+rejected) : all
  pendingSubmissions: number; // == counts.pending

  // primární hodnoty
  passRate: number; // podle scope
  passRateEvaluated: number; // approved / (approved+rejected)
  passRateAll: number; // approved / all
  avgScore: number | null;
  lastSubmittedAt: Date | null;
}
