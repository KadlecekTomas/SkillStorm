#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicePath = path.join(root, 'server/src/curriculum/curriculum.service.ts');
const dtoPath = path.join(root, 'server/src/curriculum/dto/curriculum.dto.ts');
const migrationPath = path.join(root, 'server/prisma/migrations/20260809005500_curriculum_foundation_d1/migration.sql');
const e2ePath = path.join(root, 'server/test/e2e/curriculum-foundation.e2e-spec.ts');
const selfPath = path.join(root, 'scripts/internal/harden-curriculum-d1.mjs');
const workflowPath = path.join(root, '.github/workflows/curriculum-d1-hardening-bootstrap.yml');

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
  'metadata: asJson({ code: framework.code }),',
  'metadata: asJson({ frameworkCode: framework.code }),',
  'framework audit key',
);
service = replaceOnce(
  service,
  `      organizationId,\n      metadata: asJson({ title: profile.title }),\n    });`,
  `      organizationId,\n    });`,
  'school profile free-text audit metadata',
);
service = replaceOnce(
  service,
  `      metadata: asJson({\n        profileId,\n        versionLabel: version.versionLabel,\n        sourceChecksum,\n      }),`,
  `      metadata: asJson({\n        profileId,\n        sourceChecksum,\n      }),`,
  'school version free-text audit metadata',
);
service = replaceOnce(
  service,
  `        metadata: asJson({ count: staleIds.length, mappingIds: staleIds }),`,
  `        metadata: asJson({ count: staleIds.length }),`,
  'stale refresh bounded audit metadata',
);
service = replaceOnce(
  service,
  `    if (!schoolOutcome) {\n      throw new NotFoundException('School outcome v organizaci nenalezen.');\n    }\n\n    const frameworkOutcome = await this.prisma.frameworkOutcome.findUnique({`,
  `    if (!schoolOutcome) {\n      throw new NotFoundException('School outcome v organizaci nenalezen.');\n    }\n    if (\n      schoolOutcome.schoolCurriculumVersion.status !==\n      SchoolCurriculumVersionStatus.PUBLISHED\n    ) {\n      throw new ConflictException({\n        code: 'CURRICULUM_MAPPING_SCHOOL_VERSION_NOT_PUBLISHED',\n        message: 'Mapping lze navrhnout pouze proti PUBLISHED ŠVP snapshotu.',\n      });\n    }\n\n    const frameworkOutcome = await this.prisma.frameworkOutcome.findUnique({`,
  'mapping published school version guard',
);
service = replaceOnce(
  service,
  `    if (\n      mapping.status === SchoolOutcomeMappingStatus.REJECTED ||\n      mapping.status === SchoolOutcomeMappingStatus.STALE\n    ) {\n      throw new ConflictException(\n        'REJECTED/STALE mapping nelze schválit; vytvořte nový návrh.',\n      );\n    }`,
  `    if (\n      mapping.status === SchoolOutcomeMappingStatus.APPROVED ||\n      mapping.status === SchoolOutcomeMappingStatus.REJECTED ||\n      mapping.status === SchoolOutcomeMappingStatus.STALE\n    ) {\n      throw new ConflictException({\n        code: 'CURRICULUM_MAPPING_REVIEW_CLOSED',\n        message:\n          'APPROVED/REJECTED/STALE mapping je historický záznam; pro změnu vytvořte nový návrh.',\n      });\n    }`,
  'closed mapping review guard',
);
service = replaceOnce(
  service,
  `  private validateSchoolVersionPayload(dto: CreateSchoolCurriculumVersionDto) {\n    const subjectCodes = new Set<string>();\n    for (const subject of dto.subjects) {\n      if (subject.code) this.assertUnique(subjectCodes, subject.code, 'school subject code');\n      const outcomeCodes = new Set<string>();\n      for (const outcome of subject.outcomes) {\n        if (outcome.externalCode) {\n          this.assertUnique(outcomeCodes, outcome.externalCode, 'school outcome code');\n        }\n      }\n    }\n  }`,
  `  private validateSchoolVersionPayload(dto: CreateSchoolCurriculumVersionDto) {\n    const subjectCodes = new Set<string>();\n    const outcomeCodes = new Set<string>();\n    for (const subject of dto.subjects) {\n      if (subject.code) {\n        this.assertUnique(subjectCodes, subject.code, 'school subject code');\n      }\n      const subjectGrades = new Set(subject.grades);\n      for (const outcome of subject.outcomes) {\n        if (outcome.externalCode) {\n          this.assertUnique(outcomeCodes, outcome.externalCode, 'school outcome code');\n        }\n        const invalidGrades = outcome.grades.filter(\n          (grade) => !subjectGrades.has(grade),\n        );\n        if (invalidGrades.length > 0) {\n          throw new BadRequestException({\n            code: 'SCHOOL_CURRICULUM_OUTCOME_GRADE_OUTSIDE_SUBJECT',\n            message:\n              'School outcome nesmí deklarovat ročník mimo grade scope svého předmětu.',\n            invalidGrades,\n            subjectCode: subject.code ?? null,\n            outcomeCode: outcome.externalCode ?? null,\n          });\n        }\n      }\n    }\n  }`,
  'school curriculum structural validation',
);
service = replaceOnce(
  service,
  `  private frameworkCanonicalPayload(dto: FrameworkReleaseImportDto): JsonLike {\n    return {\n      releaseCode: dto.releaseCode,\n      title: dto.title,\n      sourceUrl: dto.sourceUrl,\n      sourceAuthority: dto.sourceAuthority,\n      sourcePublishedAt: dto.sourcePublishedAt ?? null,\n      effectiveFrom: dto.effectiveFrom ?? null,\n      effectiveTo: dto.effectiveTo ?? null,\n      sourceMetadata: (dto.sourceMetadata ?? null) as JsonLike,\n      areas: [...dto.areas]`,
  `  private frameworkCanonicalPayload(dto: FrameworkReleaseImportDto): JsonLike {\n    // Content identity is deliberately independent of local release labels,\n    // mirrors and import metadata. The same authoritative curriculum structure\n    // must deduplicate even when it arrives through another URL/file.\n    return {\n      areas: [...dto.areas]`,
  'framework checksum content identity',
);
service = replaceOnce(
  service,
  `  private schoolCurriculumCanonicalPayload(\n    dto: CreateSchoolCurriculumVersionDto,\n  ): JsonLike {\n    return {\n      versionLabel: dto.versionLabel,\n      sourceType: dto.sourceType,\n      sourceFileId: dto.sourceFileId ?? null,\n      sourceDocumentName: dto.sourceDocumentName ?? null,\n      validFrom: dto.validFrom ?? null,\n      validTo: dto.validTo ?? null,\n      subjects: [...dto.subjects]`,
  `  private schoolCurriculumCanonicalPayload(\n    dto: CreateSchoolCurriculumVersionDto,\n  ): JsonLike {\n    // Snapshot identity is curriculum content, not the upload filename, local\n    // label or validity window. Re-importing the same ŠVP content must be\n    // detected as a duplicate rather than creating parallel truth.\n    return {\n      subjects: [...dto.subjects]`,
  'school checksum content identity',
);
fs.writeFileSync(servicePath, service);

