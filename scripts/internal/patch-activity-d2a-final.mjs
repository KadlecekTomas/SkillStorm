#!/usr/bin/env node
import fs from 'node:fs';

const path = 'server/src/activity-engine/activity.service.ts';
let text = fs.readFileSync(path, 'utf8');

function replaceOnce(needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0) throw new Error(`Missing marker: ${label}`);
  if (text.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Ambiguous marker: ${label}`);
  }
  text = text.replace(needle, replacement);
}

replaceOnce(
`    const version = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtextextended(\${activity.id}, 0))\`;
      const latest = await tx.activityVersion.findFirst({`,
`    const version = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtextextended(\${activity.id}, 0))\`;

      // Re-check content identity only after the per-Activity transaction lock.
      // The optimistic pre-check above is useful for the common case, but two
      // simultaneous identical requests can both pass it before either writes.
      // This locked check turns that race into the public 409 contract instead
      // of leaking a Prisma/PostgreSQL unique-constraint error.
      const lockedDuplicate = await tx.activityVersion.findUnique({
        where: {
          activityId_contentChecksum: {
            activityId: activity.id,
            contentChecksum: checksum,
          },
        },
        select: { id: true, versionNo: true },
      });
      if (lockedDuplicate) {
        throw new ConflictException({
          code: 'ACTIVITY_VERSION_DUPLICATE_CONTENT',
          existing: lockedDuplicate,
        });
      }

      const latest = await tx.activityVersion.findFirst({`,
  'locked duplicate check',
);

replaceOnce(
`    this.assertPublisherForActivity(mapping.activityVersion.activity, actor);
    if (mapping.status !== ActivityCurriculumMappingStatus.PROPOSED) {`,
`    this.assertPublisherForActivity(mapping.activityVersion.activity, actor);
    if (
      mapping.activityVersion.status !== ActivityVersionStatus.DRAFT &&
      mapping.activityVersion.status !== ActivityVersionStatus.REVIEW
    ) {
      throw new ConflictException({ code: 'ACTIVITY_VERSION_MAPPING_FROZEN' });
    }
    if (mapping.status !== ActivityCurriculumMappingStatus.PROPOSED) {`,
  'review lifecycle guard',
);

replaceOnce(
`    const approved = mappings.filter(
      (mapping) => mapping.status === ActivityCurriculumMappingStatus.APPROVED,
    );
    if (approved.length === 0) {`,
`    if (
      mappings.some(
        (mapping) =>
          mapping.status === ActivityCurriculumMappingStatus.PROPOSED,
      )
    ) {
      throw new ConflictException({
        code: 'ACTIVITY_PUBLICATION_MAPPING_REVIEW_PENDING',
      });
    }

    const approved = mappings.filter(
      (mapping) => mapping.status === ActivityCurriculumMappingStatus.APPROVED,
    );
    if (approved.length === 0) {`,
  'pending mapping publication guard',
);

fs.writeFileSync(path, text);
fs.rmSync('scripts/internal/patch-activity-d2a-final.mjs');
fs.rmSync('.github/workflows/activity-d2a-final-patch.yml');
