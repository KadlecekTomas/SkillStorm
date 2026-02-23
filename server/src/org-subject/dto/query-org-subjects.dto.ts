import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryOrgSubjectsDto {
  @ApiPropertyOptional({ example: 3, description: 'Filter subjects valid for this grade' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  grade?: number;
}
