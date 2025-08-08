// src/modules/students/dto/export-students.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type ExportTemplate = 'tridni' | 'kontakty' | 'lms' | 'reditel';

export class ExportStudentsDto {
  @ApiPropertyOptional({ enum: ['csv', 'xlsx'], example: 'xlsx' })
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx' = 'xlsx';

  @ApiPropertyOptional({ example: 'students_export' })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  filename?: string;

  // filtry
  @ApiPropertyOptional({ example: 'Novák' })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'academic-year-uuid' })
  @IsOptional()
  @IsUUID()
  yearId?: string;

  @ApiPropertyOptional({ example: 'class-section-uuid' })
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  // batch
  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  batchSize?: number = 1000;

  // manuální sloupce (přetluče template)
  @ApiPropertyOptional({
    description: 'Volitelné: vybrané sloupce',
    example: ['userName', 'userEmail', 'classLabel', 'yearLabel'],
    isArray: true,
    type: String,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  columns?: string[];

  // zahrnout enrollments (u některých template zapneme automaticky)
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeEnrollments?: boolean;

  // 🔥 NOVĚ: presety
  @ApiPropertyOptional({
    enum: ['tridni', 'kontakty', 'lms', 'reditel'],
    example: 'tridni',
    description: 'Přednastavené sloupce/formát/volby',
  })
  @IsOptional()
  @IsIn(['tridni', 'kontakty', 'lms', 'reditel'])
  template?: ExportTemplate;

  // volitelný mód
  @ApiPropertyOptional({ enum: ['light', 'full'], example: 'light' })
  @IsOptional()
  @IsIn(['light', 'full'])
  mode?: 'light' | 'full';
}
