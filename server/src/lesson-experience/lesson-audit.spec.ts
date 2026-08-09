import { sanitizeAuditMetadata } from '@/audit/audit-metadata.sanitize';

describe('Lesson Experience audit provenance', () => {
  it('keeps only stable Lesson Experience provenance fields', () => {
    expect(
      sanitizeAuditMetadata({
        lessonExperienceId: 'lesson-1',
        lessonExperienceVersionId: 'version-1',
        lessonExperienceMappingId: 'mapping-1',
        contentChecksum: 'b'.repeat(64),
        stageCount: 7,
        schemaVersion: 1,
        scope: 'ORGANIZATION',
      }),
    ).toEqual({
      lessonExperienceId: 'lesson-1',
      lessonExperienceVersionId: 'version-1',
      lessonExperienceMappingId: 'mapping-1',
      contentChecksum: 'b'.repeat(64),
      stageCount: 7,
      schemaVersion: 1,
      scope: 'ORGANIZATION',
    });
  });

  it('strips prompts, teacher guidance and pedagogical free text', () => {
    expect(
      sanitizeAuditMetadata({
        lessonExperienceId: 'lesson-1',
        learningObjective: 'Free text objective',
        pedagogicalRationale: 'Free text rationale',
        studentPrompt: 'Potential local content',
        teacherGuidance: 'Potential teacher-entered text',
        teacherPlan: { startInstructions: 'Do not copy me' },
        password: 'never-log-me',
      }),
    ).toEqual({ lessonExperienceId: 'lesson-1' });
  });
});
