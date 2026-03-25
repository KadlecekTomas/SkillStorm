import { RiskService } from './risk.service';

describe('RiskService', () => {
  let service: RiskService;

  beforeEach(() => {
    service = new RiskService();
  });

  it('HIGH when low avg + declining', () => {
    expect(
      service.computeStudentRisk({
        averageScorePercent: 50,
        daysSinceLastActivity: 5,
        trendPercent: -20,
      }),
    ).toBe('HIGH');
  });

  it('MEDIUM when only low avg', () => {
    expect(
      service.computeStudentRisk({
        averageScorePercent: 55,
        daysSinceLastActivity: 5,
        trendPercent: 0,
      }),
    ).toBe('MEDIUM');
  });

  it('LOW when no flags', () => {
    expect(
      service.computeStudentRisk({
        averageScorePercent: 65,
        daysSinceLastActivity: 5,
        trendPercent: 0,
      }),
    ).toBe('LOW');
  });

  it.each([
    {
      averageScorePercent: 50,
      trendPercent: -20,
      daysSinceLastActivity: 5,
      expected: 'HIGH',
    },
    {
      averageScorePercent: 65,
      trendPercent: 0,
      daysSinceLastActivity: 5,
      expected: 'LOW',
    },
    {
      averageScorePercent: 55,
      trendPercent: 0,
      daysSinceLastActivity: 20,
      expected: 'HIGH',
    },
  ] as const)(
    'returns $expected for avg=$averageScorePercent trend=$trendPercent days=$daysSinceLastActivity',
    ({ averageScorePercent, trendPercent, daysSinceLastActivity, expected }) => {
      expect(
        service.computeStudentRisk({
          averageScorePercent,
          trendPercent,
          daysSinceLastActivity,
        }),
      ).toBe(expected);
    },
  );

  it('is deterministic for identical input', () => {
    const input = {
      averageScorePercent: 59,
      daysSinceLastActivity: 14,
      trendPercent: -10,
    } as const;

    expect(service.computeStudentRisk(input)).toBe(service.computeStudentRisk(input));
  });
});
