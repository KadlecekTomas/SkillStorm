import { SystemRole } from '@prisma/client';
import { SupportDataScopeService, type SupportTicketInternalDto } from './support-data-scope.service';

describe('SupportDataScopeService', () => {
  const service = new SupportDataScopeService();

  const ticket: SupportTicketInternalDto = {
    id: 'ticket-1',
    organizationId: 'org-1',
    category: 'TEST',
    message: 'Issue description',
    page: '/app/tests',
    metadata: {
      routePathname: '/app/tests',
      queryString: '?id=1',
      componentContext: 'test_list',
      userAgent: 'Browser UA',
      viewportWidth: 1440,
      viewportHeight: 900,
      uiRole: 'TEACHER',
      clientTimestamp: '2026-03-20T10:00:00.000Z',
    },
    status: 'OPEN',
    priority: 'MEDIUM',
    internalNote: 'internal',
    resolutionNote: null,
    resolvedAt: null,
    createdAt: new Date('2026-03-20T10:00:00.000Z'),
    updatedAt: new Date('2026-03-20T10:00:00.000Z'),
    organization: {
      id: 'org-1',
      name: 'Atlas School',
    },
    user: {
      id: 'user-1',
      name: 'Reporter',
      email: 'reporter@example.com',
    },
    assignedTo: {
      id: 'support-1',
      name: 'Support Agent',
      email: 'support@example.com',
    },
    resolvedBy: null,
  };

  it('keeps full context for superadmin', () => {
    const scoped = service.scopeTicket(
      { userId: 'super', email: 'super@example.com', systemRole: SystemRole.SUPERADMIN },
      ticket,
    );

    expect(scoped.user.email).toBe('reporter@example.com');
    expect(scoped.metadata?.userAgent).toBe('Browser UA');
  });

  it('redacts reporter email and userAgent for support role', () => {
    const scoped = service.scopeTicket(
      { userId: 'support', email: 'support@example.com', systemRole: SystemRole.SUPPORT },
      ticket,
    );

    expect(scoped.user.email).toBeNull();
    expect(scoped.assignedTo?.email).toBeNull();
    expect(scoped.metadata?.userAgent).toBeNull();
  });
});
