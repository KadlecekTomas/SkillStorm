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

export class QueryClassSectionsDto {
  @ApiProperty({ description: 'Školní rok', example: 'year-uuid' })
  @IsOptional()
  @IsUUID()
  yearId?: string;

  @ApiPropertyOptional({
    description: 'Alias pro yearId',
    example: 'year-uuid',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ enum: SchoolGrade, example: 'PRIMARY_1' })
  @IsOptional()
  @IsEnum(SchoolGrade)
  grade?: SchoolGrade;

  @ApiPropertyOptional({
    description: 'Fulltext (label/section)',
    example: '1.A',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by teacher', example: 'teacher-uuid' })
  @IsOptional()
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
    example: 'eyJncmFkZSI6IkdSQURFXzEiLCJzZWN0aW9uIjoiQSIsImlkIjoidXVpZC0uLi4ifQ',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Cursor direction',
    enum: ['next', 'prev'],
    default: 'next',
  })
  @IsOptional()
  @IsIn(['next', 'prev'])
  direction?: 'next' | 'prev';

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 20;
}
