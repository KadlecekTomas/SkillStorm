import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ClassSectionsService } from './class-sections.service';
import { OrganizationRole, SystemRole } from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import { RiskService } from '@/risk/risk.service';
import { TeacherAccessService } from '@/teacher-access/teacher-access.service';

describe('ClassSectionsService', () => {
  let service: ClassSectionsService;
  let prisma: {
    membership: { findFirst: jest.Mock };
    teacher: { findFirst: jest.Mock };
    classSection: { findMany: jest.Mock; findUnique: jest.Mock };
  };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    prisma = {
      membership: { findFirst: jest.fn() },
      teacher: { findFirst: jest.fn() },
      classSection: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    cache.get.mockReset();
    cache.set.mockReset();
    cache.del.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassSectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: AuditService, useValue: {} },
        { provide: RiskService, useValue: {} },
        { provide: TeacherAccessService, useValue: {} },
      ],
    }).compile();

    service = module.get<ClassSectionsService>(ClassSectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects creating class without academic year', async () => {
    await expect(
      service.create(
        {
          grade: 'GRADE_5' as any,
          section: 'A',
          label: '5.A',
        },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          organizationRole: OrganizationRole.DIRECTOR,
          systemRole: SystemRole.SUPERADMIN,
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only homeroom and explicitly scoped classes for teachers', async () => {
    jest
      .spyOn(service as any, 'assertValidAcademicYear')
      .mockResolvedValue({ id: 'year-1', orgId: 'org-1', isCurrent: true });

    prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
    prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-1' });
    prisma.classSection.findMany.mockResolvedValue([
      {
        id: 'class-home',
        orgId: 'org-1',
        yearId: 'year-1',
        grade: 'GRADE_5',
        section: 'A',
        label: '5.A',
        teacherId: 'teacher-1',
        teacher: { id: 'teacher-1', membership: { user: { name: 'Teacher One' } } },
        teachers: [],
        _count: { enrollments: 21 },
        academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      },
      {
        id: 'class-scope',
        orgId: 'org-1',
        yearId: 'year-1',
        grade: 'GRADE_6',
        section: 'B',
        label: '6.B',
        teacherId: null,
        teacher: null,
        teachers: [{ teacherId: 'teacher-1', classSectionId: 'class-scope', accessLevel: 'EDIT' }],
        _count: { enrollments: 18 },
        academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      },
    ]);

    const result = await service.getMyStructure(
      {
        userId: 'user-1',
        organizationId: 'org-1',
        organizationRole: OrganizationRole.TEACHER,
        systemRole: null,
      } as any,
      'year-1',
    );

    expect(prisma.classSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: 'org-1',
          yearId: 'year-1',
          OR: [
            { teacherId: 'teacher-1' },
            {
              teachers: {
                some: expect.objectContaining({
                  teacherId: 'teacher-1',
                  yearId: 'year-1',
                  deletedAt: null,
                }),
              },
            },
          ],
        },
      }),
    );
    expect(result.homeroom?.id).toBe('class-home');
    expect(result.teachingClasses.map((item) => item.id)).toEqual(['class-scope']);
    expect(result.otherClasses).toEqual([]);
  });

  it('uses enrollment as canonical source of truth for list counts and detail students', async () => {
    jest
      .spyOn(service as any, 'assertValidAcademicYear')
      .mockResolvedValue({ id: 'year-1', orgId: 'org-1', isCurrent: true });

    prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1', role: OrganizationRole.DIRECTOR });
    prisma.classSection.findMany.mockResolvedValue([
      {
        id: 'class-1',
        orgId: 'org-1',
        yearId: 'year-1',
        grade: 'GRADE_5',
        section: 'A',
        label: '5.A',
        teacher: null,
        _count: { enrollments: 1 },
        academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      },
    ]);
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-1',
      orgId: 'org-1',
      yearId: 'year-1',
      grade: 'GRADE_5',
      section: 'A',
      label: '5.A',
      teacherId: null,
      teacher: null,
      academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      enrollments: [
        {
          id: 'enrollment-1',
          studentId: 'student-1',
          student: {
            membership: {
              user: { id: 'user-1', name: 'Student One', email: 's1@example.com' },
            },
          },
        },
      ],
    });

    const user = {
      userId: 'director-1',
      organizationId: 'org-1',
      organizationRole: OrganizationRole.DIRECTOR,
      systemRole: null,
    } as any;

    const listResult = await service.findAll({ yearId: 'year-1' }, user);
    const detailResult = await service.findOne('class-1', user);

    expect(listResult.data[0]?.studentCount).toBe(1);
    expect(detailResult.enrollments).toHaveLength(1);
    expect(detailResult.enrollments[0]?.student?.membership?.user?.name).toBe('Student One');
  });

  it('applies the same current-year enrollment filter to overview counts and detail rows', async () => {
    jest
      .spyOn(service as any, 'assertValidAcademicYear')
      .mockResolvedValue({ id: 'year-1', orgId: 'org-1', isCurrent: true });

    prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1', role: OrganizationRole.DIRECTOR });
    prisma.classSection.findMany.mockResolvedValue([]);
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-1',
      orgId: 'org-1',
      yearId: 'year-1',
      grade: 'GRADE_5',
      section: 'A',
      label: '5.A',
      teacherId: null,
      teacher: null,
      academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      enrollments: [],
    });

    const user = {
      userId: 'director-1',
      organizationId: 'org-1',
      organizationRole: OrganizationRole.DIRECTOR,
      systemRole: null,
    } as any;

    await service.findAll({ yearId: 'year-1' }, user);
    await service.findOne('class-1', user);

    expect(prisma.classSection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: {
            select: {
              enrollments: {
                where: expect.objectContaining({
                  yearId: 'year-1',
                  status: { not: 'LEFT' },
                  student: expect.objectContaining({
                    deletedAt: null,
                    membership: expect.objectContaining({ deletedAt: null }),
                  }),
                }),
              },
            },
          },
        }),
      }),
    );

    expect(prisma.classSection.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          enrollments: expect.objectContaining({
            where: expect.objectContaining({
              yearId: 'year-1',
              status: { not: 'LEFT' },
              student: expect.objectContaining({
                deletedAt: null,
                membership: expect.objectContaining({ deletedAt: null }),
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('returns zero count and empty detail consistently for an empty class', async () => {
    jest
      .spyOn(service as any, 'assertValidAcademicYear')
      .mockResolvedValue({ id: 'year-1', orgId: 'org-1', isCurrent: true });

    prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1', role: OrganizationRole.DIRECTOR });
    prisma.classSection.findMany.mockResolvedValue([
      {
        id: 'class-1',
        orgId: 'org-1',
        yearId: 'year-1',
        grade: 'GRADE_5',
        section: 'A',
        label: '5.A',
        teacher: null,
        _count: { enrollments: 0 },
        academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      },
    ]);
    prisma.classSection.findUnique.mockResolvedValue({
      id: 'class-1',
      orgId: 'org-1',
      yearId: 'year-1',
      grade: 'GRADE_5',
      section: 'A',
      label: '5.A',
      teacherId: null,
      teacher: null,
      academicYear: { id: 'year-1', label: '2025/26', isCurrent: true },
      enrollments: [],
    });

    const user = {
      userId: 'director-1',
      organizationId: 'org-1',
      organizationRole: OrganizationRole.DIRECTOR,
      systemRole: null,
    } as any;

    const listResult = await service.findAll({ yearId: 'year-1' }, user);
    const detailResult = await service.findOne('class-1', user);

    expect(listResult.data[0]?.studentCount).toBe(0);
    expect(detailResult.enrollments).toEqual([]);
  });
});