let dto = fs.readFileSync(dtoPath, 'utf8');
dto = replaceOnce(
  dto,
  `  @IsArray()\n  @IsEnum(SchoolGrade, { each: true })\n  grades!: SchoolGrade[];\n\n  @IsOptional()\n  @IsInt()\n  @Min(0)\n  orderIndex?: number;`,
  `  @IsArray()\n  @ArrayMinSize(1)\n  @IsEnum(SchoolGrade, { each: true })\n  grades!: SchoolGrade[];\n\n  @IsOptional()\n  @IsInt()\n  @Min(0)\n  orderIndex?: number;`,
  'school outcome non-empty grades',
);
dto = replaceOnce(
  dto,
  `  @IsArray()\n  @IsEnum(SchoolGrade, { each: true })\n  grades!: SchoolGrade[];\n\n  @IsOptional()\n  @IsObject()\n  metadata?: Record<string, unknown>;\n\n  @IsArray()\n  @ValidateNested({ each: true })\n  @Type(() => SchoolOutcomeImportDto)\n  outcomes!: SchoolOutcomeImportDto[];`,
  `  @IsArray()\n  @ArrayMinSize(1)\n  @IsEnum(SchoolGrade, { each: true })\n  grades!: SchoolGrade[];\n\n  @IsOptional()\n  @IsObject()\n  metadata?: Record<string, unknown>;\n\n  @IsArray()\n  @ArrayMinSize(1)\n  @ValidateNested({ each: true })\n  @Type(() => SchoolOutcomeImportDto)\n  outcomes!: SchoolOutcomeImportDto[];`,
  'school subject non-empty grades/outcomes',
);
fs.writeFileSync(dtoPath, dto);

