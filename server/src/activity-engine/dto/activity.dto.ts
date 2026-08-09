import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ActivityCurriculumMappingStatus,
  ActivityCurriculumMappingType,
  ActivityDeliveryMode,
  MappingProposerType,
} from '@prisma/client';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(160)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;
}

export class CreateActivityVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  engineKey!: string;

  @IsInt()
  @Min(1)
  schemaVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ActivityDeliveryMode, { each: true })
  supportedModes!: ActivityDeliveryMode[];

  @IsEnum(ActivityDeliveryMode)
  recommendedMode!: ActivityDeliveryMode;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  interactionPrimitives!: string[];

  @IsObject()
  config!: Record<string, unknown>;

  @IsObject()
  capabilityRequirements!: Record<string, unknown>;

  @IsObject()
  assetManifest!: Record<string, unknown>;

  @IsObject()
  accessibilityPlan!: Record<string, unknown>;

  @IsObject()
  hardwareRequirements!: Record<string, unknown>;

  @IsObject()
  modePolicy!: Record<string, unknown>;

  @IsObject()
  privacyPlan!: Record<string, unknown>;

  @IsObject()
  safetyPlan!: Record<string, unknown>;

  @IsObject()
  offlinePolicy!: Record<string, unknown>;

  @IsObject()
  evidencePlan!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  prerequisites?: Record<string, unknown>;
}

export class ProposeActivityCurriculumMappingDto {
  @IsUUID()
  frameworkOutcomeId!: string;

  @IsOptional()
  @IsUUID()
  outcomeAspectId?: string;

  @IsEnum(ActivityCurriculumMappingType)
  mappingType!: ActivityCurriculumMappingType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  rationale!: string;

  @IsOptional()
  @IsEnum(MappingProposerType)
  proposedByType?: MappingProposerType;
}

export class ReviewActivityCurriculumMappingDto {
  @IsEnum(ActivityCurriculumMappingStatus)
  @IsIn([
    ActivityCurriculumMappingStatus.APPROVED,
    ActivityCurriculumMappingStatus.REJECTED,
  ])
  status!: ActivityCurriculumMappingStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  rationale!: string;
}
