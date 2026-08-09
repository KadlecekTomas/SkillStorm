import {
  LiveAgeMode,
  LiveSessionCommandType,
  LiveSessionMode,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { LIVE_SEMANTIC_EVENT_TYPES } from '../classroom-orchestration.constants';
import { IsIn } from 'class-validator';

export class CreateLessonLiveSessionDto {
  @IsUUID()
  lessonExperienceVersionId!: string;

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsEnum(LiveSessionMode)
  mode!: LiveSessionMode;

  @IsOptional()
  @IsEnum(LiveAgeMode)
  ageMode?: LiveAgeMode;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  countdownSec?: number;
}

export class ClassroomCommandDto {
  @IsString()
  @Length(8, 100)
  commandId!: string;

  @IsEnum(LiveSessionCommandType)
  type!: LiveSessionCommandType;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}

export class JoinClassroomSessionDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nickname?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class CreateSessionGroupsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  labels!: string[];
}

export class SemanticEventDto {
  @IsString()
  @Length(8, 100)
  eventId!: string;

  @IsUUID()
  stageId!: string;

  @IsString()
  @IsIn(LIVE_SEMANTIC_EVENT_TYPES)
  eventType!: (typeof LIVE_SEMANTIC_EVENT_TYPES)[number];

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsISO8601()
  occurredAt!: string;
}
