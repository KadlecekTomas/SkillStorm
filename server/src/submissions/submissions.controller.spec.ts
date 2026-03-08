import { Test } from '@nestjs/testing';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { OrgContextService } from '@/common/org-context/org-context.service';
import { AcademicYearsService } from '@/academic-years/academic-years.service';

describe('SubmissionsController', () => {
  it('clamps list limit to 100', async () => {
    const submissionsService = {
      findAll: jest.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, pages: 1 } }),
    };
    const orgContext = {
      get: jest.fn().mockResolvedValue({
        organizationId: 'org-1',
        membershipId: 'mem-1',
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [
        { provide: SubmissionsService, useValue: submissionsService },
        { provide: OrgContextService, useValue: orgContext },
        {
          provide: AcademicYearsService,
          useValue: {
            assertOrgHasExactlyOneCurrentYear: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    const controller = module.get(SubmissionsController);
    const req = {
      user: {
        userId: 'user-1',
        organizationId: 'org-1',
        membershipId: 'mem-1',
      },
    } as any;

    await controller.findAll(req, 'assignment-1', 'student-1', '1', '999');

    expect(submissionsService.findAll).toHaveBeenCalledWith(
      { assignmentId: 'assignment-1', studentId: 'student-1' },
      req.user,
      { organizationId: 'org-1', membershipId: 'mem-1' },
      { page: 1, limit: 100 },
    );
  });
});
