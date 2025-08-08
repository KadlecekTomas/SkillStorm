import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { SchoolGrade } from '@prisma/client';

export class MaterializeSubjectDto {
  @ApiProperty({ example: 'organization-id-uuid' })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({ example: 'Matematika pro ZŠ' })
  @IsOptional()
  @IsString()
  nameOverride?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: SchoolGrade,
    example: ['GRADE_6', 'GRADE_7'],
  })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  createLevelsForGrades?: SchoolGrade[];
}
