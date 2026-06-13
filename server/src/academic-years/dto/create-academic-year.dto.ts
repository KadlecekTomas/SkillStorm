import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({
    example: 2025,
    description:
      'Start year of school year (2025 = 2025/2026, starts 1.9., ends 31.8.)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  startYear!: number;

  @ApiPropertyOptional({ description: 'Set as active school year' })
  @IsOptional()
  isActive?: boolean;
}
