import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { SchoolPeopleService } from './school-people.service';

describe('SchoolPeopleService', () => {
  const prisma = {
    membership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
  const users = {
    update: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not allow a director to edit the owner account', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'membership-owner',
      organizationId: 'org-a',
      role: OrganizationRole.OWNER,
      deletedAt: null,
      userId: 'user-owner',
      roleAssignments: [],
    });
    const service = new SchoolPeopleService(prisma, users);

    await expect(
      service.update(
        'membership-owner',
        { name: 'Owner Name', email: 'owner@example.test' },
        {
          userId: 'director-user',
          email: 'director@example.test',
          organizationId: 'org-a',
          organizationRole: OrganizationRole.DIRECTOR,
          activeRole: OrganizationRole.DIRECTOR,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.update).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant staff edits', async () => {
    prisma.membership.findUnique.mockResolvedValue({
      id: 'membership-teacher',
      organizationId: 'org-b',
      role: OrganizationRole.TEACHER,
      deletedAt: null,
      userId: 'user-teacher',
      roleAssignments: [],
    });
    const service = new SchoolPeopleService(prisma, users);

    await expect(
      service.update(
        'membership-teacher',
        { name: 'Teacher Name', email: 'teacher@example.test' },
        {
          userId: 'director-user',
          email: 'director@example.test',
          organizationId: 'org-a',
          organizationRole: OrganizationRole.DIRECTOR,
          activeRole: OrganizationRole.DIRECTOR,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.update).not.toHaveBeenCalled();
  });
});
