import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2024/25', description: 'Název školního roku' })
  @IsString()
  @MaxLength(32)
  name!: string;

  @ApiProperty({ example: '2024-09-01', description: 'Datum začátku' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2025-06-30', description: 'Datum konce' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Aktivní školní rok' })
  @IsOptional()
  isActive?: boolean;
}
