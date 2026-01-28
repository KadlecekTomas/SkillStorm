import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class BulkEnrollmentEntryDto {
  @ApiProperty({ example: 'Jan Novak' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'jan.novak@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class BulkEnrollmentDto {
  @ApiProperty({ example: 'year-uuid' })
  @IsUUID()
  academicYearId!: string;

  @ApiPropertyOptional({ example: 'class-section-uuid' })
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @ApiPropertyOptional({ example: 'classroom-uuid' })
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiProperty({ type: [BulkEnrollmentEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkEnrollmentEntryDto)
  entries!: BulkEnrollmentEntryDto[];
}
