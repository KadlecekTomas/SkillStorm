import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateStudentDto {
  @ApiPropertyOptional({ example: '2025-00123' })
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @ApiPropertyOptional({ example: 'BK-778899' })
  @IsOptional()
  @IsString()
  externalId?: string;
}
