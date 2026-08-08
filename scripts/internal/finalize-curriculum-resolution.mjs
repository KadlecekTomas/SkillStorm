#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const servicePath = path.join(root, 'server/src/curriculum/curriculum.service.ts');
const dtoPath = path.join(root, 'server/src/curriculum/dto/curriculum.dto.ts');
const e2ePath = path.join(root, 'server/test/e2e/curriculum-foundation.e2e-spec.ts');
const selfPath = path.join(root, 'scripts/internal/finalize-curriculum-resolution.mjs');
const workflowPath = path.join(root, '.github/workflows/curriculum-resolution-bootstrap.yml');

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
  `  OrganizationRole,\n  Prisma,`,
  `  OrganizationRole,\n  OutcomeAspectStatus,\n  Prisma,`,
  'OutcomeAspectStatus import',
);
service = replaceOnce(
  service,
  `    if (aspect && aspect.frameworkOutcomeId !== frameworkOutcome.id) {\n      throw new BadRequestException({\n        code: 'CURRICULUM_MAPPING_ASPECT_OUTCOME_MISMATCH',\n        message: 'Outcome aspect nepatří ke zvolenému framework outcome.',\n      });\n    }\n\n    const duplicate = await this.prisma.schoolOutcomeMapping.findFirst({`,
  `    if (aspect && aspect.frameworkOutcomeId !== frameworkOutcome.id) {\n      throw new BadRequestException({\n        code: 'CURRICULUM_MAPPING_ASPECT_OUTCOME_MISMATCH',\n        message: 'Outcome aspect nepatří ke zvolenému framework outcome.',\n      });\n    }\n    if (aspect && aspect.status !== OutcomeAspectStatus.ACTIVE) {\n      throw new ConflictException({\n        code: 'CURRICULUM_MAPPING_ASPECT_RETIRED',\n        message: 'Nový mapping nelze navrhnout proti RETIRED outcome aspect.',\n      });\n    }\n\n    const duplicate = await this.prisma.schoolOutcomeMapping.findFirst({`,
  'retired aspect mapping guard',
);

const oldResolver = `  async resolveApplicability(\n    query: ResolveCurriculumApplicabilityDto,\n    actor: JwtPayload,\n  ) {\n    const organizationId = this.requireActorOrganization(actor);\n    const classSection = await this.prisma.classSection.findFirst({\n      where: {\n        id: query.classSectionId,\n        yearId: query.academicYearId,\n        orgId: organizationId,\n      },\n      select: { id: true, grade: true, yearId: true },\n    });\n    if (!classSection) {\n      throw new NotFoundException('Třída pro zvolený školní rok nenalezena.');\n    }\n\n    const now = new Date();\n    const candidates = await this.prisma.curriculumApplicability.findMany({\n      where: {\n        organizationId,\n        academicYearId: query.academicYearId,\n        status: CurriculumApplicabilityStatus.ACTIVE,\n        AND: [\n          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },\n          { OR: [{ validTo: null }, { validTo: { gte: now } }] },\n          {\n            OR: [\n              { classSectionId: classSection.id },\n              { classSectionId: null, grade: classSection.grade },\n              { classSectionId: null, grade: null },\n            ],\n          },\n        ],\n      },\n      include: {\n        schoolCurriculumVersion: { include: { profile: true } },\n        frameworkRelease: { include: { framework: true } },\n      },\n    });`;

const newResolver = `  async resolveApplicability(\n    query: ResolveCurriculumApplicabilityDto,\n    actor: JwtPayload,\n  ) {\n    const organizationId = this.requireActorOrganization(actor);\n    const [academicYear, classSection] = await Promise.all([\n      this.prisma.academicYear.findFirst({\n        where: {\n          id: query.academicYearId,\n          orgId: organizationId,\n          deletedAt: null,\n        },\n        select: { id: true, startsAt: true, endsAt: true, isCurrent: true },\n      }),\n      this.prisma.classSection.findFirst({\n        where: {\n          id: query.classSectionId,\n          yearId: query.academicYearId,\n          orgId: organizationId,\n        },\n        select: { id: true, grade: true, yearId: true },\n      }),\n    ]);\n    if (!academicYear || !classSection) {\n      throw new NotFoundException('Třída pro zvolený školní rok nenalezena.');\n    }\n\n    const now = new Date();\n    const requestedAsOf = query.asOf ? new Date(query.asOf) : null;\n    if (\n      requestedAsOf &&\n      (requestedAsOf < academicYear.startsAt || requestedAsOf > academicYear.endsAt)\n    ) {\n      throw new BadRequestException({\n        code: 'CURRICULUM_RESOLUTION_DATE_OUTSIDE_ACADEMIC_YEAR',\n        message: 'asOf musí ležet uvnitř zvoleného školního roku.',\n      });\n    }\n\n    const resolutionDate =\n      requestedAsOf ??\n      (now >= academicYear.startsAt && now <= academicYear.endsAt\n        ? now\n        : now < academicYear.startsAt\n          ? academicYear.startsAt\n          : academicYear.endsAt);\n\n    const candidates = await this.prisma.curriculumApplicability.findMany({\n      where: {\n        organizationId,\n        academicYearId: query.academicYearId,\n        status: CurriculumApplicabilityStatus.ACTIVE,\n        AND: [\n          { OR: [{ validFrom: null }, { validFrom: { lte: resolutionDate } }] },\n          { OR: [{ validTo: null }, { validTo: { gte: resolutionDate } }] },\n          {\n            OR: [\n              { classSectionId: classSection.id },\n              { classSectionId: null, grade: classSection.grade },\n              { classSectionId: null, grade: null },\n            ],\n          },\n        ],\n      },\n      include: {\n        schoolCurriculumVersion: { include: { profile: true } },\n        frameworkRelease: { include: { framework: true } },\n      },\n    });`;
service = replaceOnce(service, oldResolver, newResolver, 'historical applicability resolver');
service = replaceOnce(
  service,
  `          priority: selected.priority,\n        },`,
  `          priority: selected.priority,\n          asOf: resolutionDate.toISOString(),\n          academicYear: {\n            startsAt: academicYear.startsAt.toISOString(),\n            endsAt: academicYear.endsAt.toISOString(),\n            isCurrent: academicYear.isCurrent,\n          },\n        },`,
  'resolution provenance response',
);
fs.writeFileSync(servicePath, service);

