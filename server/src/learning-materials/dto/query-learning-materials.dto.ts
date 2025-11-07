import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  EducationLevel,
  SchoolGrade,
  ContentScope,
  ContentType,
} from '@prisma/client';

export class QueryLearningMaterialsDto {
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
    description: 'Fulltext (title, description)',
    example: 'Zlomky',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: EducationLevel,
    example: EducationLevel.PRIMARY_2,
  })
  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @ApiPropertyOptional({
    enum: SchoolGrade,
    example: SchoolGrade.GRADE_5,
  })
  @IsOptional()
  @IsEnum(SchoolGrade)
  schoolGrade?: SchoolGrade;

  @ApiPropertyOptional({
    description: 'Scope filtr (GLOBAL/ORGANIZATION/SHARED)',
    enum: ContentScope,
  })
  @IsOptional()
  @IsEnum(ContentScope)
  scope?: ContentScope;

  @ApiPropertyOptional({
    enum: ContentType,
    example: ContentType.MATERIAL,
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({
    description: 'Org ID – povinné pro nesuperadmina při ORG obsahu',
    example: '3b1b9f1b-6a6f-4a0d-9a33-3a27f7f6b9c1',
  })
  @IsOptional()
  @IsUUID('4')
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Subject ID (volitelné) – zúžení',
    example: 'subject-uuid',
  })
  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'TopicLevel ID (volitelné) – zúžení',
    example: 'topic-level-uuid',
  })
  @IsOptional()
  @IsUUID('4')
  topicLevelId?: string;
}