let migration = fs.readFileSync(migrationPath, 'utf8');
migration = replaceOnce(
  migration,
  `CREATE TRIGGER framework_outcomes_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "framework_outcomes" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_child_immutable();\n\n-- Published ŠVP snapshots are immutable; retirement is a status transition,`,
  `CREATE TRIGGER framework_outcomes_immutable_trigger BEFORE INSERT OR UPDATE OR DELETE ON "framework_outcomes" FOR EACH ROW EXECUTE FUNCTION curriculum_framework_child_immutable();\n\n-- Outcome aspects are SkillStorm's internal review layer and may evolve after\n-- an official framework release is verified. Any semantic edit must bump the\n-- review version so every approved mapping can be deterministically marked stale.\nCREATE OR REPLACE FUNCTION outcome_aspect_review_version_guard() RETURNS TRIGGER AS $$\nBEGIN\n  IF NEW."review_version" < OLD."review_version" THEN\n    RAISE EXCEPTION 'OUTCOME_ASPECT_REVIEW_VERSION_DECREASE';\n  END IF;\n  IF (NEW."title", NEW."description", NEW."required_for_full_coverage", NEW."status")\n      IS DISTINCT FROM\n     (OLD."title", OLD."description", OLD."required_for_full_coverage", OLD."status")\n     AND NEW."review_version" <= OLD."review_version" THEN\n    RAISE EXCEPTION 'OUTCOME_ASPECT_REVIEW_VERSION_REQUIRED';\n  END IF;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\nCREATE TRIGGER outcome_aspect_review_version_guard_trigger BEFORE UPDATE ON "outcome_aspects" FOR EACH ROW EXECUTE FUNCTION outcome_aspect_review_version_guard();\n\n-- Published ŠVP snapshots are immutable; retirement is a status transition,`,
  'outcome aspect review version trigger',
);
migration = replaceOnce(
  migration,
  `CREATE OR REPLACE FUNCTION school_outcome_mapping_history_guard() RETURNS TRIGGER AS $$\nBEGIN\n  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_HISTORY_IMMUTABLE'; END IF;\n  IF OLD."status" IN ('REJECTED', 'STALE') THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_HISTORY_IMMUTABLE'; END IF;\n  IF OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('APPROVED', 'STALE') THEN\n    RAISE EXCEPTION 'CURRICULUM_MAPPING_APPROVAL_IMMUTABLE';\n  END IF;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;`,
  `CREATE OR REPLACE FUNCTION school_outcome_mapping_history_guard() RETURNS TRIGGER AS $$\nBEGIN\n  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_HISTORY_IMMUTABLE'; END IF;\n  IF OLD."status" IN ('REJECTED', 'STALE') THEN RAISE EXCEPTION 'CURRICULUM_MAPPING_HISTORY_IMMUTABLE'; END IF;\n  IF OLD."status" = 'APPROVED' THEN\n    IF NEW."status" <> 'STALE' THEN\n      RAISE EXCEPTION 'CURRICULUM_MAPPING_APPROVAL_IMMUTABLE';\n    END IF;\n    IF (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM\n       (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN\n      RAISE EXCEPTION 'CURRICULUM_MAPPING_APPROVAL_IMMUTABLE';\n    END IF;\n  END IF;\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;`,
  'approved mapping history guard',
);
fs.writeFileSync(migrationPath, migration);

