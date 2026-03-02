import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PublishStatus } from '@prisma/client';

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

  @ApiPropertyOptional({
    description: 'AcademicYear UUID — defaults to the active year from OrgContext if omitted',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;
}
