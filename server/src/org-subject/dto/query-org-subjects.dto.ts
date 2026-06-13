import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryOrgSubjectsDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Filter subjects valid for this grade',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  grade?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Include disabled org subjects. Default returns enabled only.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  includeDisabled?: boolean;
}
