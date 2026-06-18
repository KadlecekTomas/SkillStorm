import { ForbiddenException } from '@nestjs/common';
import { GoogleWorkspaceController } from './google-workspace.controller';
import type { GoogleWorkspaceService } from './google-workspace.service';
import type { OrgContextService } from '@/common/org-context/org-context.service';
import type { RequestWithUser } from '@/types/request-with-user';

/**
 * Test C: a user of organization A must never drive the Google Workspace
 * endpoints for organization B. The route `:organizationId` is checked against
 * the caller's active org context (assertOrgScope).
 */
describe('GoogleWorkspaceController org scoping', () => {
  const service = {
    getStatus: jest.fn().mockResolvedValue({ connected: true }),
    preview: jest.fn(),
    commit: jest.fn(),
  } as unknown as GoogleWorkspaceService;

  function buildController(activeOrgId: string) {
    const orgContext = {
      get: jest.fn().mockResolvedValue({ organizationId: activeOrgId }),
    } as unknown as OrgContextService;
    return new GoogleWorkspaceController(service, orgContext);
  }

  const req = { user: { userId: 'user-a' } } as unknown as RequestWithUser;

  it('rejects access to another organization with 403', async () => {
    const controller = buildController('org-A');
    await expect(controller.status('org-B', req)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(service.getStatus).not.toHaveBeenCalled();
  });

  it('allows access to the caller’s own organization', async () => {
    const controller = buildController('org-A');
    await expect(controller.status('org-A', req)).resolves.toBeDefined();
  });
});
