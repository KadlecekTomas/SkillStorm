import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolGrade } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export type GoogleClassMappingAction = 'CREATE' | 'MAP_EXISTING' | 'IGNORE';

export class GoogleClassMappingDto {
  @ApiProperty()
  @IsString()
  externalGroupId!: string;

  @ApiProperty()
  @IsString()
  externalGroupEmail!: string;

  @ApiProperty()
  @IsString()
  externalGroupName!: string;

  @ApiProperty({ enum: SchoolGrade })
  @IsEnum(SchoolGrade)
  grade!: SchoolGrade;

  @ApiProperty({ example: 'A' })
  @IsString()
  section!: string;

  @ApiProperty({ example: '7.A' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  confidence!: number;

  @ApiProperty({ enum: ['CREATE', 'MAP_EXISTING', 'IGNORE'] })
  @IsIn(['CREATE', 'MAP_EXISTING', 'IGNORE'])
  action!: GoogleClassMappingAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  existingClassSectionId?: string;
}
