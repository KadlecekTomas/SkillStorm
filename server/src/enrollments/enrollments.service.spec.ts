import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { OrganizationRole, SystemRole } from '@prisma/client';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let prisma: {
    student: { findUnique: jest.Mock };
    classSection: { findUnique: jest.Mock };
    membership: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock; create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      student: { findUnique: jest.fn() },
      classSection: { findUnique: jest.fn() },
      membership: { findUnique: jest.fn() },
      enrollment: { findFirst: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  it('rejects enrollments into inactive academic year', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1',
      orgId: 'org-1',
      deletedAt: null,
      membershipId: 'membership-1',
    });
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-1',
      orgId: 'org-1',
      yearId: 'year-1',
      academicYear: { isCurrent: false },
    });
    prisma.membership.findUnique.mockResolvedValue({ deletedAt: null });

    await expect(
      service.create(
        { studentId: 'student-1', classSectionId: 'class-1' },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPPORT,
        } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents multiple enrollments in the same academic year', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1',
      orgId: 'org-1',
      deletedAt: null,
      membershipId: 'membership-1',
    });
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-1',
      orgId: 'org-1',
      yearId: 'year-1',
      academicYear: { isCurrent: true },
    });
    prisma.membership.findUnique.mockResolvedValue({ deletedAt: null });
    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'enroll-1',
      classSectionId: 'class-2',
    });

    await expect(
      service.create(
        { studentId: 'student-1', classSectionId: 'class-1' },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPPORT,
        } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
