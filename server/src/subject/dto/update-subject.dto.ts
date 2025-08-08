import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateSubjectDto {
  // POZOR: organizationId se NEMĚNÍ
  @ApiPropertyOptional({ example: 'Matematika – rozšířená' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'catalog-subject-id-uuid' })
  @IsOptional()
  @IsUUID()
  catalogSubjectId?: string;
}
