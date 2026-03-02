import {
  deriveOrgReadiness,
  OrgReadinessState,
  ORG_READINESS_MISSING,
} from './org-readiness-v2';

const mockPrisma = {
  academicYear: { findFirst: jest.fn() },
  classSection: { count: jest.fn() },
  assignment: { count: jest.fn() },
};

describe('deriveOrgReadiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns R0_EMPTY when orgId is null', async () => {
    const result = await deriveOrgReadiness(mockPrisma as any, null);
    expect(result.state).toBe(OrgReadinessState.R0_EMPTY);
    expect(result.canExecute).toBe(false);
    expect(result.missing).toContain(ORG_READINESS_MISSING.MISSING_CURRENT_ACADEMIC_YEAR);
    expect(result.evidence.hasCurrentYear).toBe(false);
    expect(mockPrisma.academicYear.findFirst).not.toHaveBeenCalled();
  });

  it('returns R0_EMPTY when no current academic year', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue(null);
    const result = await deriveOrgReadiness(mockPrisma as any, 'org-1');
    expect(result.state).toBe(OrgReadinessState.R0_EMPTY);
    expect(result.canExecute).toBe(false);
    expect(result.currentYearId).toBeNull();
  });

  it('returns R1_YEAR_READY when current year exists but no class section', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    mockPrisma.classSection.count.mockResolvedValue(0);
    mockPrisma.assignment.count.mockResolvedValue(0);
    const result = await deriveOrgReadiness(mockPrisma as any, 'org-1');
    expect(result.state).toBe(OrgReadinessState.R1_YEAR_READY);
    expect(result.canExecute).toBe(false);
    expect(result.missing).toContain(ORG_READINESS_MISSING.MISSING_CLASS_SECTION_IN_CURRENT_YEAR);
    expect(result.evidence.hasCurrentYear).toBe(true);
    expect(result.evidence.hasClassSectionInCurrentYear).toBe(false);
    expect(result.currentYearId).toBe('year-1');
  });

  it('returns R2_STRUCTURE_READY when current year and class section, no assignment', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    mockPrisma.classSection.count.mockResolvedValue(1);
    mockPrisma.assignment.count.mockResolvedValue(0);
    const result = await deriveOrgReadiness(mockPrisma as any, 'org-1');
    expect(result.state).toBe(OrgReadinessState.R2_STRUCTURE_READY);
    expect(result.canExecute).toBe(true);
    expect(result.evidence.hasClassSectionInCurrentYear).toBe(true);
    expect(result.evidence.hasAssignmentInCurrentYear).toBe(false);
  });

  it('returns R3_EXECUTION_READY when current year, class section, and assignment', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    mockPrisma.classSection.count.mockResolvedValue(1);
    mockPrisma.assignment.count.mockResolvedValue(1);
    const result = await deriveOrgReadiness(mockPrisma as any, 'org-1');
    expect(result.state).toBe(OrgReadinessState.R3_EXECUTION_READY);
    expect(result.canExecute).toBe(true);
    expect(result.evidence.hasAssignmentInCurrentYear).toBe(true);
  });
});
