import {
  sanitizeAuditChangedFields,
  sanitizeAuditMetadata,
} from './audit-metadata.sanitize';

describe('audit metadata policy', () => {
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

  it('preserves safe authorization context that is needed for forensics', () => {
    expect(
      sanitizeAuditMetadata({
        role: 'DIRECTOR',
        previousRole: 'TEACHER',
        nextRole: 'DIRECTOR',
        permissionKey: 'TEST_MANAGE',
        actorMembershipId: 'actor-membership',
        targetMembershipId: 'target-membership',
        targetUserId: 'target-user',
        source: 'ADMIN_UI',
        reasonCode: 'ROLE_PROMOTION',
      }),
    ).toEqual({
      role: 'DIRECTOR',
      previousRole: 'TEACHER',
      nextRole: 'DIRECTOR',
      permissionKey: 'TEST_MANAGE',
      actorMembershipId: 'actor-membership',
      targetMembershipId: 'target-membership',
      targetUserId: 'target-user',
      source: 'ADMIN_UI',
      reasonCode: 'ROLE_PROMOTION',
    });
  });

  it('strips credential-shaped keys recursively, case-insensitively and through arrays', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const sanitized = sanitizeAuditMetadata({
        role: 'TEACHER',
        before: {
          status: 'ACTIVE',
          Password: 'pw-1',
          temporary_password: 'pw-2',
          passwordHash: 'hash',
          accessToken: 'access',
          refresh_token: 'refresh',
          resetToken: 'reset',
          inviteToken: 'invite',
          clientSecret: 'client-secret',
          jwt: 'jwt-secret',
          'set-cookie': 'session=secret',
          tokenVersion: 7,
          nested: [
            {
              Authorization: 'Bearer secret',
              api_key: 'key',
              safeId: 'safe',
            },
          ],
        },
      });

      expect(sanitized).toEqual({
        role: 'TEACHER',
        before: {
          status: 'ACTIVE',
          tokenVersion: 7,
          nested: [{ safeId: 'safe' }],
        },
      });
      const serialized = JSON.stringify(sanitized);
      for (const secret of [
        'pw-1',
        'pw-2',
        'hash',
        'access',
        'refresh',
        'reset',
        'invite',
        'client-secret',
        'jwt-secret',
        'session=secret',
        'Bearer secret',
      ]) {
        expect(serialized).not.toContain(secret);
      }
    } finally {
      warn.mockRestore();
    }
  });

  it('still strips free text and top-level secrets instead of widening the audit surface', () => {
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

  it('stores only changed field names, never changed values or credential fields', () => {
    const changed = sanitizeAuditChangedFields({
      name: 'Alice Example',
      email: 'alice@example.test',
      classSectionId: 'class-a',
      temporaryPassword: 'Temp-Secret-123',
      passwordHash: 'hash-secret',
    });

    expect(changed).toEqual(['classSectionId', 'email', 'name']);
    const serialized = JSON.stringify(changed);
    expect(serialized).not.toContain('Alice Example');
    expect(serialized).not.toContain('alice@example.test');
    expect(serialized).not.toContain('Temp-Secret-123');
    expect(serialized).not.toContain('hash-secret');
  });

  it('sanitizes changed-field arrays as field names rather than values', () => {
    expect(
      sanitizeAuditChangedFields(['status', 'PASSWORD', 'email', 'status']),
    ).toEqual(['email', 'status']);
  });
});
