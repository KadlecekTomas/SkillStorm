import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class GoogleWorkspacePreviewRequestDto {
  @ApiPropertyOptional({
    description:
      'Target academic year. Defaults to the active year when omitted.',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classGroupPatterns?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teacherGroupPatterns?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  directorGroupPatterns?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedGroupPatterns?: string[];

  @ApiPropertyOptional({
    description:
      'When true the preview is computed without persisting a SyncRun.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
