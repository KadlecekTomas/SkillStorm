import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test as NestTest } from '@nestjs/testing';
import {
  MappingProposerType,
  OrganizationRole,
  OrganizationStatus,
  SchoolCurriculumSourceType,
  SchoolGrade,
  SchoolOutcomeMappingStatus,
  SchoolOutcomeMappingType,
  SystemRole,
} from '@prisma/client';
import { AppModule } from '@/app.module';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { CurriculumService } from '@/curriculum/curriculum.service';
import { PrismaService } from '@/prisma/prisma.service';
import { setupOrgContext } from 'test/helpers';

function schoolActor(ctx: any): JwtPayload {
  return {
    userId: ctx.owner.user.id,
    email: ctx.owner.user.email,
    organizationId: ctx.organization.id,
    membershipId: ctx.owner.membership.id,
    organizationRole: OrganizationRole.DIRECTOR,
    activeRole: OrganizationRole.DIRECTOR,
  };
}

function platformActor(ctx: any): JwtPayload {
  return {
    userId: ctx.owner.user.id,
    email: ctx.owner.user.email,
    systemRole: SystemRole.SUPERADMIN,
    isPlatformAdmin: true,
  };
}

describe('Curriculum foundation D1 invariants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let curriculum: CurriculumService;
  let orgA: any;
  let orgB: any;
  let actorA: JwtPayload;
  let actorB: JwtPayload;
  let platform: JwtPayload;
  let frameworkId: string;
  let releaseId: string;
  let aspectId: string;
  let profileId: string;
  let legacyVersionId: string;
  let newVersionId: string;
  let newSchoolOutcomeId: string;
  let class6Id: string;
  let class8Id: string;
  let yearId: string;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    curriculum = app.get(CurriculumService);
    await prisma.$connect();

    orgA = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `curriculum_a_${Date.now()}`,
    });
    orgB = await setupOrgContext(app, prisma, {
      role: 'DIRECTOR',
      seed: `curriculum_b_${Date.now()}`,
    });
    await prisma.organization.updateMany({
      where: { id: { in: [orgA.organization.id, orgB.organization.id] } },
      data: { status: OrganizationStatus.ACTIVE },
    });

    actorA = schoolActor(orgA);
    actorB = schoolActor(orgB);
    platform = platformActor(orgA);

    const year = await prisma.academicYear.findFirstOrThrow({
      where: { orgId: orgA.organization.id, isCurrent: true, deletedAt: null },
      orderBy: { startsAt: 'desc' },
    });
    yearId = year.id;

    const [class6, class8] = await Promise.all([
      prisma.classSection.create({
        data: {
          orgId: orgA.organization.id,
          yearId,
          grade: SchoolGrade.GRADE_6,
          section: `C6-${Date.now()}`,
        },
      }),
      prisma.classSection.create({
        data: {
          orgId: orgA.organization.id,
          yearId,
          grade: SchoolGrade.GRADE_8,
          section: `C8-${Date.now()}`,
        },
      }),
    ]);
    class6Id = class6.id;
    class8Id = class8.id;

    const framework = await curriculum.createFramework(
      {
        code: `RVP-ZV-E2E-${Date.now()}`,
        jurisdiction: 'CZ',
        educationType: 'ZV',
        title: 'RVP ZV E2E',
        authorityName: 'E2E authority',
      },
      platform,
    );
    frameworkId = framework.id;

    const release = await curriculum.importFrameworkRelease(
      framework.code,
      {
        releaseCode: '2026-e2e',
        title: 'RVP ZV E2E 2026',
        sourceUrl: 'https://example.invalid/rvp-zv-e2e',
        sourceAuthority: 'E2E authority',
        areas: [
          {
            externalCode: 'INF',
            title: 'Informatika',
            sortOrder: 1,
            fields: [
              {
                externalCode: 'INF-DATA',
                title: 'Data, informace a modelování',
                sortOrder: 1,
                outcomes: [
                  {
                    externalCode: 'INF-OVU-001',
                    sourceAnchor: 'e2e-stable-outcome-1',
                    title: 'Žák pracuje s daty a modely.',
                    nodeGrade: 9,
                    aspects: [
                      {
                        code: 'MODEL',
                        title: 'Modelování',
                        description: 'Rozpozná a vytváří model.',
                        requiredForFullCoverage: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      platform,
    );
    releaseId = release.id;
    aspectId = release.outcomes[0]!.aspects[0]!.id;
    await curriculum.verifyFrameworkRelease(releaseId, platform);

    const profile = await curriculum.createSchoolProfile(
      { title: 'ŠVP E2E' },
      actorA,
    );
    profileId = profile.id;

    const legacy = await curriculum.createSchoolCurriculumVersion(
      profileId,
      {
        versionLabel: 'legacy-e2e',
        sourceType: SchoolCurriculumSourceType.MANUAL,
        subjects: [
          {
            code: 'INF',
            title: 'Informatika',
            grades: [SchoolGrade.GRADE_6, SchoolGrade.GRADE_8],
            outcomes: [
              {
                externalCode: 'SVP-LEGACY-001',
                title: 'Legacy školní outcome',
                grades: [SchoolGrade.GRADE_6, SchoolGrade.GRADE_8],
              },
            ],
          },
        ],
      },
      actorA,
    );
    legacyVersionId = legacy.id;
    await curriculum.publishSchoolCurriculumVersion(legacyVersionId, actorA);

    const modern = await curriculum.createSchoolCurriculumVersion(
      profileId,
      {
        versionLabel: 'new-e2e',
        sourceType: SchoolCurriculumSourceType.MANUAL,
        subjects: [
          {
            code: 'INF-NEW',
            title: 'Informatika nové RVP',
            grades: [SchoolGrade.GRADE_6],
            outcomes: [
              {
                externalCode: 'SVP-NEW-001',
                title: 'Nový školní outcome',
                grades: [SchoolGrade.GRADE_6],
              },
            ],
          },
        ],
      },
      actorA,
    );
    newVersionId = modern.id;
    newSchoolOutcomeId = modern.subjects[0]!.outcomes[0]!.id;
    await curriculum.publishSchoolCurriculumVersion(newVersionId, actorA);
  });

  afterAll(async () => {
    // Test-only cleanup bypasses the history triggers so this suite remains
    // idempotent without weakening production behavior.
    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
        if (profileId) {
          await tx.schoolOutcomeMapping.deleteMany({
            where: { schoolCurriculumVersion: { profileId } },
          });
          await tx.curriculumApplicability.deleteMany({
            where: { schoolCurriculumVersion: { profileId } },
          });
          await tx.schoolOutcome.deleteMany({
            where: { schoolCurriculumVersion: { profileId } },
          });
          await tx.schoolSubject.deleteMany({
            where: { schoolCurriculumVersion: { profileId } },
          });
          await tx.schoolCurriculumVersion.deleteMany({ where: { profileId } });
          await tx.schoolCurriculumProfile.deleteMany({ where: { id: profileId } });
        }
        if (releaseId) {
          await tx.outcomeAspect.deleteMany({
            where: { frameworkOutcome: { frameworkReleaseId: releaseId } },
          });
          await tx.frameworkOutcome.deleteMany({
            where: { frameworkReleaseId: releaseId },
          });
          await tx.frameworkField.deleteMany({ where: { frameworkReleaseId: releaseId } });
          await tx.frameworkArea.deleteMany({ where: { frameworkReleaseId: releaseId } });
          await tx.curriculumFrameworkRelease.deleteMany({ where: { id: releaseId } });
        }
        if (frameworkId) {
          await tx.curriculumFramework.deleteMany({ where: { id: frameworkId } });
        }
        await tx.classSection.deleteMany({ where: { id: { in: [class6Id, class8Id] } } });
      })
      .catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  it('keeps VERIFIED canonical outcomes immutable even through raw SQL', async () => {
    const outcome = await prisma.frameworkOutcome.findFirstOrThrow({
      where: { frameworkReleaseId: releaseId },
    });
    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE framework_outcomes SET title = $1 WHERE framework_outcome_id = $2::uuid',
        'Tampered title',
        outcome.id,
      ),
    ).rejects.toThrow(/CURRICULUM_FRAMEWORK_RELEASE_IMMUTABLE/);
  });

  it('keeps PUBLISHED school outcomes immutable even through raw SQL', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE school_outcomes SET title = $1 WHERE school_outcome_id = $2::uuid',
        'Tampered ŠVP title',
        newSchoolOutcomeId,
      ),
    ).rejects.toThrow(/SCHOOL_CURRICULUM_VERSION_IMMUTABLE/);
  });

  it('resolves legacy + new curricula concurrently and class override wins', async () => {
    await curriculum.createApplicability(
      {
        schoolCurriculumVersionId: legacyVersionId,
        frameworkReleaseId: releaseId,
        academicYearId: yearId,
        priority: 0,
      },
      actorA,
    );
    await curriculum.createApplicability(
      {
        schoolCurriculumVersionId: newVersionId,
        frameworkReleaseId: releaseId,
        academicYearId: yearId,
        grade: SchoolGrade.GRADE_6,
        priority: 0,
      },
      actorA,
    );
    const classOverride = await curriculum.createApplicability(
      {
        schoolCurriculumVersionId: legacyVersionId,
        frameworkReleaseId: releaseId,
        academicYearId: yearId,
        classSectionId: class6Id,
        priority: -50,
      },
      actorA,
    );

    const classSelected = await curriculum.resolveApplicability(
      { academicYearId: yearId, classSectionId: class6Id },
      actorA,
    );
    expect(classSelected.resolution.specificity).toBe('CLASS');
    expect(classSelected.applicability.schoolCurriculumVersionId).toBe(
      legacyVersionId,
    );

    await curriculum.retireApplicability(classOverride.id, actorA);
    const gradeSelected = await curriculum.resolveApplicability(
      { academicYearId: yearId, classSectionId: class6Id },
      actorA,
    );
    expect(gradeSelected.resolution.specificity).toBe('GRADE');
    expect(gradeSelected.applicability.schoolCurriculumVersionId).toBe(
      newVersionId,
    );

    const legacySelected = await curriculum.resolveApplicability(
      { academicYearId: yearId, classSectionId: class8Id },
      actorA,
    );
    expect(legacySelected.resolution.specificity).toBe('SCHOOL_DEFAULT');
    expect(legacySelected.applicability.schoolCurriculumVersionId).toBe(
      legacyVersionId,
    );
  });

  it('rejects cross-tenant reads instead of leaking a foreign ŠVP snapshot', async () => {
    await expect(
      curriculum.getSchoolCurriculumVersion(newVersionId, actorB),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a duplicate equal-rank applicability at DB/service boundary', async () => {
    await expect(
      curriculum.createApplicability(
        {
          schoolCurriculumVersionId: newVersionId,
          frameworkReleaseId: releaseId,
          academicYearId: yearId,
          grade: SchoolGrade.GRADE_6,
          priority: 0,
        },
        actorA,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('allows a human-reviewed mapping and marks it STALE after aspect review changes', async () => {
    const frameworkOutcome = await prisma.frameworkOutcome.findFirstOrThrow({
      where: { frameworkReleaseId: releaseId },
    });
    const mapping = await curriculum.proposeSchoolOutcomeMapping(
      {
        schoolOutcomeId: newSchoolOutcomeId,
        frameworkOutcomeId: frameworkOutcome.id,
        outcomeAspectId: aspectId,
        mappingType: SchoolOutcomeMappingType.EXACT,
        confidence: 0.95,
        rationale: 'E2E evidence-backed mapping proposal.',
        proposedByType: MappingProposerType.HUMAN,
      },
      actorA,
    );
    expect(mapping.status).toBe(SchoolOutcomeMappingStatus.PROPOSED);

    const approved = await curriculum.reviewSchoolOutcomeMapping(
      mapping.id,
      {
        status: SchoolOutcomeMappingStatus.APPROVED,
        rationale: 'Reviewed by school curriculum owner in E2E.',
      },
      actorA,
    );
    expect(approved.status).toBe(SchoolOutcomeMappingStatus.APPROVED);

    await prisma.outcomeAspect.update({
      where: { id: aspectId },
      data: { reviewVersion: { increment: 1 } },
    });
    const stale = await curriculum.refreshStaleMappings(actorA);
    expect(stale.staleIds).toContain(mapping.id);

    const persisted = await prisma.schoolOutcomeMapping.findUniqueOrThrow({
      where: { id: mapping.id },
    });
    expect(persisted.status).toBe(SchoolOutcomeMappingStatus.STALE);
  });
});
