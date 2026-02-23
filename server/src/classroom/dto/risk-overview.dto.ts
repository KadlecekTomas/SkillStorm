/**
 * GDPR-minimal risk overview response. No email, username, membership, audit.
 */
import type { RiskLevel, RiskTrend, RiskFlag } from '../risk-overview.util';

export type ClassroomRiskOverviewStudentDto = {
  studentId: string;
  displayName: string;
  averageScorePercent: number;
  lastActivityAt: string | null;
  trend: RiskTrend;
  riskLevel: RiskLevel;
  riskFlags: RiskFlag[];
};

export type ClassroomRiskOverviewResponseDto = {
  classroomId: string;
  students: ClassroomRiskOverviewStudentDto[];
};