let dto = fs.readFileSync(dtoPath, 'utf8');
dto = replaceOnce(
  dto,
  `export class ResolveCurriculumApplicabilityDto {\n  @IsUUID()\n  academicYearId!: string;\n\n  @IsUUID()\n  classSectionId!: string;\n}`,
  `export class ResolveCurriculumApplicabilityDto {\n  @IsUUID()\n  academicYearId!: string;\n\n  @IsUUID()\n  classSectionId!: string;\n\n  @IsOptional()\n  @IsISO8601()\n  asOf?: string;\n}`,
  'resolve asOf DTO',
);
fs.writeFileSync(dtoPath, dto);

let e2e = fs.readFileSync(e2ePath, 'utf8');
e2e = replaceOnce(
  e2e,
  `    const classSelected = await curriculum.resolveApplicability(\n      { academicYearId: yearId, classSectionId: class6Id },\n      actorA,\n    );`,
  `    const academicYear = await prisma.academicYear.findUniqueOrThrow({\n      where: { id: yearId },\n      select: { startsAt: true, endsAt: true },\n    });\n    const midpoint = new Date(\n      (academicYear.startsAt.getTime() + academicYear.endsAt.getTime()) / 2,\n    ).toISOString();\n\n    const classSelected = await curriculum.resolveApplicability(\n      { academicYearId: yearId, classSectionId: class6Id, asOf: midpoint },\n      actorA,\n    );`,
  'explicit asOf resolution E2E',
);
e2e = replaceOnce(
  e2e,
  `    expect(classSelected.resolution.specificity).toBe('CLASS');\n    expect(classSelected.applicability.schoolCurriculumVersionId).toBe(\n      legacyVersionId,\n    );`,
  `    expect(classSelected.resolution.specificity).toBe('CLASS');\n    expect(classSelected.resolution.asOf).toBe(midpoint);\n    expect(classSelected.applicability.schoolCurriculumVersionId).toBe(\n      legacyVersionId,\n    );\n\n    await expect(\n      curriculum.resolveApplicability(\n        {\n          academicYearId: yearId,\n          classSectionId: class6Id,\n          asOf: new Date(academicYear.endsAt.getTime() + 86_400_000).toISOString(),\n        },\n        actorA,\n      ),\n    ).rejects.toMatchObject({\n      response: expect.objectContaining({\n        code: 'CURRICULUM_RESOLUTION_DATE_OUTSIDE_ACADEMIC_YEAR',\n      }),\n    });`,
  'asOf boundary E2E',
);
e2e = replaceOnce(
  e2e,
  `    await prisma.outcomeAspect.update({\n      where: { id: aspectId },\n      data: {\n        description: 'Reviewed semantic change with explicit provenance bump.',\n        reviewVersion: { increment: 1 },\n      },\n    });\n    const stale = await curriculum.refreshStaleMappings(actorA);`,
  `    await prisma.outcomeAspect.update({\n      where: { id: aspectId },\n      data: {\n        description: 'Reviewed semantic change with explicit provenance bump.',\n        reviewVersion: { increment: 1 },\n      },\n    });\n    const stale = await curriculum.refreshStaleMappings(actorA);`,
  'retain stale refresh block',
);
e2e = replaceOnce(
  e2e,
  `    expect(persisted.status).toBe(SchoolOutcomeMappingStatus.STALE);\n  });\n});`,
  `    expect(persisted.status).toBe(SchoolOutcomeMappingStatus.STALE);\n\n    await prisma.outcomeAspect.update({\n      where: { id: aspectId },\n      data: { status: 'RETIRED', reviewVersion: { increment: 1 } },\n    });\n    await expect(\n      curriculum.proposeSchoolOutcomeMapping(\n        {\n          schoolOutcomeId: newSchoolOutcomeId,\n          frameworkOutcomeId: frameworkOutcome.id,\n          outcomeAspectId: aspectId,\n          mappingType: SchoolOutcomeMappingType.SUPPORTING,\n          confidence: 0.5,\n          rationale: 'A retired aspect must never accept a new mapping.',\n          proposedByType: MappingProposerType.HUMAN,\n        },\n        actorA,\n      ),\n    ).rejects.toMatchObject({\n      response: expect.objectContaining({ code: 'CURRICULUM_MAPPING_ASPECT_RETIRED' }),\n    });\n  });\n});`,
  'retired aspect E2E',
);
fs.writeFileSync(e2ePath, e2e);

if (fs.existsSync(selfPath)) fs.rmSync(selfPath);
if (fs.existsSync(workflowPath)) fs.rmSync(workflowPath);
console.log('Historical resolver and aspect lifecycle hardening applied.');
