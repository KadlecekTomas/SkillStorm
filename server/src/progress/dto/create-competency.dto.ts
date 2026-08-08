import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCompetencyDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsString()
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  scaleMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  scaleMax?: number;
}
