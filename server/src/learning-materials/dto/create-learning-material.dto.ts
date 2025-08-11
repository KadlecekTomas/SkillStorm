import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  IsBoolean,
  IsNumber,
  ValidateIf,
} from 'class-validator';
import { $Enums } from '@prisma/client';

export class CreateLearningMaterialDto {
  @ApiProperty({ example: 'Zlomky – úvod' })
  @IsString()
  @Length(3, 255)
  title!: string;

  @ApiPropertyOptional({ example: 'Materiál vysvětluje základy zlomků.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: $Enums.ContentType,
    example: $Enums.ContentType.MATERIAL,
  })
  @IsEnum($Enums.ContentType)
  contentType!: $Enums.ContentType;

  @ApiProperty({
    enum: $Enums.EducationLevel,
    example: $Enums.EducationLevel.PRIMARY_2,
  })
  @IsEnum($Enums.EducationLevel)
  educationLevel!: $Enums.EducationLevel;

  @ApiPropertyOptional({
    enum: $Enums.SchoolGrade,
    example: $Enums.SchoolGrade.GRADE_5,
  })
  @IsOptional()
  @IsEnum($Enums.SchoolGrade)
  schoolGrade?: $Enums.SchoolGrade;

  @ApiPropertyOptional({
    description: 'Subject ID (volitelné)',
    example: 'subject-uuid',
  })
  @IsOptional()
  @IsUUID('4')
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'TopicLevel ID (volitelné)',
    example: 'topic-level-uuid',
  })
  @IsOptional()
  @IsUUID('4')
  topicLevelId?: string;

  @ApiPropertyOptional({
    enum: $Enums.ContentScope,
    example: $Enums.ContentScope.ORGANIZATION,
    default: $Enums.ContentScope.ORGANIZATION,
  })
  @IsOptional()
  @IsEnum($Enums.ContentScope)
  scope?: $Enums.ContentScope;

  // organizationId je povinné pouze, pokud je scope ORGANIZATION (nechceme měnit DB)
  @ApiPropertyOptional({
    description: 'Organization ID – povinné, pokud scope=ORGANIZATION',
    example: 'organization-uuid',
  })
  @ValidateIf(
    (o) =>
      (o.scope ?? $Enums.ContentScope.ORGANIZATION) ===
      $Enums.ContentScope.ORGANIZATION,
  )
  @IsUUID('4')
  organizationId?: string;

  @ApiPropertyOptional({
    enum: $Enums.MaterialAccessLevel,
    example: $Enums.MaterialAccessLevel.FREE,
  })
  @IsOptional()
  @IsEnum($Enums.MaterialAccessLevel)
  accessLevel?: $Enums.MaterialAccessLevel;

  // price jen když accessLevel=PAID
  @ApiPropertyOptional({ example: 99.0 })
  @ValidateIf((o) => o.accessLevel === $Enums.MaterialAccessLevel.PAID)
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDownloadable?: boolean;
}
