// src/assignments/dto/create-assignment.dto.ts
import {
  IsString,
  IsDate,
  IsInt,
  IsOptional,
  IsBoolean,
  IsUUID,
  Min,
  IsArray,
  ArrayNotEmpty,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  academicYearId!: string;

  @IsUUID()
  testId!: string;

  @IsString()
  targetType!: string; // "CLASS" | "STUDENTS"

  @ValidateIf((o) => o.targetType === 'STUDENTS')
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @IsOptional()
  @IsUUID()
  topicLevelId?: string;

  @Type(() => Date)
  @IsDate()
  openAt!: Date;

  @Type(() => Date)
  @IsDate()
  closeAt!: Date;

  @IsInt()
  @Min(1)
  maxAttempts!: number;

  @IsOptional()
  @IsInt()
  timeLimitSec?: number;

  @IsBoolean()
  shuffle!: boolean;

  @IsString()
  showExplain!: string;

  @IsUUID()
  createdById!: string;
}
