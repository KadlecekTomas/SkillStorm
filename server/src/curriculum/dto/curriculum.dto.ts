import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  MappingProposerType,
  SchoolCurriculumSourceType,
  SchoolGrade,
  SchoolOutcomeMappingStatus,
  SchoolOutcomeMappingType,
} from '@prisma/client';

export class CreateCurriculumFrameworkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  jurisdiction!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  educationType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  authorityName!: string;
}

export class OutcomeAspectImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsBoolean()
  requiredForFullCoverage?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  reviewVersion?: number;
}

export class FrameworkOutcomeImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  externalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(13)
  nodeGrade?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceAnchor?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutcomeAspectImportDto)
  aspects?: OutcomeAspectImportDto[];
}

export class FrameworkFieldImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  externalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FrameworkOutcomeImportDto)
  outcomes!: FrameworkOutcomeImportDto[];
}

export class FrameworkAreaImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  externalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FrameworkFieldImportDto)
  fields!: FrameworkFieldImportDto[];
}

export class FrameworkReleaseImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  releaseCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  sourceUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sourceAuthority!: string;

  @IsOptional()
  @IsISO8601()
  sourcePublishedAt?: string;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsObject()
  sourceMetadata?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FrameworkAreaImportDto)
  areas!: FrameworkAreaImportDto[];
}

export class CreateSchoolCurriculumProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;
}

export class SchoolOutcomeImportDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  externalCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsArray()
  @IsEnum(SchoolGrade, { each: true })
  grades!: SchoolGrade[];

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceAnchor?: string;
}

export class SchoolSubjectImportDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortTitle?: string;

  @IsArray()
  @IsEnum(SchoolGrade, { each: true })
  grades!: SchoolGrade[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolOutcomeImportDto)
  outcomes!: SchoolOutcomeImportDto[];
}

export class CreateSchoolCurriculumVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  versionLabel!: string;

  @IsEnum(SchoolCurriculumSourceType)
  sourceType!: SchoolCurriculumSourceType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceDocumentName?: string;

  @IsOptional()
  @IsISO8601()
  sourceImportedAt?: string;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SchoolSubjectImportDto)
  subjects!: SchoolSubjectImportDto[];
}

export class CreateCurriculumApplicabilityDto {
  @IsUUID()
  schoolCurriculumVersionId!: string;

  @IsUUID()
  frameworkReleaseId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsOptional()
  @IsEnum(SchoolGrade)
  grade?: SchoolGrade;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;
}

export class ResolveCurriculumApplicabilityDto {
  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  classSectionId!: string;
}

export class ProposeSchoolOutcomeMappingDto {
  @IsUUID()
  schoolOutcomeId!: string;

  @IsUUID()
  frameworkOutcomeId!: string;

  @IsOptional()
  @IsUUID()
  outcomeAspectId?: string;

  @IsEnum(SchoolOutcomeMappingType)
  mappingType!: SchoolOutcomeMappingType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  rationale!: string;

  @IsOptional()
  @IsEnum(MappingProposerType)
  proposedByType?: MappingProposerType;
}

export class ReviewSchoolOutcomeMappingDto {
  @IsEnum(SchoolOutcomeMappingStatus)
  @IsIn([
    SchoolOutcomeMappingStatus.REVIEWED,
    SchoolOutcomeMappingStatus.APPROVED,
    SchoolOutcomeMappingStatus.REJECTED,
  ])
  status!: SchoolOutcomeMappingStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  rationale!: string;
}
