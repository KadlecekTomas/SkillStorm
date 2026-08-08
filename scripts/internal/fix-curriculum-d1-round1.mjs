#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicePath = path.join(root, 'server/src/curriculum/curriculum.service.ts');
const dtoPath = path.join(root, 'server/src/curriculum/dto/curriculum.dto.ts');
const migrationPath = path.join(root, 'server/prisma/migrations/20260809005500_curriculum_foundation_d1/migration.sql');
const e2ePath = path.join(root, 'server/test/e2e/curriculum-foundation.e2e-spec.ts');
const selfPath = path.join(root, 'scripts/internal/fix-curriculum-d1-round1.mjs');
const workflowPath = path.join(root, '.github/workflows/curriculum-d1-fix-round1.yml');

function replaceOnce(input, needle, replacement, label) {
  const first = input.indexOf(needle);
  if (first < 0) throw new Error(`Missing patch marker: ${label}`);
  if (input.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Ambiguous patch marker: ${label}`);
  }
  return input.replace(needle, replacement);
}

let service = fs.readFileSync(servicePath, 'utf8');
service = replaceOnce(
  service,
  `function optionalDate(value?: string): Date | undefined {\n  return value ? new Date(value) : undefined;\n}`,
  `function optionalDate(value?: string): Date | null {\n  return value ? new Date(value) : null;\n}`,
  'optionalDate nullable contract',
);
service = replaceOnce(service, 'description: areaDto.description?.trim(),', 'description: areaDto.description?.trim() ?? null,', 'area description');
service = replaceOnce(service, 'description: fieldDto.description?.trim(),', 'description: fieldDto.description?.trim() ?? null,', 'field description');
service = replaceOnce(
  service,
  `                description: outcomeDto.description?.trim(),\n                nodeGrade: outcomeDto.nodeGrade,`,
  `                description: outcomeDto.description?.trim() ?? null,\n                nodeGrade: outcomeDto.nodeGrade ?? null,`,
  'framework outcome nullable fields',
);
service = replaceOnce(service, 'sourceAnchor: outcomeDto.sourceAnchor?.trim(),', 'sourceAnchor: outcomeDto.sourceAnchor?.trim() ?? null,', 'framework outcome source anchor');
service = replaceOnce(service, 'sourceFileId: dto.sourceFileId?.trim(),', 'sourceFileId: dto.sourceFileId?.trim() ?? null,', 'school source file');
service = replaceOnce(service, 'sourceDocumentName: dto.sourceDocumentName?.trim(),', 'sourceDocumentName: dto.sourceDocumentName?.trim() ?? null,', 'school source document');
service = replaceOnce(service, 'code: subjectDto.code?.trim(),', 'code: subjectDto.code?.trim() ?? null,', 'school subject code');
service = replaceOnce(service, 'shortTitle: subjectDto.shortTitle?.trim(),', 'shortTitle: subjectDto.shortTitle?.trim() ?? null,', 'school subject short title');
service = replaceOnce(service, 'externalCode: outcomeDto.externalCode?.trim(),', 'externalCode: outcomeDto.externalCode?.trim() ?? null,', 'school outcome code');
service = replaceOnce(service, 'description: outcomeDto.description?.trim(),', 'description: outcomeDto.description?.trim() ?? null,', 'school outcome description');
service = replaceOnce(service, 'orderIndex: outcomeDto.orderIndex,', 'orderIndex: outcomeDto.orderIndex ?? null,', 'school outcome order');
service = replaceOnce(service, 'sourceAnchor: outcomeDto.sourceAnchor?.trim(),', 'sourceAnchor: outcomeDto.sourceAnchor?.trim() ?? null,', 'school outcome source anchor');
service = replaceOnce(
  service,
  `        grade: dto.classSectionId ? null : dto.grade,\n        classSectionId: dto.classSectionId,\n        validFrom: optionalDate(dto.validFrom),\n        validTo: optionalDate(dto.validTo),`,
  `        grade: dto.classSectionId ? null : (dto.grade ?? null),\n        classSectionId: dto.classSectionId ?? null,\n        validFrom: optionalDate(dto.validFrom),\n        validTo: optionalDate(dto.validTo),`,
  'applicability nullable scope',
);
service = replaceOnce(
  service,
  `        outcomeAspectId: aspect?.id,\n        mappingType: dto.mappingType,\n        confidence: dto.confidence,`,
  `        outcomeAspectId: aspect?.id ?? null,\n        mappingType: dto.mappingType,\n        confidence: dto.confidence ?? null,`,
  'mapping nullable aspect/confidence',
);
service = replaceOnce(service, 'outcomeAspectReviewVersion: aspect?.reviewVersion,', 'outcomeAspectReviewVersion: aspect?.reviewVersion ?? null,', 'mapping aspect review version');
service = replaceOnce(
  service,
  `          sourceAnchor: outcome.sourceAnchor,\n          fieldExternalCode: field.externalCode,\n          title: outcome.title,\n          description: outcome.description,`,
  `          sourceAnchor: outcome.sourceAnchor ?? null,\n          fieldExternalCode: field.externalCode,\n          title: outcome.title,\n          description: outcome.description ?? null,`,
  'flatten nullable outcome fields',
);
fs.writeFileSync(servicePath, service);

let dto = fs.readFileSync(dtoPath, 'utf8');
dto = replaceOnce(dto, '  IsArray,\n  IsEnum,', '  IsArray,\n  IsBoolean,\n  IsEnum,', 'IsBoolean import');
dto = replaceOnce(
  dto,
  `  @IsOptional()\n  requiredForFullCoverage?: boolean;`,
  `  @IsOptional()\n  @IsBoolean()\n  requiredForFullCoverage?: boolean;`,
  'requiredForFullCoverage validation',
);
dto = replaceOnce(
  dto,
  `  status!:\n    | SchoolOutcomeMappingStatus.REVIEWED\n    | SchoolOutcomeMappingStatus.APPROVED\n    | SchoolOutcomeMappingStatus.REJECTED;`,
  `  status!: SchoolOutcomeMappingStatus;`,
  'mapping status type',
);
fs.writeFileSync(dtoPath, dto);

let migration = fs.readFileSync(migrationPath, 'utf8');
const uuidCount = (migration.match(/\bUUID\b/g) ?? []).length;
if (uuidCount < 20) throw new Error(`Unexpected UUID marker count: ${uuidCount}`);
migration = migration.replace(/\bUUID\b/g, 'TEXT');
migration = replaceOnce(
  migration,
  `  IF TG_OP = 'UPDATE' AND OLD."status" IN ('PUBLISHED', 'RETIRED') THEN\n    IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN`,
  `  IF TG_OP = 'UPDATE' AND OLD."status" IN ('PUBLISHED', 'RETIRED') THEN\n    IF (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN`,
  'school version retirement updatedAt allowance',
);
migration = replaceOnce(
  migration,
  `  CONSTRAINT "school_outcome_mapping_review_check" CHECK (\n    ("status" IN ('PROPOSED', 'STALE') AND "reviewed_at" IS NULL)\n    OR ("status" IN ('REVIEWED', 'APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "review_rationale" IS NOT NULL)\n  )`,
  `  CONSTRAINT "school_outcome_mapping_review_check" CHECK (\n    ("status" = 'PROPOSED' AND "reviewed_at" IS NULL)\n    OR ("status" IN ('REVIEWED', 'APPROVED', 'REJECTED') AND "reviewed_at" IS NOT NULL AND "reviewed_by" IS NOT NULL AND "review_rationale" IS NOT NULL)\n    OR "status" = 'STALE'\n  )`,
  'STALE preserves review provenance',
);
fs.writeFileSync(migrationPath, migration);

let e2e = fs.readFileSync(e2ePath, 'utf8');
const castCount = (e2e.match(/\$2::uuid/g) ?? []).length;
if (castCount !== 2) throw new Error(`Unexpected E2E uuid cast count: ${castCount}`);
e2e = e2e.replace(/\$2::uuid/g, '$2::text');
fs.writeFileSync(e2ePath, e2e);

if (fs.existsSync(selfPath)) fs.rmSync(selfPath);
if (fs.existsSync(workflowPath)) fs.rmSync(workflowPath);

console.log(`Curriculum D1 round-1 fixes applied (${uuidCount} SQL UUID markers corrected to TEXT).`);
