import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SchoolGrade } from '@prisma/client';

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

export class QueryClassSectionsDto {
  @ApiProperty({ description: 'Školní rok', example: 'year-uuid' })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID()
  yearId?: string;

  @ApiPropertyOptional({
    description: 'Alias pro yearId',
    example: 'year-uuid',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ enum: SchoolGrade, example: 'PRIMARY_1' })
  @IsOptional()
  @Transform(optionalTrimmedGrade)
  @IsEnum(SchoolGrade)
  grade?: SchoolGrade;

  @ApiPropertyOptional({
    description: 'Fulltext (label/section)',
    example: '1.A',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by teacher',
    example: 'teacher-uuid',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Legacy offset page (deprecated, ignored when cursor is used)',
    example: 1,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor token (base64url)',
    example:
      'eyJncmFkZSI6IkdSQURFXzEiLCJzZWN0aW9uIjoiQSIsImlkIjoidXVpZC0uLi4ifQ',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Cursor direction',
    enum: ['next', 'prev'],
    default: 'next',
  })
  @IsOptional()
  @Transform(optionalTrimmed)
  @IsIn(['next', 'prev'])
  direction?: 'next' | 'prev';

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}
