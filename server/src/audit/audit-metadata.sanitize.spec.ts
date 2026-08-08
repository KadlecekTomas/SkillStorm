import { sanitizeAuditMetadata } from './audit-metadata.sanitize';

describe('audit metadata curriculum provenance policy', () => {
  it('keeps stable curriculum ids, hashes and enums', () => {
    const sanitized = sanitizeAuditMetadata({
      frameworkCode: 'RVP-ZV',
      releaseCode: '2026-05',
      sourceChecksum: 'a'.repeat(64),
      profileId: 'profile-id',
      academicYearId: 'year-id',
      grade: 'GRADE_6',
      classSectionId: 'class-id',
      schoolCurriculumVersionId: 'version-id',
      frameworkReleaseId: 'release-id',
      proposedByType: 'HUMAN',
      schoolOutcomeId: 'school-outcome-id',
      frameworkOutcomeId: 'framework-outcome-id',
      outcomeAspectId: 'aspect-id',
      count: 3,
    });

    expect(sanitized).toEqual({
      frameworkCode: 'RVP-ZV',
      releaseCode: '2026-05',
      sourceChecksum: 'a'.repeat(64),
      profileId: 'profile-id',
      academicYearId: 'year-id',
      grade: 'GRADE_6',
      classSectionId: 'class-id',
      schoolCurriculumVersionId: 'version-id',
      frameworkReleaseId: 'release-id',
      proposedByType: 'HUMAN',
      schoolOutcomeId: 'school-outcome-id',
      frameworkOutcomeId: 'framework-outcome-id',
      outcomeAspectId: 'aspect-id',
      count: 3,
    });
  });

  it('still strips free text and secrets instead of widening the audit surface', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(
        sanitizeAuditMetadata({
          frameworkCode: 'RVP-ZV',
          title: 'Jméno nebo jiný volný text se sem nesmí dostat',
          rationale: 'Volný text review',
          mappingIds: ['one', 'two'],
          password: 'never-log-me',
          token: 'never-log-me-either',
        }),
      ).toEqual({ frameworkCode: 'RVP-ZV' });
    } finally {
      warn.mockRestore();
    }
  });
});
