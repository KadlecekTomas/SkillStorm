import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PublishStatus, SchoolGrade } from '@prisma/client';

export class CreateTestDto {
  @ApiProperty({ example: 'Písemka – Zlomky' })
  @IsString()
  @Length(3, 255)
  title!: string;

  @ApiPropertyOptional({ example: 'Krátká prověrka na zlomky' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiProperty({ description: 'Subject UUID (must belong to the org, not deleted)' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({
    description: 'Pedagogical grades the test is intended for',
    enum: SchoolGrade,
    isArray: true,
    example: [SchoolGrade.GRADE_7, SchoolGrade.GRADE_8],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(SchoolGrade, { each: true })
  allowedGrades?: SchoolGrade[];

  @ApiPropertyOptional({
    description: 'AcademicYear UUID — defaults to the active year from OrgContext if omitted',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
