import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOrgSubjectDto {
  @ApiProperty({ description: 'Organization ID (must match user)' })
  @IsUUID()
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Existing Subject ID' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Custom subject name' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({
    description: 'Custom subject minimum grade',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(13)
  gradeFrom?: number;

  @ApiPropertyOptional({
    description: 'Custom subject maximum grade',
    example: 9,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(13)
  gradeTo?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}