let e2e = fs.readFileSync(e2ePath, 'utf8');
e2e = replaceOnce(
  e2e,
  `    await curriculum.verifyFrameworkRelease(releaseId, platform);\n\n    const profile = await curriculum.createSchoolProfile(`,
  `    await curriculum.verifyFrameworkRelease(releaseId, platform);\n\n    const duplicateDryRun = await curriculum.dryRunFrameworkImport(\n      framework.code,\n      {\n        releaseCode: 'same-content-different-label',\n        title: 'Mirror label must not change content identity',\n        sourceUrl: 'https://mirror.example.invalid/rvp-zv-e2e',\n        sourceAuthority: 'Another local label',\n        areas: [\n          {\n            externalCode: 'INF',\n            title: 'Informatika',\n            sortOrder: 1,\n            fields: [\n              {\n                externalCode: 'INF-DATA',\n                title: 'Data, informace a modelování',\n                sortOrder: 1,\n                outcomes: [\n                  {\n                    externalCode: 'INF-OVU-001',\n                    sourceAnchor: 'e2e-stable-outcome-1',\n                    title: 'Žák pracuje s daty a modely.',\n                    nodeGrade: 9,\n                    aspects: [\n                      {\n                        code: 'MODEL',\n                        title: 'Modelování',\n                        description: 'Rozpozná a vytváří model.',\n                        requiredForFullCoverage: true,\n                      },\n                    ],\n                  },\n                ],\n              },\n            ],\n          },\n        ],\n      },\n    );\n    expect(duplicateDryRun.duplicate?.id).toBe(releaseId);\n\n    const profile = await curriculum.createSchoolProfile(`,
  'framework content checksum E2E',
);
e2e = replaceOnce(
  e2e,
  `    await curriculum.publishSchoolCurriculumVersion(newVersionId, actorA);\n  });`,
  `    await curriculum.publishSchoolCurriculumVersion(newVersionId, actorA);\n\n    await expect(\n      curriculum.createSchoolCurriculumVersion(\n        profileId,\n        {\n          versionLabel: 'same-content-new-label',\n          sourceType: SchoolCurriculumSourceType.UPLOAD,\n          sourceDocumentName: 'renamed-file.pdf',\n          subjects: [\n            {\n              code: 'INF-NEW',\n              title: 'Informatika nové RVP',\n              grades: [SchoolGrade.GRADE_6],\n              outcomes: [\n                {\n                  externalCode: 'SVP-NEW-001',\n                  title: 'Nový školní outcome',\n                  grades: [SchoolGrade.GRADE_6],\n                },\n              ],\n            },\n          ],\n        },\n        actorA,\n      ),\n    ).rejects.toMatchObject({ status: 409 });\n  });`,
  'school content checksum E2E',
);
e2e = replaceOnce(
  e2e,
  `    const approved = await curriculum.reviewSchoolOutcomeMapping(\n      mapping.id,\n      {\n        status: SchoolOutcomeMappingStatus.APPROVED,\n        rationale: 'Reviewed by school curriculum owner in E2E.',\n      },\n      actorA,\n    );\n    expect(approved.status).toBe(SchoolOutcomeMappingStatus.APPROVED);\n\n    await prisma.outcomeAspect.update({\n      where: { id: aspectId },\n      data: { reviewVersion: { increment: 1 } },\n    });`,
  `    const approved = await curriculum.reviewSchoolOutcomeMapping(\n      mapping.id,\n      {\n        status: SchoolOutcomeMappingStatus.APPROVED,\n        rationale: 'Reviewed by school curriculum owner in E2E.',\n      },\n      actorA,\n    );\n    expect(approved.status).toBe(SchoolOutcomeMappingStatus.APPROVED);\n\n    await expect(\n      curriculum.reviewSchoolOutcomeMapping(\n        mapping.id,\n        {\n          status: SchoolOutcomeMappingStatus.APPROVED,\n          rationale: 'An approved decision must not be silently rewritten.',\n        },\n        actorA,\n      ),\n    ).rejects.toMatchObject({\n      response: expect.objectContaining({ code: 'CURRICULUM_MAPPING_REVIEW_CLOSED' }),\n    });\n\n    await expect(\n      prisma.outcomeAspect.update({\n        where: { id: aspectId },\n        data: { description: 'Semantic change without provenance bump.' },\n      }),\n    ).rejects.toThrow(/OUTCOME_ASPECT_REVIEW_VERSION_REQUIRED/);\n\n    await prisma.outcomeAspect.update({\n      where: { id: aspectId },\n      data: {\n        description: 'Reviewed semantic change with explicit provenance bump.',\n        reviewVersion: { increment: 1 },\n      },\n    });`,
  'approved mapping and aspect review E2E',
);
fs.writeFileSync(e2ePath, e2e);

if (fs.existsSync(selfPath)) fs.rmSync(selfPath);
if (fs.existsSync(workflowPath)) fs.rmSync(workflowPath);
console.log('Final Curriculum D1 provenance hardening applied.');
