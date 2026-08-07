import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProgressEntryType } from '../progress.types';

export class CreateProgressEntryDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  competencyId?: string;

  @IsOptional()
  @IsEnum(ProgressEntryType)
  type?: ProgressEntryType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  gradeValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  competencyLevel?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientMutationId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class SyncProgressEntriesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProgressEntryDto)
  entries!: CreateProgressEntryDto[];
}
