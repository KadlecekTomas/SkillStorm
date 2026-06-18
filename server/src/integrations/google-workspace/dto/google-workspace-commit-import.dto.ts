import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { GoogleClassMappingDto } from './google-class-mapping.dto';
import { GoogleRoleMappingDto } from './google-role-mapping.dto';

export class GoogleWorkspaceCommitOptionsDto {
  @ApiProperty({ default: true })
  @IsBoolean()
  createMissingUsers!: boolean;

  @ApiProperty({ default: true })
  @IsBoolean()
  updateExistingUsers!: boolean;

  @ApiProperty({
    default: false,
    description:
      'Mark Google-sourced enrollments no longer present in any group as LEFT.',
  })
  @IsBoolean()
  deactivateMissingEnrollments!: boolean;

  @ApiProperty({
    default: true,
    description: 'Never overwrite class/enrollment links flagged as manual.',
  })
  @IsBoolean()
  respectManualOverrides!: boolean;
}

export class GoogleWorkspaceCommitImportDto {
  @ApiPropertyOptional({
    description: 'Target academic year. Defaults to the active year.',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiProperty({ type: [GoogleClassMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoogleClassMappingDto)
  selectedClassMappings!: GoogleClassMappingDto[];

  @ApiProperty({ type: [GoogleRoleMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoogleRoleMappingDto)
  selectedRoleMappings!: GoogleRoleMappingDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Google user/group ids to skip entirely.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredExternalIds?: string[];

  @ApiProperty({ type: GoogleWorkspaceCommitOptionsDto })
  @ValidateNested()
  @Type(() => GoogleWorkspaceCommitOptionsDto)
  options!: GoogleWorkspaceCommitOptionsDto;
}
