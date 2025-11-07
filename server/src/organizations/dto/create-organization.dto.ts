import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'ZŠ Palackého' })
  @IsString()
  @Length(3, 255)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiPropertyOptional({ example: 'Palackého 12' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional({ example: 'Praha' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  city?: string;

  @ApiPropertyOptional({ example: 'Česko' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  country?: string;

  @ApiPropertyOptional({
    enum: OrganizationType,
    example: 'SCHOOL',
    description: 'Typ organizace (SCHOOL, PRIVATE, COMMUNITY)',
  })
  @IsOptional()
  @IsEnum(OrganizationType, {
    message: 'Typ organizace musí být SCHOOL, PRIVATE nebo COMMUNITY',
  })
  @Transform(({ value }) => value?.toUpperCase())
  type?: OrganizationType;
}
