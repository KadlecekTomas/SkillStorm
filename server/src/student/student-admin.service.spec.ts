import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EnrollmentStatus, OrganizationRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { StudentAdminService } from './student-admin.service';

describe('StudentAdminService', () => {
  const cache = {} as any;
  const prisma = {
    student: {
      findUnique: jest.fn(),
    },
    classSection: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects editing a student from another organization', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-a',
      orgId: 'org-b',
      deletedAt: null,
      membership: { id: 'membership-a', userId: 'user-a', user: { id: 'user-a', name: 'A', email: 'a@test.cz' } },
      enrollments: [],
    });
    const service = new StudentAdminService(prisma, cache);

    await expect(
      service.updateProfile(
        'student-a',
        { name: 'Nové jméno' },
        {
          userId: 'director-a',
          email: 'director@test.cz',
          organizationId: 'org-a',
          organizationRole: OrganizationRole.DIRECTOR,
          activeRole: OrganizationRole.DIRECTOR,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a target class outside the current school', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-a',
      orgId: 'org-a',
      deletedAt: null,
      membership: { id: 'membership-a', userId: 'user-a', user: { id: 'user-a', name: 'A', email: 'a@test.cz' } },
      enrollments: [],
    });
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-b',
      orgId: 'org-b',
      yearId: 'year-a',
      academicYear: { isCurrent: true },
    });
    const service = new StudentAdminService(prisma, cache);

    await expect(
      service.updateProfile(
        'student-a',
        { classSectionId: 'class-b' },
        {
          userId: 'director-a',
          email: 'director@test.cz',
          organizationId: 'org-a',
          organizationRole: OrganizationRole.DIRECTOR,
          activeRole: OrganizationRole.DIRECTOR,
        },
      ),
    ).rejects.toBeDefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
