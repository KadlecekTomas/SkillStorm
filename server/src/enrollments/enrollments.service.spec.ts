import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/audit/audit.service';
import { OrganizationRole, SystemRole } from '@prisma/client';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let prisma: {
    student: { findUnique: jest.Mock };
    classSection: { findUnique: jest.Mock };
    membership: { findUnique: jest.Mock };
    enrollment: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
    academicYear: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      student: { findUnique: jest.fn() },
      classSection: { findUnique: jest.fn() },
      membership: { findUnique: jest.fn() },
      enrollment: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      academicYear: { findFirst: jest.fn() },
    };
    // assertValidAcademicYear(): default to a valid, non-deleted year so tests
    // exercise the downstream branches (isCurrent / duplicate) they target.
    prisma.academicYear.findFirst.mockResolvedValue({ id: 'year-1', orgId: 'org-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
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
        { studentId: 'student-1', classSectionId: 'class-1', academicYearId: 'year-1' },
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
        { studentId: 'student-1', classSectionId: 'class-1', academicYearId: 'year-1' },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPPORT,
        } as any,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns existing enrollment when idempotent call targets same class', async () => {
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
      classSectionId: 'class-1',
    });
    prisma.enrollment.findUnique.mockResolvedValue({
      id: 'enroll-1',
      classSectionId: 'class-1',
      yearId: 'year-1',
    });

    await expect(
      service.create(
        { studentId: 'student-1', classSectionId: 'class-1', academicYearId: 'year-1' },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPPORT,
        } as any,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'enroll-1' }));
  });

  it('rejects enrollment when student and class section are in different organizations', async () => {
    prisma.student.findUnique.mockResolvedValue({
      id: 'student-1',
      orgId: 'org-1',
      deletedAt: null,
      membershipId: 'membership-1',
    });
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-1',
      orgId: 'org-2',
      yearId: 'year-1',
      academicYear: { isCurrent: true },
    });
    prisma.membership.findUnique.mockResolvedValue({ deletedAt: null });

    await expect(
      service.create(
        { studentId: 'student-1', classSectionId: 'class-1', academicYearId: 'year-1' },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPPORT,
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects enrollment when academicYearId does not match class section', async () => {
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

    await expect(
      service.create(
        { studentId: 'student-1', classSectionId: 'class-1', academicYearId: 'year-2' },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPPORT,
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
