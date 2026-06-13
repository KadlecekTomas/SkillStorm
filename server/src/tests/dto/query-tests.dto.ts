// src/tests/dto/query-tests.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PublishStatus, SchoolGrade } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

const optionalTrimmed = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalTrimmedGrade = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'ALL') return undefined;
  return trimmed;
};

export class QueryTestsDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'zlomky' })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({ example: 'uuid' })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Filter by Subject UUID' })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Filter by AcademicYear UUID' })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({
    description: 'Filter by pedagogical grade',
    enum: SchoolGrade,
  })
  @IsOptional()
  @Transform(optionalTrimmedGrade)
  @IsEnum(SchoolGrade)
  grade?: SchoolGrade;
}
