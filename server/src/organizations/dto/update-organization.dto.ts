import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OrganizationType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    example: 'ZŠ Komenského',
    description: 'Nový název organizace',
  })
  @IsOptional()
  @IsString()
  @Length(3, 255)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: 'Komenského 99' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional({ example: 'Brno' })
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
    example: 'COMMUNITY',
    description: 'Změna typu organizace (SCHOOL, PRIVATE, COMMUNITY)',
  })
  @IsOptional()
  @IsEnum(OrganizationType)
  type?: OrganizationType;
}
