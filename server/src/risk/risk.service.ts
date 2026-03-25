import { Injectable } from '@nestjs/common';
import {
  calculateRiskLevel,
  getRiskFlags,
  type RiskFlag,
  type RiskInput,
  type RiskLevel,
} from '@/shared/risk-model';

@Injectable()
export class RiskService {
  computeStudentRisk(input: RiskInput): RiskLevel {
    return calculateRiskLevel(input);
  }

  getStudentRiskFlags(input: RiskInput): RiskFlag[] {
    return getRiskFlags(input);
  }
}
