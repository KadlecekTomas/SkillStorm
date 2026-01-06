import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsString, IsOptional } from 'class-validator';
import { SchoolGrade } from '@prisma/client';

export class CreateClassSectionDto {
  @ApiProperty({
    example: 'year-uuid',
    description: 'ID školního roku (AcademicYear)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  yearId?: string;

  @ApiProperty({
    example: 'PRIMARY_1',
    description: 'Ročník třídy (např. PRIMARY_1, PRIMARY_2...)',
  })
  @IsEnum(SchoolGrade)
  grade!: SchoolGrade;

  @ApiProperty({
    example: 'A',
    description: 'Označení sekce (A, B, C...)',
  })
  @IsString()
  section!: string;

  @ApiProperty({
    example: '1.A',
    description: 'Celé označení třídy',
  })
  @IsString()
  label!: string;

  @ApiProperty({
    example: 'Informatika',
    description: 'Studijní obor (volitelné)',
    required: false,
  })
  @IsOptional()
  @IsString()
  studyField?: string;

  @ApiProperty({
    example: 'teacher-uuid',
    description: 'Učitel třídní (volitelné)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}
