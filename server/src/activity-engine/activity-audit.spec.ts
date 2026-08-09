import { sanitizeAuditMetadata } from '@/audit/audit-metadata.sanitize';

describe('Activity audit provenance', () => {
  it('keeps stable Activity IDs, hashes and engine metadata', () => {
    expect(
      sanitizeAuditMetadata({
        activityId: 'activity-1',
        activityVersionId: 'version-1',
        mappingId: 'mapping-1',
        contentChecksum: 'a'.repeat(64),
        engineKey: 'CORE_INTERACTION_V1',
        schemaVersion: 1,
        scope: 'ORGANIZATION',
      }),
    ).toEqual({
      activityId: 'activity-1',
      activityVersionId: 'version-1',
      mappingId: 'mapping-1',
      contentChecksum: 'a'.repeat(64),
      engineKey: 'CORE_INTERACTION_V1',
      schemaVersion: 1,
      scope: 'ORGANIZATION',
    });
  });

  it('does not copy author-entered Activity content into audit metadata', () => {
    expect(
      sanitizeAuditMetadata({
        activityId: 'activity-1',
        title: 'Citlivý text z lokálního obsahu',
        description: 'Nemá být v audit metadata.',
        rationale: 'Pedagogické zdůvodnění je free text.',
        config: { prompt: 'Obsah aktivity' },
        password: 'never-log-me',
      }),
    ).toEqual({ activityId: 'activity-1' });
  });
});
