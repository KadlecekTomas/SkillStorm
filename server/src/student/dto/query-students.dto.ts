// src/modules/students/dto/query-students.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryStudentsDto {
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

  @ApiPropertyOptional({
    description: 'Fulltext: jméno, studentNumber, externalId',
    example: 'Novák',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrovat podle aktuálního školního roku',
    example: 'academic-year-uuid',
  })
  @IsOptional()
  @IsUUID()
  yearId?: string;

  @ApiPropertyOptional({
    description: 'Filtrovat podle třídy',
    example: 'class-section-uuid',
  })
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @ApiPropertyOptional({
    description: 'Žáci dostupní pro zápis: NE v této třídě v daném roce',
    example: 'class-section-uuid',
  })
  @IsOptional()
  @IsUUID()
  availableForClassSectionId?: string;

  @ApiPropertyOptional({
    description: 'Žáci dostupní pro zápis: yearId pro availableForClassSectionId',
    example: 'academic-year-uuid',
  })
  @IsOptional()
  @IsUUID()
  availableForYearId?: string;
}
