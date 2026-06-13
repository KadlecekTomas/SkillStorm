// src/tests/dto/update-test.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({
    description: 'Org subject UUID (validated against organization)',
  })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Pedagogical grades the test is intended for',
    enum: SchoolGrade,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(SchoolGrade, { each: true })
  allowedGrades?: SchoolGrade[];
}
