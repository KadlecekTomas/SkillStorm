import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export type GoogleRoleMappingSource = 'GROUP' | 'ORG_UNIT' | 'EMAIL_PATTERN';
export type GoogleRoleMappingRole = 'STUDENT' | 'TEACHER' | 'DIRECTOR';

export class GoogleRoleMappingDto {
  @ApiProperty({ enum: ['GROUP', 'ORG_UNIT', 'EMAIL_PATTERN'] })
  @IsIn(['GROUP', 'ORG_UNIT', 'EMAIL_PATTERN'])
  sourceType!: GoogleRoleMappingSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pattern?: string;

  @ApiProperty({ enum: ['STUDENT', 'TEACHER', 'DIRECTOR'] })
  @IsIn(['STUDENT', 'TEACHER', 'DIRECTOR'])
  role!: GoogleRoleMappingRole;

  @ApiProperty({ example: 1 })
  @IsNumber()
  confidence!: number;
}
