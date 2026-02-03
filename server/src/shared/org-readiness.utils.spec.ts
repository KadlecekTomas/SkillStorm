import { PreconditionFailedException } from '@nestjs/common';
import { assertOrgReady, ORG_NOT_READY } from './org-readiness.utils';

const mockPrisma = {
  academicYear: {
    findFirst: jest.fn(),
  },
  classSection: {
    count: jest.fn(),
  },
};

describe('assertOrgReady', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when orgId is null', async () => {
    await expect(assertOrgReady(mockPrisma as any, null)).rejects.toThrow(
      PreconditionFailedException,
    );
    await expect(assertOrgReady(mockPrisma as any, null)).rejects.toMatchObject({
      response: { code: ORG_NOT_READY },
    });
  });

  it('throws when no active academic year', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue(null);
    await expect(assertOrgReady(mockPrisma as any, 'org-1')).rejects.toThrow(
      PreconditionFailedException,
    );
  });

  it('throws when no class section in active year', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    mockPrisma.classSection.count.mockResolvedValue(0);
    await expect(assertOrgReady(mockPrisma as any, 'org-1')).rejects.toThrow(
      PreconditionFailedException,
    );
  });

  it('passes when active year and at least one class', async () => {
    mockPrisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1' });
    mockPrisma.classSection.count.mockResolvedValue(1);
    await expect(assertOrgReady(mockPrisma as any, 'org-1')).resolves.toBeUndefined();
  });
});
