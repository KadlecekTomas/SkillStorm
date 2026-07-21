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
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GuardianLaunchPolicy } from '@prisma/client';

export class CreateAssignmentDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  academicYearId?: string;

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

  @IsOptional()
  @IsUUID()
  createdById?: string;

  /**
   * Guardian Etapa C: smí rodič zadání spustit pro dítě? Default DISABLED
   * (konzervativní princip 4) — „domácí úkol" povoluje učitel explicitně.
   */
  @IsOptional()
  @IsEnum(GuardianLaunchPolicy)
  guardianLaunchPolicy?: GuardianLaunchPolicy;
}
