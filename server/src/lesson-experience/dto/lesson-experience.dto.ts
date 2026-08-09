import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ActivityDeliveryMode,
  LessonExperienceCurriculumMappingStatus,
  LessonExperienceCurriculumMappingType,
  LessonStageCompletionType,
  LessonStageType,
  MappingProposerType,
} from '@prisma/client';

export class CreateLessonExperienceDto {
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

export class CreateLessonStageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/)
  @MaxLength(120)
  stageKey!: string;

  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsEnum(LessonStageType)
  stageType!: LessonStageType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  studentPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  teacherGuidance?: string;

  @IsInt()
  @Min(1)
  @Max(120)
  durationMin!: number;

  @IsOptional()
  @IsUUID()
  activityVersionId?: string;

  @IsEnum(LessonStageCompletionType)
  completionType!: LessonStageCompletionType;

  @IsBoolean()
  checkpoint!: boolean;

  @IsBoolean()
  required!: boolean;

  @IsBoolean()
  teacherIntervention!: boolean;
}

export class CreateLessonExperienceVersionDto {
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
  summary?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  learningObjective!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  pedagogicalRationale!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ActivityDeliveryMode, { each: true })
  supportedModes!: ActivityDeliveryMode[];

  @IsEnum(ActivityDeliveryMode)
  recommendedMode!: ActivityDeliveryMode;

  @IsInt()
  @Min(1)
  @Max(240)
  estimatedDurationMin!: number;

  @IsObject()
  teacherPlan!: Record<string, unknown>;

  @IsObject()
  hardwareRequirements!: Record<string, unknown>;

  @IsObject()
  accessibilityPlan!: Record<string, unknown>;

  @IsObject()
  privacyPlan!: Record<string, unknown>;

  @IsObject()
  offlinePolicy!: Record<string, unknown>;

  @IsObject()
  assetManifest!: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => CreateLessonStageDto)
  stages!: CreateLessonStageDto[];
}

export class ProposeLessonCurriculumMappingDto {
  @IsUUID()
  frameworkOutcomeId!: string;

  @IsOptional()
  @IsUUID()
  outcomeAspectId?: string;

  @IsEnum(LessonExperienceCurriculumMappingType)
  mappingType!: LessonExperienceCurriculumMappingType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  rationale!: string;

  @IsOptional()
  @IsEnum(MappingProposerType)
  proposedByType?: MappingProposerType;
}

export class ReviewLessonCurriculumMappingDto {
  @IsEnum(LessonExperienceCurriculumMappingStatus)
  @IsIn([
    LessonExperienceCurriculumMappingStatus.APPROVED,
    LessonExperienceCurriculumMappingStatus.REJECTED,
  ])
  status!: LessonExperienceCurriculumMappingStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  rationale!: string;
}
