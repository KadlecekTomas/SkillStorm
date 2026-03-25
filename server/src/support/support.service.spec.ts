import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  SupportTicketPriority,
  SupportTicketStatus,
  SystemRole,
} from '@prisma/client';
import { SupportService } from './support.service';

describe('SupportService', () => {
  const prisma = {
    membership: { findFirst: jest.fn() },
    supportTicket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  };
  const auditService = {
    log: jest.fn(),
  };

  const service = new SupportService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
    auditService.log.mockResolvedValue(undefined);
  });

  it('creates a ticket for an active org member', async () => {
    prisma.supportTicket.create.mockResolvedValue({
      id: 'ticket-1',
      category: 'TEST',
      message: 'Broken test save',
      page: '/app/tests/1',
      status: SupportTicketStatus.OPEN,
      priority: SupportTicketPriority.MEDIUM,
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-20T10:00:00.000Z'),
    });

    const result = await service.createTicket(
      {
        category: 'TEST',
        message: 'Broken test save',
        page: '/app/tests/1',
      },
      {
        userId: 'teacher-1',
        email: 'teacher@example.com',
        organizationId: 'org-1',
        membershipId: 'membership-1',
      },
      {
        headers: {},
        get: jest.fn().mockReturnValue('UA'),
        ip: '127.0.0.1',
      } as never,
    );

    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'teacher-1',
          category: 'TEST',
          message: 'Broken test save',
        }),
      }),
    );
    expect(result.status).toBe(SupportTicketStatus.OPEN);
    expect(auditService.log).toHaveBeenCalled();
  });

  it('lists platform tickets for support role', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);

    await expect(
      service.listTickets(
        {
          userId: 'support-1',
          email: 'support@example.com',
          systemRole: SystemRole.SUPPORT,
        },
        {},
      ),
    ).resolves.toEqual([]);
  });

  it('blocks ticket updates for devops', async () => {
    await expect(
      service.updateTicket(
        'ticket-1',
        { status: SupportTicketStatus.IN_REVIEW },
        {
          userId: 'devops-1',
          email: 'devops@example.com',
          systemRole: SystemRole.DEVOPS,
        },
        {} as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('moves a ticket to in review and assigns it', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      organizationId: 'org-1',
      status: SupportTicketStatus.OPEN,
      priority: SupportTicketPriority.MEDIUM,
      assignedToId: null,
      internalNote: null,
      resolutionNote: null,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'support-1',
      name: 'Support Agent',
      systemRole: SystemRole.SUPPORT,
      isPlatformAdmin: false,
    });
    prisma.supportTicket.update.mockResolvedValue({
      id: 'ticket-1',
      organizationId: 'org-1',
      category: 'TEST',
      message: 'Broken',
      page: '/app/tests',
      metadata: null,
      status: SupportTicketStatus.IN_REVIEW,
      priority: SupportTicketPriority.MEDIUM,
      internalNote: 'taking this',
      resolutionNote: null,
      resolvedAt: null,
      createdAt: new Date('2026-03-20T10:00:00.000Z'),
      updatedAt: new Date('2026-03-20T10:05:00.000Z'),
      organization: { id: 'org-1', name: 'Atlas School' },
      user: { id: 'teacher-1', name: 'Reporter', email: 'reporter@example.com' },
      assignedTo: { id: 'support-1', name: 'Support Agent', email: 'support@example.com' },
      resolvedBy: null,
    });

    const result = await service.updateTicket(
      'ticket-1',
      {
        assignedToId: 'support-1',
        status: SupportTicketStatus.IN_REVIEW,
        internalNote: 'taking this',
      },
      {
        userId: 'support-1',
        email: 'support@example.com',
        systemRole: SystemRole.SUPPORT,
      },
      {
        get: jest.fn().mockReturnValue('UA'),
        ip: '127.0.0.1',
      } as never,
    );

    expect(prisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedToId: 'support-1',
          status: SupportTicketStatus.IN_REVIEW,
        }),
      }),
    );
    expect(result.status).toBe(SupportTicketStatus.IN_REVIEW);
  });

  it('requires a resolution note when resolving', async () => {
    prisma.supportTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      organizationId: 'org-1',
      status: SupportTicketStatus.IN_REVIEW,
      priority: SupportTicketPriority.MEDIUM,
      assignedToId: null,
      internalNote: null,
      resolutionNote: null,
    });

    await expect(
      service.updateTicket(
        'ticket-1',
        { status: SupportTicketStatus.RESOLVED },
        {
          userId: 'support-1',
          email: 'support@example.com',
          systemRole: SystemRole.SUPPORT,
        },
        {} as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists reporter tickets only from active organization context', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([
      {
        id: 'ticket-1',
        category: 'TEST',
        message: 'Broken',
        page: '/app/tests',
        status: SupportTicketStatus.OPEN,
        priority: SupportTicketPriority.MEDIUM,
        resolutionNote: null,
        resolvedAt: null,
        createdAt: new Date('2026-03-20T10:00:00.000Z'),
        updatedAt: new Date('2026-03-20T10:00:00.000Z'),
      },
    ]);

    const result = await service.listMyTickets({
      userId: 'teacher-1',
      email: 'teacher@example.com',
      organizationId: 'org-1',
      membershipId: 'membership-1',
    });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'teacher-1',
          organizationId: 'org-1',
        },
      }),
    );
    expect(result).toHaveLength(1);
  });
});
