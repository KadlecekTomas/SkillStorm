// src/modules/subjects/dto/query-subjects.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SchoolGrade } from '@prisma/client';

export class QuerySubjectsDto {
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

  @ApiPropertyOptional({ example: 'mat' })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  includeLevels?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'When true, includes inactive subjects. Default: false (active only).',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean;

  @ApiPropertyOptional({
    enum: SchoolGrade,
    example: 'GRADE_5',
    description: 'Filter to subjects with an enabled SubjectLevel for the given grade.',
  })
  @IsOptional()
  @IsEnum(SchoolGrade)
  grade?: SchoolGrade;
}
