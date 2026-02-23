import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Length, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOrgSubjectDto {
  @ApiProperty({ example: 'Matematika' })
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 1, description: 'Grade from (1–9 CZ ZŠ)' })
  @IsInt()
  @Min(1)
  @Max(9)
  gradeFrom!: number;

  @ApiProperty({ example: 2, description: 'Grade to (1–9 CZ ZŠ)' })
  @IsInt()
  @Min(1)
  @Max(9)
  gradeTo!: number;

  @ApiProperty({ description: 'Organization ID (must match user)' })
  @IsUUID()
  organizationId!: string;
}
