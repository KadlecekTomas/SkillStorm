import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateStudentDto {
  @ApiPropertyOptional({ example: 'Jan Novák' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'jan.novak@example.cz' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'class-section-uuid' })
  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  @ApiPropertyOptional({ example: '2025-00123' })
  @IsOptional()
  @IsString()
  studentNumber?: string;

  @ApiPropertyOptional({ example: 'BK-778899' })
  @IsOptional()
  @IsString()
  externalId?: string;
}
