import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherClassAccessLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateTeacherAccessDto {
  @ApiProperty({ example: 'teacher-uuid' })
  @IsUUID()
  teacherId!: string;

  @ApiProperty({ example: 'class-section-uuid' })
  @IsUUID()
  classSectionId!: string;

  @ApiProperty({
    enum: TeacherClassAccessLevel,
    example: TeacherClassAccessLevel.EDIT,
  })
  @IsEnum(TeacherClassAccessLevel)
  accessLevel!: TeacherClassAccessLevel;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validFrom?: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.999Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  validTo?: Date;
}
