import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
