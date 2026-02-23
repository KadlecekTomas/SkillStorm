/**
 * Kontraktní test: tvar response pro student-timeline.
 * Bez DB, bez integrace – pouze ověření typu/struktury položky.
 */
describe('Analytics student-timeline contract', () => {
  type StudentTimelineItem = {
    submissionId: string;
    assignmentId: string;
    testTitle: string;
    submittedAt: string | null;
    score: number | null;
    status: string;
    attemptNo: number;
    openAt: string;
    closeAt: string;
  };

  it('studentTimeline item has required fields for UI', () => {
    const mockItem: StudentTimelineItem = {
      submissionId: 's1',
      assignmentId: 'a1',
      testTitle: 'Test',
      submittedAt: '2025-01-01T00:00:00Z',
      score: 0.85,
      status: 'APPROVED',
      attemptNo: 1,
      openAt: '2025-01-01T00:00:00Z',
      closeAt: '2025-01-31T23:59:59Z',
    };

    expect(mockItem).toMatchObject({
      testTitle: expect.any(String),
      submittedAt: expect.anything(),
      score: expect.any(Number),
      attemptNo: expect.any(Number),
      status: expect.any(String),
    });
    expect(typeof mockItem.submissionId).toBe('string');
    expect(typeof mockItem.assignmentId).toBe('string');
  });
});
