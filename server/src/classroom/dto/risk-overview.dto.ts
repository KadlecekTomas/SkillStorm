/**
 * GDPR-minimal risk overview response. No email, username, membership, audit.
 */
import type { RiskTrend, RiskFlag } from '@/classroom/risk-overview.util';
import type { RiskAssessment } from '@/shared/risk-model';

export type ClassroomRiskOverviewStudentDto = {
  studentId: string;
  displayName: string;
  averageScorePercent: number;
  lastActivityAt: string | null;
  trend: RiskTrend;
  /** NO_DATA = student has no scored submission yet (not a risk signal). */
  riskLevel: RiskAssessment;
  riskFlags: RiskFlag[];
};

export type ClassroomRiskOverviewResponseDto = {
  classroomId: string;
  students: ClassroomRiskOverviewStudentDto[];
};
