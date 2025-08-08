import { IsUUID, IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Matematika' })
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'organization-id-uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiPropertyOptional({ example: 'catalog-subject-id-uuid' })
  @IsOptional()
  @IsUUID()
  catalogSubjectId?: string;
}
