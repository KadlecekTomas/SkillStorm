import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditEntityType,
  CurriculumApplicabilityStatus,
  CurriculumFrameworkReleaseStatus,
  MappingProposerType,
  OrganizationRole,
  OutcomeAspectStatus,
  Prisma,
  SchoolCurriculumProfileStatus,
  SchoolCurriculumVersionStatus,
  SchoolOutcomeMappingStatus,
  SystemRole,
} from '@prisma/client';
import { AuditService } from '@/audit/audit.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AmbiguousCurriculumApplicabilityError,
  curriculumChecksum,
  diffFrameworkOutcomes,
  pickCurriculumApplicability,
  type FrameworkOutcomeComparable,
  type JsonLike,
} from './curriculum-domain';
import type {
  CreateCurriculumApplicabilityDto,
  CreateCurriculumFrameworkDto,
  CreateSchoolCurriculumProfileDto,
  CreateSchoolCurriculumVersionDto,
  FrameworkReleaseImportDto,
  ProposeSchoolOutcomeMappingDto,
  ResolveCurriculumApplicabilityDto,
  ReviewSchoolOutcomeMappingDto,
} from './dto/curriculum.dto';

const asJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

function optionalDate(value?: string): Date | null {
  return value ? new Date(value) : null;
}

function activeRole(actor: JwtPayload): OrganizationRole | undefined {
  return actor.activeRole ?? actor.organizationRole;
}

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // D1.1 — platform-global curriculum framework releases
  // ---------------------------------------------------------------------------

  listFrameworks() {
    return this.prisma.curriculumFramework.findMany({
      orderBy: { code: 'asc' },
      include: {
        releases: {
          orderBy: [{ importedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            releaseCode: true,
            title: true,
            status: true,
            sourceAuthority: true,
            sourceUrl: true,
            sourcePublishedAt: true,
            effectiveFrom: true,
            effectiveTo: true,
            sourceChecksum: true,
            importedAt: true,
            verifiedAt: true,
          },
        },
      },
    });
  }

  async createFramework(dto: CreateCurriculumFrameworkDto, actor: JwtPayload) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.curriculumFramework.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException({
        code: 'CURRICULUM_FRAMEWORK_EXISTS',
        message: `Framework ${code} už existuje.`,
      });
    }

    const framework = await this.prisma.curriculumFramework.create({
      data: {
        code,
        jurisdiction: dto.jurisdiction.trim().toUpperCase(),
        educationType: dto.educationType.trim().toUpperCase(),
        title: dto.title.trim(),
        authorityName: dto.authorityName.trim(),
      },
    });

    await this.audit.log({
      action: 'CURRICULUM_FRAMEWORK_CREATED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: framework.id,
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({ frameworkCode: framework.code }),
    });

    return framework;
  }

  async dryRunFrameworkImport(code: string, dto: FrameworkReleaseImportDto) {
    const framework = await this.requireFrameworkByCode(code);
    this.validateFrameworkImport(dto);

    const canonicalPayload = this.frameworkCanonicalPayload(dto);
    const sourceChecksum = curriculumChecksum(canonicalPayload);
    const nextOutcomes = this.flattenImportOutcomes(dto);

    const previousRelease = await this.prisma.curriculumFrameworkRelease.findFirst({
      where: {
        frameworkId: framework.id,
        status: {
          in: [
            CurriculumFrameworkReleaseStatus.VERIFIED,
            CurriculumFrameworkReleaseStatus.SUPERSEDED,
          ],
        },
      },
      orderBy: [{ verifiedAt: 'desc' }, { importedAt: 'desc' }],
      include: {
        outcomes: {
          include: { field: { select: { externalCode: true } } },
        },
      },
    });

    const previousOutcomes: FrameworkOutcomeComparable[] =
      previousRelease?.outcomes.map((outcome) => ({
        externalCode: outcome.externalCode,
        sourceAnchor: outcome.sourceAnchor,
        fieldExternalCode: outcome.field.externalCode,
        title: outcome.title,
        description: outcome.description,
        metadata: (outcome.metadata ?? null) as JsonLike,
        checksum: outcome.checksum,
      })) ?? [];

    const diff = diffFrameworkOutcomes(previousOutcomes, nextOutcomes);
    const duplicate = await this.prisma.curriculumFrameworkRelease.findFirst({
      where: { frameworkId: framework.id, sourceChecksum },
      select: { id: true, releaseCode: true, status: true },
    });

    return {
      framework: { id: framework.id, code: framework.code },
      releaseCode: dto.releaseCode,
      sourceChecksum,
      previousRelease: previousRelease
        ? {
            id: previousRelease.id,
            releaseCode: previousRelease.releaseCode,
            sourceChecksum: previousRelease.sourceChecksum,
            status: previousRelease.status,
          }
        : null,
      duplicate,
      summary: {
        areas: dto.areas.length,
        fields: dto.areas.reduce((sum, area) => sum + area.fields.length, 0),
        outcomes: nextOutcomes.length,
        aspects: dto.areas.reduce(
          (sum, area) =>
            sum +
            area.fields.reduce(
              (fieldSum, field) =>
                fieldSum +
                field.outcomes.reduce(
                  (outcomeSum, outcome) =>
                    outcomeSum + (outcome.aspects?.length ?? 0),
                  0,
                ),
              0,
            ),
          0,
        ),
        changes: diff.length,
      },
      diff,
    };
  }

  async importFrameworkRelease(
    code: string,
    dto: FrameworkReleaseImportDto,
    actor: JwtPayload,
  ) {
    const framework = await this.requireFrameworkByCode(code);
    this.validateFrameworkImport(dto);
    const sourceChecksum = curriculumChecksum(this.frameworkCanonicalPayload(dto));

    const [sameCode, sameChecksum] = await Promise.all([
      this.prisma.curriculumFrameworkRelease.findUnique({
        where: {
          frameworkId_releaseCode: {
            frameworkId: framework.id,
            releaseCode: dto.releaseCode,
          },
        },
        select: { id: true },
      }),
      this.prisma.curriculumFrameworkRelease.findUnique({
        where: {
          frameworkId_sourceChecksum: {
            frameworkId: framework.id,
            sourceChecksum,
          },
        },
        select: { id: true, releaseCode: true },
      }),
    ]);

    if (sameCode) {
      throw new ConflictException({
        code: 'CURRICULUM_RELEASE_CODE_EXISTS',
        message: `Release ${dto.releaseCode} už pro framework ${framework.code} existuje.`,
      });
    }
    if (sameChecksum) {
      throw new ConflictException({
        code: 'CURRICULUM_RELEASE_DUPLICATE_SOURCE',
        message: `Stejný source snapshot už je uložen jako ${sameChecksum.releaseCode}.`,
      });
    }

    const release = await this.prisma.$transaction(async (tx) => {
      const created = await tx.curriculumFrameworkRelease.create({
        data: {
          frameworkId: framework.id,
          releaseCode: dto.releaseCode.trim(),
          title: dto.title.trim(),
          sourceUrl: dto.sourceUrl,
          sourceAuthority: dto.sourceAuthority.trim(),
          sourcePublishedAt: optionalDate(dto.sourcePublishedAt),
          effectiveFrom: optionalDate(dto.effectiveFrom),
          effectiveTo: optionalDate(dto.effectiveTo),
          sourceChecksum,
          ...(dto.sourceMetadata
            ? { sourceMetadata: asJson(dto.sourceMetadata) }
            : {}),
          status: CurriculumFrameworkReleaseStatus.IMPORTED,
        },
      });

      for (const areaDto of dto.areas) {
        const area = await tx.frameworkArea.create({
          data: {
            frameworkReleaseId: created.id,
            externalCode: areaDto.externalCode.trim(),
            title: areaDto.title.trim(),
            description: areaDto.description?.trim() ?? null,
            sortOrder: areaDto.sortOrder,
          },
        });

        for (const fieldDto of areaDto.fields) {
          const field = await tx.frameworkField.create({
            data: {
              frameworkReleaseId: created.id,
              areaId: area.id,
              externalCode: fieldDto.externalCode.trim(),
              title: fieldDto.title.trim(),
              description: fieldDto.description?.trim() ?? null,
              sortOrder: fieldDto.sortOrder,
            },
          });

          for (const outcomeDto of fieldDto.outcomes) {
            const checksum = this.frameworkOutcomeChecksum(
              fieldDto.externalCode,
              outcomeDto,
            );
            const outcome = await tx.frameworkOutcome.create({
              data: {
                frameworkReleaseId: created.id,
                fieldId: field.id,
                externalCode: outcomeDto.externalCode.trim(),
                title: outcomeDto.title.trim(),
                description: outcomeDto.description?.trim() ?? null,
                nodeGrade: outcomeDto.nodeGrade ?? null,
                ...(outcomeDto.metadata
                  ? { metadata: asJson(outcomeDto.metadata) }
                  : {}),
                sourceAnchor: outcomeDto.sourceAnchor?.trim() ?? null,
                checksum,
              },
            });

            if (outcomeDto.aspects?.length) {
              await tx.outcomeAspect.createMany({
                data: outcomeDto.aspects.map((aspect) => ({
                  frameworkOutcomeId: outcome.id,
                  code: aspect.code.trim(),
                  title: aspect.title.trim(),
                  description: aspect.description.trim(),
                  requiredForFullCoverage:
                    aspect.requiredForFullCoverage ?? true,
                  reviewVersion: aspect.reviewVersion ?? 1,
                })),
              });
            }
          }
        }
      }

      return tx.curriculumFrameworkRelease.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          areas: { orderBy: { sortOrder: 'asc' } },
          fields: { orderBy: { sortOrder: 'asc' } },
          outcomes: { include: { aspects: true } },
        },
      });
    });

    await this.audit.log({
      action: 'CURRICULUM_FRAMEWORK_RELEASE_IMPORTED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: release.id,
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({
        frameworkCode: framework.code,
        releaseCode: release.releaseCode,
        sourceChecksum,
      }),
    });

    return release;
  }

  async verifyFrameworkRelease(releaseId: string, actor: JwtPayload) {
    const release = await this.prisma.curriculumFrameworkRelease.findUnique({
      where: { id: releaseId },
      include: {
        _count: { select: { areas: true, fields: true, outcomes: true } },
      },
    });
    if (!release) throw new NotFoundException('Curriculum release nenalezen.');
    if (release.status !== CurriculumFrameworkReleaseStatus.IMPORTED) {
      throw new ConflictException({
        code: 'CURRICULUM_RELEASE_NOT_IMPORTABLE',
        message: 'Ověřit lze pouze release ve stavu IMPORTED.',
      });
    }
    if (
      release._count.areas < 1 ||
      release._count.fields < 1 ||
      release._count.outcomes < 1
    ) {
      throw new ConflictException({
        code: 'CURRICULUM_RELEASE_INCOMPLETE',
        message: 'Release neobsahuje kompletní area/field/outcome strukturu.',
      });
    }

    const verified = await this.prisma.curriculumFrameworkRelease.update({
      where: { id: release.id },
      data: {
        status: CurriculumFrameworkReleaseStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedBy: actor.userId,
      },
    });

    await this.audit.log({
      action: 'CURRICULUM_FRAMEWORK_RELEASE_VERIFIED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: verified.id,
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
      metadata: asJson({ sourceChecksum: verified.sourceChecksum }),
    });

    return verified;
  }

  async supersedeFrameworkRelease(releaseId: string, actor: JwtPayload) {
    const release = await this.prisma.curriculumFrameworkRelease.findUnique({
      where: { id: releaseId },
    });
    if (!release) throw new NotFoundException('Curriculum release nenalezen.');
    if (release.status !== CurriculumFrameworkReleaseStatus.VERIFIED) {
      throw new ConflictException({
        code: 'CURRICULUM_RELEASE_NOT_VERIFIED',
        message: 'Supersede lze provést pouze nad VERIFIED release.',
      });
    }

    const result = await this.prisma.curriculumFrameworkRelease.update({
      where: { id: releaseId },
      data: { status: CurriculumFrameworkReleaseStatus.SUPERSEDED },
    });

    await this.audit.log({
      action: 'CURRICULUM_FRAMEWORK_RELEASE_SUPERSEDED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: releaseId,
      userId: actor.userId,
      systemRole: actor.systemRole ?? null,
    });
    return result;
  }

  getFrameworkRelease(releaseId: string) {
    return this.prisma.curriculumFrameworkRelease.findUniqueOrThrow({
      where: { id: releaseId },
      include: {
        framework: true,
        areas: { orderBy: { sortOrder: 'asc' } },
        fields: { orderBy: { sortOrder: 'asc' } },
        outcomes: {
          orderBy: { externalCode: 'asc' },
          include: { aspects: { orderBy: { code: 'asc' } } },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // D1.2 — school-local ŠVP versioning + applicability
  // ---------------------------------------------------------------------------

  async listSchoolProfiles(actor: JwtPayload) {
    const organizationId = this.requireActorOrganization(actor);
    return this.prisma.schoolCurriculumProfile.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            versionLabel: true,
            sourceType: true,
            status: true,
            sourceChecksum: true,
            validFrom: true,
            validTo: true,
            publishedAt: true,
          },
        },
      },
    });
  }

  async createSchoolProfile(
    dto: CreateSchoolCurriculumProfileDto,
    actor: JwtPayload,
  ) {
    const organizationId = this.requireActorOrganization(actor);
    const profile = await this.prisma.schoolCurriculumProfile.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        status: SchoolCurriculumProfileStatus.ACTIVE,
      },
    });
    await this.audit.log({
      action: 'SCHOOL_CURRICULUM_PROFILE_CREATED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: profile.id,
      userId: actor.userId,
      organizationId,
    });
    return profile;
  }

  async createSchoolCurriculumVersion(
    profileId: string,
    dto: CreateSchoolCurriculumVersionDto,
    actor: JwtPayload,
  ) {
    const organizationId = this.requireActorOrganization(actor);
    const profile = await this.requireSchoolProfile(profileId, organizationId);
    if (profile.status !== SchoolCurriculumProfileStatus.ACTIVE) {
      throw new ConflictException('Archivovaný curriculum profil nelze upravovat.');
    }
    this.validateDateWindow(dto.validFrom, dto.validTo);
    this.validateSchoolVersionPayload(dto);

    const sourceChecksum = curriculumChecksum(
      this.schoolCurriculumCanonicalPayload(dto),
    );
    const duplicate = await this.prisma.schoolCurriculumVersion.findFirst({
      where: { profileId, sourceChecksum, deletedAt: null },
      select: { id: true, versionLabel: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'SCHOOL_CURRICULUM_DUPLICATE_SOURCE',
        message: `Stejný snapshot už existuje jako ${duplicate.versionLabel}.`,
      });
    }

    const version = await this.prisma.$transaction(async (tx) => {
      const created = await tx.schoolCurriculumVersion.create({
        data: {
          profileId,
          versionLabel: dto.versionLabel.trim(),
          sourceType: dto.sourceType,
          sourceFileId: dto.sourceFileId?.trim() ?? null,
          sourceChecksum,
          sourceDocumentName: dto.sourceDocumentName?.trim() ?? null,
          sourceImportedAt: optionalDate(dto.sourceImportedAt) ?? new Date(),
          validFrom: optionalDate(dto.validFrom),
          validTo: optionalDate(dto.validTo),
          status: SchoolCurriculumVersionStatus.DRAFT,
        },
      });

      for (const subjectDto of dto.subjects) {
        const subject = await tx.schoolSubject.create({
          data: {
            schoolCurriculumVersionId: created.id,
            code: subjectDto.code?.trim() ?? null,
            title: subjectDto.title.trim(),
            shortTitle: subjectDto.shortTitle?.trim() ?? null,
            gradeScope: asJson([...new Set(subjectDto.grades)].sort()),
            ...(subjectDto.metadata
              ? { metadata: asJson(subjectDto.metadata) }
              : {}),
          },
        });

        for (const outcomeDto of subjectDto.outcomes) {
          await tx.schoolOutcome.create({
            data: {
              schoolCurriculumVersionId: created.id,
              schoolSubjectId: subject.id,
              externalCode: outcomeDto.externalCode?.trim() ?? null,
              title: outcomeDto.title.trim(),
              description: outcomeDto.description?.trim() ?? null,
              gradeScope: asJson([...new Set(outcomeDto.grades)].sort()),
              orderIndex: outcomeDto.orderIndex ?? null,
              ...(outcomeDto.metadata
                ? { metadata: asJson(outcomeDto.metadata) }
                : {}),
              sourceAnchor: outcomeDto.sourceAnchor?.trim() ?? null,
              checksum: this.schoolOutcomeChecksum(outcomeDto),
            },
          });
        }
      }

      return tx.schoolCurriculumVersion.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          profile: true,
          subjects: {
            orderBy: { title: 'asc' },
            include: { outcomes: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      });
    });

    await this.audit.log({
      action: 'SCHOOL_CURRICULUM_VERSION_CREATED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: version.id,
      userId: actor.userId,
      organizationId,
      metadata: asJson({
        profileId,
        sourceChecksum,
      }),
    });
    return version;
  }

  async publishSchoolCurriculumVersion(versionId: string, actor: JwtPayload) {
    const organizationId = this.requireActorOrganization(actor);
    const version = await this.prisma.schoolCurriculumVersion.findFirst({
      where: { id: versionId, profile: { organizationId, deletedAt: null } },
      include: {
        _count: { select: { subjects: true, outcomes: true } },
      },
    });
    if (!version) throw new NotFoundException('ŠVP verze nenalezena.');
    if (
      version.status !== SchoolCurriculumVersionStatus.DRAFT &&
      version.status !== SchoolCurriculumVersionStatus.REVIEW
    ) {
      throw new ConflictException({
        code: 'SCHOOL_CURRICULUM_VERSION_NOT_PUBLISHABLE',
        message: 'Publikovat lze pouze DRAFT nebo REVIEW verzi.',
      });
    }
    if (version._count.subjects < 1 || version._count.outcomes < 1) {
      throw new ConflictException({
        code: 'SCHOOL_CURRICULUM_VERSION_INCOMPLETE',
        message: 'Publikovaná ŠVP verze musí obsahovat předměty i outcomes.',
      });
    }

    const published = await this.prisma.schoolCurriculumVersion.update({
      where: { id: versionId },
      data: {
        status: SchoolCurriculumVersionStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: actor.userId,
      },
    });

    await this.audit.log({
      action: 'SCHOOL_CURRICULUM_VERSION_PUBLISHED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: versionId,
      userId: actor.userId,
      organizationId,
      metadata: asJson({ sourceChecksum: published.sourceChecksum }),
    });
    return published;
  }

  async retireSchoolCurriculumVersion(versionId: string, actor: JwtPayload) {
    const organizationId = this.requireActorOrganization(actor);
    const version = await this.prisma.schoolCurriculumVersion.findFirst({
      where: { id: versionId, profile: { organizationId } },
    });
    if (!version) throw new NotFoundException('ŠVP verze nenalezena.');
    if (version.status !== SchoolCurriculumVersionStatus.PUBLISHED) {
      throw new ConflictException('Retire lze pouze PUBLISHED ŠVP verzi.');
    }
    const result = await this.prisma.schoolCurriculumVersion.update({
      where: { id: versionId },
      data: { status: SchoolCurriculumVersionStatus.RETIRED },
    });
    await this.audit.log({
      action: 'SCHOOL_CURRICULUM_VERSION_RETIRED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: versionId,
      userId: actor.userId,
      organizationId,
    });
    return result;
  }

  async getSchoolCurriculumVersion(versionId: string, actor: JwtPayload) {
    const organizationId = this.requireActorOrganization(actor);
    const version = await this.prisma.schoolCurriculumVersion.findFirst({
      where: { id: versionId, profile: { organizationId, deletedAt: null } },
      include: {
        profile: true,
        subjects: {
          orderBy: { title: 'asc' },
          include: {
            outcomes: {
              orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
              include: {
                mappings: {
                  include: {
                    frameworkOutcome: {
                      include: { field: true, release: true },
                    },
                    outcomeAspect: true,
                  },
                },
              },
            },
          },
        },
        applicabilities: {
          orderBy: [{ academicYearId: 'desc' }, { priority: 'desc' }],
        },
      },
    });
    if (!version) throw new NotFoundException('ŠVP verze nenalezena.');
    return version;
  }

  async createApplicability(
    dto: CreateCurriculumApplicabilityDto,
    actor: JwtPayload,
  ) {
    const organizationId = this.requireActorOrganization(actor);
    if (dto.grade && dto.classSectionId) {
      throw new BadRequestException({
        code: 'CURRICULUM_APPLICABILITY_SCOPE_INVALID',
        message: 'Applicability používá buď classSectionId, nebo grade, ne obojí.',
      });
    }
    this.validateDateWindow(dto.validFrom, dto.validTo);

    const [version, release, year, classSection] = await Promise.all([
      this.prisma.schoolCurriculumVersion.findFirst({
        where: {
          id: dto.schoolCurriculumVersionId,
          profile: { organizationId, deletedAt: null },
        },
        include: { profile: true },
      }),
      this.prisma.curriculumFrameworkRelease.findUnique({
        where: { id: dto.frameworkReleaseId },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, orgId: organizationId, deletedAt: null },
      }),
      dto.classSectionId
        ? this.prisma.classSection.findFirst({
            where: { id: dto.classSectionId, orgId: organizationId },
          })
        : Promise.resolve(null),
    ]);

    if (!version) throw new NotFoundException('ŠVP verze v organizaci nenalezena.');
    if (version.status !== SchoolCurriculumVersionStatus.PUBLISHED) {
      throw new ConflictException({
        code: 'CURRICULUM_APPLICABILITY_VERSION_NOT_PUBLISHED',
        message: 'Applicability může odkazovat pouze na PUBLISHED ŠVP verzi.',
      });
    }
    if (!release) throw new NotFoundException('Framework release nenalezen.');
    if (release.status !== CurriculumFrameworkReleaseStatus.VERIFIED) {
      throw new ConflictException({
        code: 'CURRICULUM_APPLICABILITY_RELEASE_NOT_VERIFIED',
        message: 'Nová applicability může odkazovat pouze na VERIFIED framework release.',
      });
    }
    if (!year) throw new NotFoundException('Školní rok v organizaci nenalezen.');
    if (dto.classSectionId && !classSection) {
      throw new NotFoundException('Třída v organizaci nenalezena.');
    }
    if (classSection && classSection.yearId !== year.id) {
      throw new BadRequestException({
        code: 'CURRICULUM_APPLICABILITY_CLASS_YEAR_MISMATCH',
        message: 'Třída nepatří do zvoleného školního roku.',
      });
    }

    const priority = dto.priority ?? 0;
    const conflicting = await this.prisma.curriculumApplicability.findFirst({
      where: {
        organizationId,
        academicYearId: year.id,
        status: CurriculumApplicabilityStatus.ACTIVE,
        classSectionId: dto.classSectionId ?? null,
        grade: dto.classSectionId ? null : (dto.grade ?? null),
        priority,
      },
      select: { id: true },
    });
    if (conflicting) {
      throw new ConflictException({
        code: 'CURRICULUM_APPLICABILITY_CONFLICT',
        message: 'Pro stejný scope a prioritu už existuje aktivní applicability.',
      });
    }

    const applicability = await this.prisma.curriculumApplicability.create({
      data: {
        organizationId,
        schoolCurriculumVersionId: version.id,
        frameworkReleaseId: release.id,
        academicYearId: year.id,
        grade: dto.classSectionId ? null : (dto.grade ?? null),
        classSectionId: dto.classSectionId ?? null,
        validFrom: optionalDate(dto.validFrom),
        validTo: optionalDate(dto.validTo),
        priority,
        status: CurriculumApplicabilityStatus.ACTIVE,
      },
      include: {
        schoolCurriculumVersion: true,
        frameworkRelease: true,
      },
    });

    await this.audit.log({
      action: 'CURRICULUM_APPLICABILITY_CREATED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: applicability.id,
      userId: actor.userId,
      organizationId,
      metadata: asJson({
        academicYearId: year.id,
        grade: applicability.grade,
        classSectionId: applicability.classSectionId,
        priority,
        schoolCurriculumVersionId: version.id,
        frameworkReleaseId: release.id,
      }),
    });
    return applicability;
  }

  async retireApplicability(applicabilityId: string, actor: JwtPayload) {
    const organizationId = this.requireActorOrganization(actor);
    const existing = await this.prisma.curriculumApplicability.findFirst({
      where: { id: applicabilityId, organizationId },
    });
    if (!existing) throw new NotFoundException('Applicability nenalezena.');
    const result = await this.prisma.curriculumApplicability.update({
      where: { id: applicabilityId },
      data: { status: CurriculumApplicabilityStatus.RETIRED },
    });
    await this.audit.log({
      action: 'CURRICULUM_APPLICABILITY_RETIRED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: applicabilityId,
      userId: actor.userId,
      organizationId,
    });
    return result;
  }

  async resolveApplicability(
    query: ResolveCurriculumApplicabilityDto,
    actor: JwtPayload,
  ) {
    const organizationId = this.requireActorOrganization(actor);
    const [academicYear, classSection] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: {
          id: query.academicYearId,
          orgId: organizationId,
          deletedAt: null,
        },
        select: { id: true, startsAt: true, endsAt: true, isCurrent: true },
      }),
      this.prisma.classSection.findFirst({
        where: {
          id: query.classSectionId,
          yearId: query.academicYearId,
          orgId: organizationId,
        },
        select: { id: true, grade: true, yearId: true },
      }),
    ]);
    if (!academicYear || !classSection) {
      throw new NotFoundException('Třída pro zvolený školní rok nenalezena.');
    }

    const now = new Date();
    const requestedAsOf = query.asOf ? new Date(query.asOf) : null;
    if (
      requestedAsOf &&
      (requestedAsOf < academicYear.startsAt || requestedAsOf > academicYear.endsAt)
    ) {
      throw new BadRequestException({
        code: 'CURRICULUM_RESOLUTION_DATE_OUTSIDE_ACADEMIC_YEAR',
        message: 'asOf musí ležet uvnitř zvoleného školního roku.',
      });
    }

    const resolutionDate =
      requestedAsOf ??
      (now >= academicYear.startsAt && now <= academicYear.endsAt
        ? now
        : now < academicYear.startsAt
          ? academicYear.startsAt
          : academicYear.endsAt);

    const candidates = await this.prisma.curriculumApplicability.findMany({
      where: {
        organizationId,
        academicYearId: query.academicYearId,
        status: CurriculumApplicabilityStatus.ACTIVE,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: resolutionDate } }] },
          { OR: [{ validTo: null }, { validTo: { gte: resolutionDate } }] },
          {
            OR: [
              { classSectionId: classSection.id },
              { classSectionId: null, grade: classSection.grade },
              { classSectionId: null, grade: null },
            ],
          },
        ],
      },
      include: {
        schoolCurriculumVersion: { include: { profile: true } },
        frameworkRelease: { include: { framework: true } },
      },
    });

    try {
      const selected = pickCurriculumApplicability(
        candidates,
        classSection.id,
        classSection.grade,
      );
      if (!selected) {
        throw new NotFoundException({
          code: 'CURRICULUM_APPLICABILITY_MISSING',
          message: 'Pro tuto třídu a školní rok není publikované curriculum nastavené.',
        });
      }
      return {
        classSection,
        applicability: selected,
        resolution: {
          specificity: selected.classSectionId
            ? 'CLASS'
            : selected.grade
              ? 'GRADE'
              : 'SCHOOL_DEFAULT',
          priority: selected.priority,
          asOf: resolutionDate.toISOString(),
          academicYear: {
            startsAt: academicYear.startsAt.toISOString(),
            endsAt: academicYear.endsAt.toISOString(),
            isCurrent: academicYear.isCurrent,
          },
        },
      };
    } catch (error) {
      if (error instanceof AmbiguousCurriculumApplicabilityError) {
        throw new ConflictException({
          code: 'CURRICULUM_APPLICABILITY_AMBIGUOUS',
          message: 'Pro třídu existuje více stejně specifických curriculum pravidel.',
          candidateIds: error.candidateIds,
        });
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // D1.3 — reviewed school outcome ↔ canonical outcome/aspect mapping
  // ---------------------------------------------------------------------------

  async proposeSchoolOutcomeMapping(
    dto: ProposeSchoolOutcomeMappingDto,
    actor: JwtPayload,
  ) {
    const organizationId = this.requireActorOrganization(actor);
    const proposerType = dto.proposedByType ?? MappingProposerType.HUMAN;
    if (
      proposerType !== MappingProposerType.HUMAN &&
      actor.systemRole !== SystemRole.SUPERADMIN &&
      !actor.isPlatformAdmin
    ) {
      throw new ForbiddenException(
        'SYSTEM/AI provenance může zapisovat pouze platformní governance cesta.',
      );
    }

    const schoolOutcome = await this.prisma.schoolOutcome.findFirst({
      where: {
        id: dto.schoolOutcomeId,
        schoolCurriculumVersion: {
          profile: { organizationId, deletedAt: null },
        },
      },
      include: {
        schoolCurriculumVersion: true,
      },
    });
    if (!schoolOutcome) {
      throw new NotFoundException('School outcome v organizaci nenalezen.');
    }
    if (
      schoolOutcome.schoolCurriculumVersion.status !==
      SchoolCurriculumVersionStatus.PUBLISHED
    ) {
      throw new ConflictException({
        code: 'CURRICULUM_MAPPING_SCHOOL_VERSION_NOT_PUBLISHED',
        message: 'Mapping lze navrhnout pouze proti PUBLISHED ŠVP snapshotu.',
      });
    }

    const frameworkOutcome = await this.prisma.frameworkOutcome.findUnique({
      where: { id: dto.frameworkOutcomeId },
      include: { release: true },
    });
    if (!frameworkOutcome) {
      throw new NotFoundException('Framework outcome nenalezen.');
    }
    if (frameworkOutcome.release.status !== CurriculumFrameworkReleaseStatus.VERIFIED) {
      throw new ConflictException(
        'Nový mapping lze navrhnout pouze proti VERIFIED framework release.',
      );
    }

    const aspect = dto.outcomeAspectId
      ? await this.prisma.outcomeAspect.findUnique({
          where: { id: dto.outcomeAspectId },
        })
      : null;
    if (dto.outcomeAspectId && !aspect) {
      throw new NotFoundException('Outcome aspect nenalezen.');
    }
    if (aspect && aspect.frameworkOutcomeId !== frameworkOutcome.id) {
      throw new BadRequestException({
        code: 'CURRICULUM_MAPPING_ASPECT_OUTCOME_MISMATCH',
        message: 'Outcome aspect nepatří ke zvolenému framework outcome.',
      });
    }
    if (aspect && aspect.status !== OutcomeAspectStatus.ACTIVE) {
      throw new ConflictException({
        code: 'CURRICULUM_MAPPING_ASPECT_RETIRED',
        message: 'Nový mapping nelze navrhnout proti RETIRED outcome aspect.',
      });
    }

    const duplicate = await this.prisma.schoolOutcomeMapping.findFirst({
      where: {
        schoolOutcomeId: schoolOutcome.id,
        frameworkOutcomeId: frameworkOutcome.id,
        outcomeAspectId: aspect?.id ?? null,
        status: {
          in: [
            SchoolOutcomeMappingStatus.PROPOSED,
            SchoolOutcomeMappingStatus.REVIEWED,
            SchoolOutcomeMappingStatus.APPROVED,
          ],
        },
      },
      select: { id: true, status: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'CURRICULUM_MAPPING_EXISTS',
        message: `Mapping už existuje ve stavu ${duplicate.status}.`,
        mappingId: duplicate.id,
      });
    }

    const mapping = await this.prisma.schoolOutcomeMapping.create({
      data: {
        schoolOutcomeId: schoolOutcome.id,
        frameworkOutcomeId: frameworkOutcome.id,
        outcomeAspectId: aspect?.id ?? null,
        mappingType: dto.mappingType,
        confidence: dto.confidence ?? null,
        rationale: dto.rationale.trim(),
        status: SchoolOutcomeMappingStatus.PROPOSED,
        proposedByType: proposerType,
        proposedById: actor.userId,
        frameworkReleaseId: frameworkOutcome.frameworkReleaseId,
        schoolCurriculumVersionId: schoolOutcome.schoolCurriculumVersionId,
        schoolOutcomeChecksum: schoolOutcome.checksum,
        frameworkOutcomeChecksum: frameworkOutcome.checksum,
        outcomeAspectReviewVersion: aspect?.reviewVersion ?? null,
      },
      include: {
        schoolOutcome: true,
        frameworkOutcome: true,
        outcomeAspect: true,
      },
    });

    await this.audit.log({
      action: 'CURRICULUM_MAPPING_PROPOSED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: mapping.id,
      userId: actor.userId,
      organizationId,
      metadata: asJson({
        proposedByType: proposerType,
        schoolOutcomeId: mapping.schoolOutcomeId,
        frameworkOutcomeId: mapping.frameworkOutcomeId,
        outcomeAspectId: mapping.outcomeAspectId,
      }),
    });
    return mapping;
  }

  async reviewSchoolOutcomeMapping(
    mappingId: string,
    dto: ReviewSchoolOutcomeMappingDto,
    actor: JwtPayload,
  ) {
    const organizationId = this.requireActorOrganization(actor);
    const mapping = await this.prisma.schoolOutcomeMapping.findFirst({
      where: {
        id: mappingId,
        schoolOutcome: {
          schoolCurriculumVersion: { profile: { organizationId } },
        },
      },
      include: {
        schoolOutcome: true,
        frameworkOutcome: true,
        outcomeAspect: true,
      },
    });
    if (!mapping) throw new NotFoundException('Curriculum mapping nenalezen.');
    if (
      mapping.status === SchoolOutcomeMappingStatus.APPROVED ||
      mapping.status === SchoolOutcomeMappingStatus.REJECTED ||
      mapping.status === SchoolOutcomeMappingStatus.STALE
    ) {
      throw new ConflictException({
        code: 'CURRICULUM_MAPPING_REVIEW_CLOSED',
        message:
          'APPROVED/REJECTED/STALE mapping je historický záznam; pro změnu vytvořte nový návrh.',
      });
    }

    if (this.mappingIsStale(mapping)) {
      await this.prisma.schoolOutcomeMapping.update({
        where: { id: mapping.id },
        data: { status: SchoolOutcomeMappingStatus.STALE },
      });
      throw new ConflictException({
        code: 'CURRICULUM_MAPPING_STALE',
        message: 'Zdroj mappingu se změnil. Mapping byl označen STALE.',
      });
    }

    const reviewed = await this.prisma.schoolOutcomeMapping.update({
      where: { id: mapping.id },
      data: {
        status: dto.status,
        reviewRationale: dto.rationale.trim(),
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
      },
    });

    await this.audit.log({
      action:
        dto.status === SchoolOutcomeMappingStatus.APPROVED
          ? 'CURRICULUM_MAPPING_APPROVED'
          : dto.status === SchoolOutcomeMappingStatus.REJECTED
            ? 'CURRICULUM_MAPPING_REJECTED'
            : 'CURRICULUM_MAPPING_REVIEWED',
      entityType: AuditEntityType.CURRICULUM,
      entityId: mapping.id,
      userId: actor.userId,
      organizationId,
      metadata: asJson({ status: dto.status }),
    });
    return reviewed;
  }

  async refreshStaleMappings(actor: JwtPayload) {
    const organizationId = this.requireActorOrganization(actor);
    const mappings = await this.prisma.schoolOutcomeMapping.findMany({
      where: {
        status: {
          in: [
            SchoolOutcomeMappingStatus.PROPOSED,
            SchoolOutcomeMappingStatus.REVIEWED,
            SchoolOutcomeMappingStatus.APPROVED,
          ],
        },
        schoolOutcome: {
          schoolCurriculumVersion: { profile: { organizationId } },
        },
      },
      include: {
        schoolOutcome: true,
        frameworkOutcome: true,
        outcomeAspect: true,
      },
    });

    const staleIds = mappings
      .filter((mapping) => this.mappingIsStale(mapping))
      .map((mapping) => mapping.id);

    if (staleIds.length > 0) {
      await this.prisma.schoolOutcomeMapping.updateMany({
        where: { id: { in: staleIds } },
        data: { status: SchoolOutcomeMappingStatus.STALE },
      });
      await this.audit.log({
        action: 'CURRICULUM_MAPPING_STALE_REFRESH',
        entityType: AuditEntityType.CURRICULUM,
        userId: actor.userId,
        organizationId,
        metadata: asJson({ count: staleIds.length }),
      });
    }

    return { scanned: mappings.length, stale: staleIds.length, staleIds };
  }

  // ---------------------------------------------------------------------------
  // helpers / invariants
  // ---------------------------------------------------------------------------

  private requireActorOrganization(actor: JwtPayload): string {
    if (!actor.organizationId) {
      throw new BadRequestException({
        code: 'ORGANIZATION_CONTEXT_REQUIRED',
        message: 'Curriculum operace vyžaduje aktivní organizaci.',
      });
    }
    return actor.organizationId;
  }

  private async requireFrameworkByCode(code: string) {
    const framework = await this.prisma.curriculumFramework.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!framework) throw new NotFoundException('Curriculum framework nenalezen.');
    return framework;
  }

  private async requireSchoolProfile(profileId: string, organizationId: string) {
    const profile = await this.prisma.schoolCurriculumProfile.findFirst({
      where: { id: profileId, organizationId, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('Curriculum profil nenalezen.');
    return profile;
  }

  private validateDateWindow(from?: string, to?: string) {
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      throw new BadRequestException('validFrom nesmí být po validTo.');
    }
  }

  private validateFrameworkImport(dto: FrameworkReleaseImportDto) {
    this.validateDateWindow(dto.effectiveFrom, dto.effectiveTo);
    const areaCodes = new Set<string>();
    const fieldCodes = new Set<string>();
    const outcomeCodes = new Set<string>();
    const anchors = new Set<string>();

    for (const area of dto.areas) {
      this.assertUnique(areaCodes, area.externalCode, 'area externalCode');
      for (const field of area.fields) {
        this.assertUnique(fieldCodes, field.externalCode, 'field externalCode');
        for (const outcome of field.outcomes) {
          this.assertUnique(outcomeCodes, outcome.externalCode, 'outcome externalCode');
          if (outcome.sourceAnchor) {
            this.assertUnique(anchors, outcome.sourceAnchor, 'outcome sourceAnchor');
          }
          const aspectCodes = new Set<string>();
          for (const aspect of outcome.aspects ?? []) {
            this.assertUnique(aspectCodes, aspect.code, 'outcome aspect code');
          }
        }
      }
    }
  }

  private validateSchoolVersionPayload(dto: CreateSchoolCurriculumVersionDto) {
    const subjectCodes = new Set<string>();
    const outcomeCodes = new Set<string>();
    for (const subject of dto.subjects) {
      if (subject.code) {
        this.assertUnique(subjectCodes, subject.code, 'school subject code');
      }
      const subjectGrades = new Set(subject.grades);
      for (const outcome of subject.outcomes) {
        if (outcome.externalCode) {
          this.assertUnique(outcomeCodes, outcome.externalCode, 'school outcome code');
        }
        const invalidGrades = outcome.grades.filter(
          (grade) => !subjectGrades.has(grade),
        );
        if (invalidGrades.length > 0) {
          throw new BadRequestException({
            code: 'SCHOOL_CURRICULUM_OUTCOME_GRADE_OUTSIDE_SUBJECT',
            message:
              'School outcome nesmí deklarovat ročník mimo grade scope svého předmětu.',
            invalidGrades,
            subjectCode: subject.code ?? null,
            outcomeCode: outcome.externalCode ?? null,
          });
        }
      }
    }
  }

  private assertUnique(set: Set<string>, raw: string, label: string) {
    const value = raw.trim();
    if (set.has(value)) {
      throw new BadRequestException(`Duplicitní ${label}: ${value}`);
    }
    set.add(value);
  }

  private frameworkCanonicalPayload(dto: FrameworkReleaseImportDto): JsonLike {
    // Content identity is deliberately independent of local release labels,
    // mirrors and import metadata. The same authoritative curriculum structure
    // must deduplicate even when it arrives through another URL/file.
    return {
      areas: [...dto.areas]
        .sort((a, b) => a.externalCode.localeCompare(b.externalCode))
        .map((area) => ({
          externalCode: area.externalCode,
          title: area.title,
          description: area.description ?? null,
          sortOrder: area.sortOrder,
          fields: [...area.fields]
            .sort((a, b) => a.externalCode.localeCompare(b.externalCode))
            .map((field) => ({
              externalCode: field.externalCode,
              title: field.title,
              description: field.description ?? null,
              sortOrder: field.sortOrder,
              outcomes: [...field.outcomes]
                .sort((a, b) => a.externalCode.localeCompare(b.externalCode))
                .map((outcome) => ({
                  externalCode: outcome.externalCode,
                  title: outcome.title,
                  description: outcome.description ?? null,
                  nodeGrade: outcome.nodeGrade ?? null,
                  metadata: (outcome.metadata ?? null) as JsonLike,
                  sourceAnchor: outcome.sourceAnchor ?? null,
                  aspects: [...(outcome.aspects ?? [])]
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((aspect) => ({
                      code: aspect.code,
                      title: aspect.title,
                      description: aspect.description,
                      requiredForFullCoverage:
                        aspect.requiredForFullCoverage ?? true,
                      reviewVersion: aspect.reviewVersion ?? 1,
                    })),
                })),
            })),
        })),
    };
  }

  private flattenImportOutcomes(
    dto: FrameworkReleaseImportDto,
  ): FrameworkOutcomeComparable[] {
    return dto.areas.flatMap((area) =>
      area.fields.flatMap((field) =>
        field.outcomes.map((outcome) => ({
          externalCode: outcome.externalCode,
          sourceAnchor: outcome.sourceAnchor ?? null,
          fieldExternalCode: field.externalCode,
          title: outcome.title,
          description: outcome.description ?? null,
          metadata: (outcome.metadata ?? null) as JsonLike,
          checksum: this.frameworkOutcomeChecksum(field.externalCode, outcome),
        })),
      ),
    );
  }

  private frameworkOutcomeChecksum(
    fieldExternalCode: string,
    outcome: FrameworkReleaseImportDto['areas'][number]['fields'][number]['outcomes'][number],
  ) {
    return curriculumChecksum({
      fieldExternalCode,
      externalCode: outcome.externalCode,
      title: outcome.title,
      description: outcome.description ?? null,
      nodeGrade: outcome.nodeGrade ?? null,
      metadata: (outcome.metadata ?? null) as JsonLike,
      sourceAnchor: outcome.sourceAnchor ?? null,
    });
  }

  private schoolCurriculumCanonicalPayload(
    dto: CreateSchoolCurriculumVersionDto,
  ): JsonLike {
    // Snapshot identity is curriculum content, not the upload filename, local
    // label or validity window. Re-importing the same ŠVP content must be
    // detected as a duplicate rather than creating parallel truth.
    return {
      subjects: [...dto.subjects]
        .sort((a, b) => (a.code ?? a.title).localeCompare(b.code ?? b.title))
        .map((subject) => ({
          code: subject.code ?? null,
          title: subject.title,
          shortTitle: subject.shortTitle ?? null,
          grades: [...new Set(subject.grades)].sort(),
          metadata: (subject.metadata ?? null) as JsonLike,
          outcomes: [...subject.outcomes]
            .sort((a, b) =>
              (a.externalCode ?? a.title).localeCompare(b.externalCode ?? b.title),
            )
            .map((outcome) => ({
              externalCode: outcome.externalCode ?? null,
              title: outcome.title,
              description: outcome.description ?? null,
              grades: [...new Set(outcome.grades)].sort(),
              orderIndex: outcome.orderIndex ?? null,
              metadata: (outcome.metadata ?? null) as JsonLike,
              sourceAnchor: outcome.sourceAnchor ?? null,
            })),
        })),
    };
  }

  private schoolOutcomeChecksum(
    outcome: CreateSchoolCurriculumVersionDto['subjects'][number]['outcomes'][number],
  ) {
    return curriculumChecksum({
      externalCode: outcome.externalCode ?? null,
      title: outcome.title,
      description: outcome.description ?? null,
      grades: [...new Set(outcome.grades)].sort(),
      orderIndex: outcome.orderIndex ?? null,
      metadata: (outcome.metadata ?? null) as JsonLike,
      sourceAnchor: outcome.sourceAnchor ?? null,
    });
  }

  private mappingIsStale(mapping: {
    schoolOutcomeChecksum: string;
    frameworkOutcomeChecksum: string;
    outcomeAspectReviewVersion: number | null;
    schoolOutcome: { checksum: string };
    frameworkOutcome: { checksum: string };
    outcomeAspect: { reviewVersion: number } | null;
  }) {
    return (
      mapping.schoolOutcomeChecksum !== mapping.schoolOutcome.checksum ||
      mapping.frameworkOutcomeChecksum !== mapping.frameworkOutcome.checksum ||
      mapping.outcomeAspectReviewVersion !==
        (mapping.outcomeAspect?.reviewVersion ?? null)
    );
  }

  // Kept explicit for future fine-grained curriculum permissions; today the
  // controller's @Permission metadata defines the role surface.
  actorCanManageSchoolCurriculum(actor: JwtPayload) {
    return (
      actor.systemRole === SystemRole.SUPERADMIN ||
      activeRole(actor) === OrganizationRole.OWNER ||
      activeRole(actor) === OrganizationRole.DIRECTOR
    );
  }
}
