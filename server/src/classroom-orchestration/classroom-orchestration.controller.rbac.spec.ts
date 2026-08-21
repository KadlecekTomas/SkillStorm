import { OrganizationRole } from '@prisma/client';
import type { OrgContext } from '@/common/org-context/org-context.types';
import { ClassroomOrchestrationController } from './classroom-orchestration.controller';

describe('ClassroomOrchestrationController student classroom RBAC wiring', () => {
  const ctx: OrgContext = {
    organizationId: 'org-1',
    membershipId: 'membership-1',
    role: OrganizationRole.STUDENT,
    activeAcademicYearId: null,
    isAcademicYearExpired: false,
  };
  const req = {} as never;

  const service = {
    disconnectStudent: jest.fn(),
    getStudentProjection: jest.fn(),
    recordSemanticEvent: jest.fn(),
  };
  const studentAccess = {
    assertCanAccessSession: jest.fn(),
    findActiveSession: jest.fn(),
  };
  const algorithmLabAnalytics = {};
  const algorithmLabAutoPair = { join: jest.fn() };
  const algorithmLabJoinCode = { resolve: jest.fn() };
  const algorithmLabQuickStart = {};
  const buildPcAnalytics = {};
  const networkedCoop = { get: jest.fn(), transition: jest.fn() };
  const networkedCoopProgram = { get: jest.fn(), update: jest.fn() };
  const orgContext = { get: jest.fn() };

  const controller = new ClassroomOrchestrationController(
    service as never,
    studentAccess as never,
    algorithmLabAnalytics as never,
    algorithmLabAutoPair as never,
    algorithmLabJoinCode as never,
    algorithmLabQuickStart as never,
    buildPcAnalytics as never,
    networkedCoop as never,
    networkedCoopProgram as never,
    orgContext as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    orgContext.get.mockResolvedValue(ctx);
    studentAccess.assertCanAccessSession.mockResolvedValue(undefined);
    studentAccess.findActiveSession.mockResolvedValue({ id: 'session-live' });
    algorithmLabJoinCode.resolve.mockResolvedValue({ sessionId: 'session-code' });
    algorithmLabAutoPair.join.mockResolvedValue({ id: 'participant-1' });
    service.disconnectStudent.mockResolvedValue({ id: 'participant-1' });
    service.getStudentProjection.mockResolvedValue({ id: 'session-1' });
    service.recordSemanticEvent.mockResolvedValue({ replayed: false });
    networkedCoop.get.mockResolvedValue({ sessionId: 'session-1' });
    networkedCoop.transition.mockResolvedValue({ replayed: false });
    networkedCoopProgram.get.mockResolvedValue({ programRevision: 0 });
    networkedCoopProgram.update.mockResolvedValue({ replayed: false });
  });

  it('discovers the current student class lesson through the central access boundary', async () => {
    await expect(controller.myActiveSession(req)).resolves.toEqual({ id: 'session-live' });
    expect(studentAccess.findActiveSession).toHaveBeenCalledWith(ctx);
  });

  it('guards short-code resolution before disclosing a class-bound session id', async () => {
    await expect(controller.resolveAlgorithmLabCode('ABCD-EF12', req)).resolves.toEqual({
      sessionId: 'session-code',
    });
    expect(studentAccess.assertCanAccessSession).toHaveBeenCalledWith('session-code', ctx);
  });

  it('guards join, reconnect/projection, disconnect, coop and semantic events', async () => {
    await controller.join('session-join', {} as never, req);
    await controller.disconnect('session-disconnect', req);
    await controller.studentProjection('session-me', req);
    await controller.coopProjection('session-coop', req);
    await controller.coopTransition('session-transition', {} as never, req);
    await controller.coopProgram('session-program', req);
    await controller.updateCoopProgram('session-program-update', {} as never, req);
    await controller.event('session-event', {} as never, req);

    expect(studentAccess.assertCanAccessSession.mock.calls).toEqual([
      ['session-join', ctx],
      ['session-disconnect', ctx],
      ['session-me', ctx],
      ['session-coop', ctx],
      ['session-transition', ctx],
      ['session-program', ctx],
      ['session-program-update', ctx],
      ['session-event', ctx],
    ]);
  });

  it('stops downstream student actions when the enrollment boundary rejects access', async () => {
    studentAccess.assertCanAccessSession.mockRejectedValueOnce(new Error('blocked'));

    await expect(controller.join('session-blocked', {} as never, req)).rejects.toThrow('blocked');
    expect(algorithmLabAutoPair.join).not.toHaveBeenCalled();
  });
});
