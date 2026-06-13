import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'membership-uuid' })
  @IsUUID()
  membershipId!: string;

  @ApiProperty({ example: 'organization-uuid' })
  @IsUUID()
  orgId!: string;

  @ApiProperty({
    example: 'year-uuid',
    description: 'ID školního roku (AcademicYear)',
  })
  @IsUUID()
  academicYearId!: string;

  @ApiProperty({
    example: 'class-section-uuid',
    description: 'ID třídy (ClassSection)',
  })
  @IsUUID()
  classSectionId!: string;

  @ApiPropertyOptional({ example: '2025-00123' })
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @ApiPropertyOptional({ example: 'BK-778899' })
  @IsOptional()
  @IsString()
  externalId?: string;
}
