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
import {
  ContentType,
  EducationLevel,
  SchoolGrade,
  ContentScope,
  MaterialAccessLevel,
} from '@prisma/client';

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
    enum: ContentType,
    example: ContentType.MATERIAL,
  })
  @IsEnum(ContentType)
  contentType!: ContentType;

  @ApiProperty({
    enum: EducationLevel,
    example: EducationLevel.PRIMARY_2,
  })
  @IsEnum(EducationLevel)
  educationLevel!: EducationLevel;

  @ApiPropertyOptional({
    enum: SchoolGrade,
    example: SchoolGrade.GRADE_5,
  })
  @IsOptional()
  @IsEnum(SchoolGrade)
  schoolGrade?: SchoolGrade;

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
    enum: ContentScope,
    example: ContentScope.ORGANIZATION,
    default: ContentScope.ORGANIZATION,
  })
  @IsOptional()
  @IsEnum(ContentScope)
  scope?: ContentScope;

  // organizationId je povinné pouze, pokud je scope ORGANIZATION (nechceme měnit DB)
  @ApiPropertyOptional({
    description: 'Organization ID – povinné, pokud scope=ORGANIZATION',
    example: 'organization-uuid',
  })
  @ValidateIf(
    (o) => (o.scope ?? ContentScope.ORGANIZATION) === ContentScope.ORGANIZATION,
  )
  @IsUUID('4')
  organizationId?: string;

  @ApiPropertyOptional({
    enum: MaterialAccessLevel,
    example: MaterialAccessLevel.FREE,
  })
  @IsOptional()
  @IsEnum(MaterialAccessLevel)
  accessLevel?: MaterialAccessLevel;

  // price jen když accessLevel=PAID
  @ApiPropertyOptional({ example: 99.0 })
  @ValidateIf((o) => o.accessLevel === MaterialAccessLevel.PAID)
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDownloadable?: boolean;
}
