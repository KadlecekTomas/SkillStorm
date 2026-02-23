import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateOrgSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ description: 'Grade from (1–9)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  gradeFrom?: number;

  @ApiPropertyOptional({ description: 'Grade to (1–9)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  gradeTo?: number;
}
